// ==============================================================
// Simple data cache di IndexedDB.
//
// Pattern: store-and-replace, BUKAN delta merge.
//   - saveSnapshot(data, meta)  → tulis full snapshot
//   - loadSnapshot()            → baca full snapshot
//   - clearSnapshot()           → hapus
//
// Verifikasi cache fresh-or-stale dilakukan di caller via meta:
//   - txCount, dlCount, txMaxUploaded, dlMaxUploaded
//
// Behavior penting: cache NEVER di-merge. Caller decide:
//   - cache fresh (count + maxUpload match DB) → pakai apa adanya
//   - cache stale → buang, full refetch
// Ini mencegah flicker / "ngaccak" karena gak ada 2-stage render.
// ==============================================================

import { logger } from '../logger';

const DB_NAME = 'simarsel-data-cache';
const DB_VERSION = 1;
const STORE_NAME = 'snapshot';
const SNAPSHOT_KEY = 'current';

export interface SnapshotMeta {
  userId: string;
  txCount: number;
  dlCount: number;
  txMaxUploaded: string | null;     // ISO timestamp
  dlMaxUploaded: string | null;
  savedAt: string;
}

interface StoredSnapshot {
  key: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transactions: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  downloaders: any[];
  meta: SnapshotMeta;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
  });
  return dbPromise;
}

export async function saveSnapshot<TxRow, DlRow>(
  transactions: TxRow[],
  downloaders: DlRow[],
  meta: SnapshotMeta,
): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const stored: StoredSnapshot = {
        key: SNAPSHOT_KEY,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        transactions: transactions as any[],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        downloaders: downloaders as any[],
        meta,
      };
      tx.objectStore(STORE_NAME).put(stored);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    logger.info(`[cache] snapshot saved: ${transactions.length} tx, ${downloaders.length} dl`);
  } catch (err) {
    logger.warn('[cache] saveSnapshot failed:', err);
  }
}

export async function loadSnapshot<TxRow, DlRow>(): Promise<{
  transactions: TxRow[];
  downloaders: DlRow[];
  meta: SnapshotMeta;
} | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(SNAPSHOT_KEY);
      req.onsuccess = () => {
        const stored = req.result as StoredSnapshot | undefined;
        if (!stored) return resolve(null);
        resolve({
          transactions: stored.transactions as TxRow[],
          downloaders: stored.downloaders as DlRow[],
          meta: stored.meta,
        });
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    logger.warn('[cache] loadSnapshot failed:', err);
    return null;
  }
}

export async function clearSnapshot(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    logger.info('[cache] snapshot cleared');
  } catch (err) {
    logger.warn('[cache] clearSnapshot failed:', err);
  }
}
