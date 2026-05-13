// ==============================================================
// IndexedDB cache untuk raw transactions + downloaders.
//
// Tujuan: hindari fetch full 364K rows tiap user buka dashboard.
// Strategy: simpan semua row di IndexedDB → load instant pas reload,
// terus sync delta (cuma row dengan uploaded_at > last_sync).
//
// Per-user keying: cache key di-namespace by user_id, jadi kalau user
// ganti / logout login lagi, tidak pakai cache user lain.
//
// Schema:
//   DB:    simarsel-cache (versi 1)
//   Store: transactions    (keyPath: 'id' — uuid PK)
//   Store: downloaders     (keyPath: 'cache_key' — kombinasi date::source_app)
//   Store: meta            (keyPath: 'key' — string)
//
// Meta keys yang dipakai:
//   'lastSync:transactions:<userId>'  → ISO timestamp string
//   'lastSync:downloaders:<userId>'   → ISO timestamp string
//   'cacheUser'                       → userId terakhir (deteksi user berubah)
// ==============================================================

import { logger } from '../logger';

const DB_NAME = 'simarsel-cache';
const DB_VERSION = 1;

const STORE_TX = 'transactions';
const STORE_DL = 'downloaders';
const STORE_META = 'meta';

// ---------- Type helpers ----------

interface DownloaderCacheRow {
  cache_key: string;       // 'YYYY-MM-DD::<source_app>'
  date: string;
  source_app: string;
  count: number;
  uploaded_at?: string;
}

function dlKey(date: string, source_app: string): string {
  return `${date}::${source_app}`;
}

// ---------- DB open (idempotent) ----------

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => {
      logger.warn('[cache] IndexedDB open error:', req.error);
      reject(req.error);
    };
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_TX)) {
        db.createObjectStore(STORE_TX, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_DL)) {
        db.createObjectStore(STORE_DL, { keyPath: 'cache_key' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
  });
  return dbPromise;
}

// ---------- Generic helpers ----------

function runTx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        let result: T;
        Promise.resolve(fn(store)).then((r) => {
          // Either we got an IDBRequest (sync) or T directly (already awaited)
          if (r && typeof (r as unknown as IDBRequest).onsuccess === 'object') {
            (r as unknown as IDBRequest<T>).onsuccess = () => {
              result = (r as unknown as IDBRequest<T>).result;
            };
            (r as unknown as IDBRequest).onerror = () => reject((r as unknown as IDBRequest).error);
          } else {
            result = r as T;
          }
        });
        tx.oncomplete = () => resolve(result as T);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

function getAllRows<T>(storeName: string): Promise<T[]> {
  return openDb().then(
    (db) =>
      new Promise<T[]>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result as T[]);
        req.onerror = () => reject(req.error);
      }),
  );
}

