import { useMemo, useState } from 'react';
import { useAuditLog } from '@/hooks/useAuditLog';
import type { AuditAction } from '@/types/database';
import { Shield, ChevronLeft, ChevronRight } from 'lucide-react';

const TABLES = [
  'target_configs',
  'daily_data',
  'social_media_contents',
  'apps',
];

const PAGE_SIZE = 50;

export default function AuditLogTab() {
  const [tableName, setTableName] = useState<string>('');
  const [action, setAction] = useState<AuditAction | ''>('');
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const filters = useMemo(
    () => ({
      tableName: tableName || null,
      action: (action || null) as AuditAction | null,
      page,
      pageSize: PAGE_SIZE,
    }),
    [tableName, action, page]
  );

  const { data, isLoading, error } = useAuditLog(filters);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-indigo-50 rounded-xl">
          <Shield className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight">Audit Log</h2>
          <p className="text-xs text-slate-400 font-medium mt-1">
            Every INSERT / UPDATE / DELETE on target, daily, social, and app tables.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={tableName}
          onChange={(e) => {
            setTableName(e.target.value);
            setPage(0);
          }}
          className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm"
        >
          <option value="">All tables</option>
          {TABLES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value as AuditAction | '');
            setPage(0);
          }}
          className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm"
        >
          <option value="">All actions</option>
          <option value="INSERT">INSERT</option>
          <option value="UPDATE">UPDATE</option>
          <option value="DELETE">DELETE</option>
        </select>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {(error as Error).message}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">When</th>
                <th className="px-4 py-3 text-left font-semibold">Table</th>
                <th className="px-4 py-3 text-left font-semibold">Action</th>
                <th className="px-4 py-3 text-left font-semibold">User</th>
                <th className="px-4 py-3 text-left font-semibold">Changed fields</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && data?.rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                    No audit entries match these filters.
                  </td>
                </tr>
              )}
              {data?.rows.map((row) => {
                const isOpen = expanded === row.id;
                return (
                  <>
                    <tr key={row.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 text-slate-600 text-xs font-mono">
                        {new Date(row.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-slate-900 font-medium">{row.table_name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            row.action === 'INSERT'
                              ? 'bg-emerald-50 text-emerald-700'
                              : row.action === 'UPDATE'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {row.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">
                        <div className="font-medium text-slate-800">{row.user_email ?? '—'}</div>
                        <div className="text-slate-400">{row.user_role ?? '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {row.changed_fields && row.changed_fields.length > 0
                          ? row.changed_fields.slice(0, 4).join(', ') +
                            (row.changed_fields.length > 4 ? ` +${row.changed_fields.length - 4}` : '')
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : row.id)}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          {isOpen ? 'Hide' : 'View'}
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`${row.id}-expanded`} className="bg-slate-50">
                        <td colSpan={6} className="px-4 py-3">
                          <DiffView row={row} />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
          <div>
            Page {page + 1} of {Math.max(1, totalPages)} · {data?.total ?? 0} entries
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => (p + 1 < totalPages ? p + 1 : p))}
              disabled={page + 1 >= totalPages}
              className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DiffView({
  row,
}: {
  row: { action: AuditAction; old_data: unknown; new_data: unknown; changed_fields: string[] | null };
}) {
  const oldData = (row.old_data ?? {}) as Record<string, unknown>;
  const newData = (row.new_data ?? {}) as Record<string, unknown>;
  const fields = row.changed_fields && row.changed_fields.length > 0
    ? row.changed_fields
    : Array.from(new Set([...Object.keys(oldData), ...Object.keys(newData)]));

  if (row.action === 'INSERT') {
    return <pre className="text-[11px] text-slate-700 whitespace-pre-wrap">{JSON.stringify(newData, null, 2)}</pre>;
  }
  if (row.action === 'DELETE') {
    return <pre className="text-[11px] text-slate-700 whitespace-pre-wrap">{JSON.stringify(oldData, null, 2)}</pre>;
  }

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-[10px] uppercase tracking-wider text-slate-400">
          <th className="text-left font-semibold py-1">Field</th>
          <th className="text-left font-semibold py-1">Before</th>
          <th className="text-left font-semibold py-1">After</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-200">
        {fields.map((f) => (
          <tr key={f}>
            <td className="py-1 pr-3 font-mono text-slate-600">{f}</td>
            <td className="py-1 pr-3 text-slate-500 font-mono break-all">
              {formatVal(oldData[f])}
            </td>
            <td className="py-1 text-slate-800 font-mono break-all">
              {formatVal(newData[f])}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatVal(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
