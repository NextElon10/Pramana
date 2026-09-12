import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { api, formatNumber } from '../../lib/api';
import { ErrorState, Card, TableSkeleton, EmptyState } from '../../components/Shared';

const ACTION_STYLE = (action: string) => {
  if (action.includes('DELETE')) return 'chip-high';
  if (action.includes('LOGIN') || action.includes('LOGOUT')) return 'chip-neutral';
  if (action.includes('UPLOAD') || action.includes('REANALYZE')) return 'chip-good';
  if (action.includes('REVIEW') || action.includes('REPORT')) return 'chip-warn';
  return 'chip-neutral';
};

export default function AuditLog() {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  const load = () => {
    setLoading(true); setError('');
    api.get('/audit?pageSize=200')
      .then((d) => { setRows(d.results); setTotal(d.total); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return rows;
    return rows.filter((r) =>
      [r.action, r.actor_email, r.actor_role, r.metadata_json].some((v) => String(v || '').toLowerCase().includes(f)));
  }, [rows, filter]);

  return (
    <AdminLayout
      title="Audit Log"
      description="Immutable record of administrative and security-relevant actions"
      actions={<button onClick={load} className="btn-secondary btn-sm">Refresh</button>}
    >
      <Card className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-[240px] flex-1">
            <label className="sr-only" htmlFor="afilter">Filter audit entries</label>
            <input id="afilter" className="input" placeholder="Filter by action, actor or metadata" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
          <span className="text-2xs text-ink-muted">
            Showing {formatNumber(filtered.length)} of {formatNumber(total)} entries · passwords, tokens and OTP values are never logged
          </span>
        </div>
      </Card>

      {loading && <TableSkeleton rows={10} cols={6} />}
      {error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && filtered.length === 0 && (
        <EmptyState icon="☰" title="No audit entries" description="No actions match the current filter." />
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Timestamp (UTC)</th><th>Action</th><th>Actor</th><th>Role</th><th>Dataset</th><th>Metadata</th><th>IP</th></tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap tabular-nums text-ink-muted">{r.ts}</td>
                  <td><span className={`chip ${ACTION_STYLE(r.action)}`}>{r.action}</span></td>
                  <td>{r.actor_email || <span className="italic text-ink-faint">anonymous</span>}</td>
                  <td className="text-2xs uppercase tracking-wide text-ink-muted">{r.actor_role}</td>
                  <td className="tabular-nums">{r.dataset_id || '—'}</td>
                  <td className="max-w-xs truncate font-mono text-[11px] text-ink-muted" title={r.metadata_json}>{r.metadata_json || '—'}</td>
                  <td className="font-mono text-[11px] text-ink-muted">{r.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}