function bulkPut<T>(storeName: string, rows: T[]): Promise<void> {
  if (rows.length === 0) return Promise.resolve();
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        rows.forEach((r) => store.put(r));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

function deleteRow(storeName: string, key: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

function clearStore(storeName: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

// ---------- Meta helpers ----------

async function getMeta(key: string): Promise<string | null> {
  try {
    const db = await openDb();
    return new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readonly');
      const req = tx.objectStore(STORE_META).get(key);
      req.onsuccess = () => {
        const row = req.result as { key: string; value: string } | undefined;
        resolve(row ? row.value : null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    logger.warn('[cache] getMeta failed:', err);
    return null;
  }
}

async function setMeta(key: string, value: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readwrite');
      tx.objectStore(STORE_META).put({ key, value });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    logger.warn('[cache] setMeta failed:', err);
  }
}

// ---------- Public API ----------

export interface CachedDataset<TxRow, DlRow> {
  transactions: TxRow[];
  downloaders: DlRow[];
  lastSyncTx: string | null;   // ISO timestamp atau null kalau belum pernah sync
  lastSyncDl: string | null;
}

/**
 * Cek apakah cache milik user yang sama. Kalau beda user, otomatis clear.
 * Return true kalau cache valid (user sama).
 */
export async function ensureCacheUser(userId: string): Promise<boolean> {
  const lastUser = await getMeta('cacheUser');
  if (lastUser && lastUser !== userId) {
    logger.info(`[cache] user changed (${lastUser} → ${userId}), clearing cache`);
    await clearCache();
  }
  await setMeta('cacheUser', userId);
  return true;
}

/**
 * Load semua row dari cache (instant render).
 */
export async function loadCachedDataset<TxRow, DlRow>(
  userId: string,
): Promise<CachedDataset<TxRow, DlRow>> {
  try {
    await ensureCacheUser(userId);
    const [transactions, dlRaw, lastSyncTx, lastSyncDl] = await Promise.all([
      getAllRows<TxRow>(STORE_TX),
      getAllRows<DownloaderCacheRow>(STORE_DL),
      getMeta(`lastSync:transactions:${userId}`),
      getMeta(`lastSync:downloaders:${userId}`),
    ]);
    // Strip internal `cache_key` field saat return ke caller
    const downloaders = dlRaw.map((r) => {
      const { cache_key: _ck, ...rest } = r;
      return rest as unknown as DlRow;
    });
    return { transactions, downloaders, lastSyncTx, lastSyncDl };
  } catch (err) {
    logger.warn('[cache] load failed, returning empty:', err);
    return { transactions: [], downloaders: [], lastSyncTx: null, lastSyncDl: null };
  }
}

/**
 * Tulis bulk transactions ke cache + update last sync timestamp.
 */
export async function writeTransactions<T extends { id?: string; uploaded_at?: string }>(
  userId: string,
  rows: T[],
): Promise<void> {
  if (rows.length === 0) return;
  try {
    // Filter out rows tanpa id (shouldn't happen tapi guard)
    const validRows = rows.filter((r) => typeof r.id === 'string' && r.id.length > 0);
    await bulkPut(STORE_TX, validRows);
    // Track max uploaded_at as last sync
    const maxUploaded = validRows.reduce<string | null>((max, r) => {
      const u = r.uploaded_at;
      if (!u) return max;
      return !max || u > max ? u : max;
    }, null);
    if (maxUploaded) {
      const existing = await getMeta(`lastSync:transactions:${userId}`);
      if (!existing || maxUploaded > existing) {
        await setMeta(`lastSync:transactions:${userId}`, maxUploaded);
      }
    }
  } catch (err) {
    logger.warn('[cache] writeTransactions failed:', err);
  }
}

/**
 * Tulis bulk downloaders ke cache + update last sync timestamp.
 */
export async function writeDownloaders<T extends { date?: string; source_app?: string; uploaded_at?: string }>(
  userId: string,
  rows: T[],
): Promise<void> {
  if (rows.length === 0) return;
  try {
    const withKey = rows
      .filter((r) => r.date && r.source_app)
      .map((r) => ({
        ...r,
        cache_key: dlKey(r.date as string, r.source_app as string),
      }));
    await bulkPut(STORE_DL, withKey);
    const maxUploaded = withKey.reduce<string | null>((max, r) => {
      const u = r.uploaded_at;
      if (!u) return max;
      return !max || u > max ? u : max;
    }, null);
    if (maxUploaded) {
      const existing = await getMeta(`lastSync:downloaders:${userId}`);
      if (!existing || maxUploaded > existing) {
        await setMeta(`lastSync:downloaders:${userId}`, maxUploaded);
      }
    }
  } catch (err) {
    logger.warn('[cache] writeDownloaders failed:', err);
  }
}

/**
 * Hapus 1 transaction row dari cache (realtime DELETE event).
 */
export async function deleteTransactionFromCache(id: string): Promise<void> {
  try {
    await deleteRow(STORE_TX, id);
  } catch (err) {
    logger.warn('[cache] deleteTransaction failed:', err);
  }
}

/**
 * Hapus 1 downloader row dari cache.
 */
export async function deleteDownloaderFromCache(date: string, source_app: string): Promise<void> {
  try {
    await deleteRow(STORE_DL, dlKey(date, source_app));
  } catch (err) {
    logger.warn('[cache] deleteDownloader failed:', err);
  }
}

/**
 * Clear semua cache (mis. saat user logout / ganti user / corrupt detected).
 */
export async function clearCache(): Promise<void> {
  try {
    await Promise.all([
      clearStore(STORE_TX),
      clearStore(STORE_DL),
      clearStore(STORE_META),
    ]);
    logger.info('[cache] cleared');
  } catch (err) {
    logger.warn('[cache] clear failed:', err);
  }
}

// Suppress unused warning for runTx (kept for future use / direct store access).
void runTx;
