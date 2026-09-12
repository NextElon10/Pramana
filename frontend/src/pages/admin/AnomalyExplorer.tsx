import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import { api, formatCompactINR, formatNumber } from '../../lib/api';
import { RiskBadge, ReviewBadge, ErrorState, EmptyState, Card, TableSkeleton, Pagination, Constituency, WorkflowSteps, shortReason } from '../../components/Shared';
import RecordDrawer from '../../components/admin/RecordDrawer';
import Captcha, { type CaptchaState } from '../../components/Captcha';

const CLASSIFICATIONS = ['Normal', 'Slightly Unusual', 'Unusual', 'Highly Unusual', 'Extreme Statistical Anomaly'];
const REVIEW_STATUSES = ['Unreviewed', 'Under Review', 'Reviewed - No Issue', 'Escalated'];
const PAGE_SIZE = 25;

/* Every column remains available in the column picker. Those marked `advanced` simply
   start hidden, so the default view reads as MP / state / constituency / amount /
   signal / reason / score rather than as a wall of raw statistics. */
const ALL_COLUMNS = [
  { key: 'risk', label: 'Risk', always: true },
  { key: 'record', label: 'Record ID', advanced: true },
  { key: 'state', label: 'State' },
  { key: 'constituency', label: 'Constituency' },
  { key: 'mp', label: 'MP / Member' },
  { key: 'domain', label: 'Domain' },
  { key: 'amount', label: 'Allocated amount' },
  { key: 'reason', label: 'Reason' },
  { key: 'percentile', label: 'Percentile' },
  { key: 'flags', label: 'Method flags', advanced: true },
  { key: 'methods', label: 'Methods' },
  { key: 'score', label: 'Score' },
  { key: 'review', label: 'Review' },
];

export default function AnomalyExplorer() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const [search, setSearch] = useState(params.get('q') || '');
  const [visible, setVisible] = useState<string[]>(ALL_COLUMNS.filter((c) => !c.advanced).map((c) => c.key));
  const [showCols, setShowCols] = useState(false);

  const page = parseInt(params.get('page') || '1', 10);
  const sort = params.get('sort') || 'anomaly_score';
  const dir = params.get('dir') || 'desc';

  const load = () => {
    setLoading(true); setError('');
    const qp = new URLSearchParams(params);
    qp.set('page', String(page));
    qp.set('pageSize', String(PAGE_SIZE));
    qp.set('sort', sort);
    qp.set('dir', dir);
    api.get(`/anomalies?${qp.toString()}`).then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(load, [params]);
  useEffect(() => { setSearch(params.get('q') || ''); }, [params]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.set('page', '1');
    setParams(next);
  };

  const toggleSort = (col: string) => {
    const next = new URLSearchParams(params);
    if (sort === col) next.set('dir', dir === 'desc' ? 'asc' : 'desc');
    else { next.set('sort', col); next.set('dir', 'desc'); }
    next.set('page', '1');
    setParams(next);
  };

  const show = (k: string) => visible.includes(k);
  const sortArrow = (col: string) => (sort === col ? (dir === 'desc' ? ' ↓' : ' ↑') : '');

  /* Bulk export is verification-gated: the same control as sign-in, because a scripted
     download of every flagged record is the most attractive thing on this page. The
     file is fetched and saved from a blob so the session cookie is sent and the
     single-use token never lands in the browser's history. */
  const [exportOpen, setExportOpen] = useState(false);
  const [exportCaptcha, setExportCaptcha] = useState<CaptchaState>({ id: '', answer: '' });
  const [exportChallenge, setExportChallenge] = useState<{ id: string; question: string } | null>(null);
  const [exportError, setExportError] = useState('');
  const [exporting, setExporting] = useState(false);

  const runExport = async (e: React.FormEvent) => {
    e.preventDefault();
    setExporting(true); setExportError('');
    const qs = new URLSearchParams(params);
    qs.set('captchaId', exportCaptcha.id);
    qs.set('captchaAnswer', exportCaptcha.answer);
    try {
      const res = await fetch(`/api/anomalies/export.csv?${qs.toString()}`, { credentials: 'include' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setExportError(body.message || 'The export could not be completed.');
        const fresh = await fetch('/api/auth/captcha').then((r) => r.json()).catch(() => null);
        if (fresh) setExportChallenge(fresh);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pramana-anomaly-export.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportOpen(false);
    } catch {
      setExportError('The export could not be completed. Check your connection and try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <AdminLayout
      title="Anomaly Explorer"
      description="Every analysed record with its statistical signals and review state"
      actions={<button onClick={() => { setExportOpen(true); setExportError(''); }} className="btn-secondary btn-sm">Export CSV</button>}
    >
      <WorkflowSteps current="findings" />
      <Card className="mb-4">
        <div className="grid gap-4 p-5 lg:grid-cols-[1.6fr_1fr_1fr_auto] lg:items-end">
          <div>
            <label className="field-label" htmlFor="asearch">Search</label>
            <form onSubmit={(e) => { e.preventDefault(); setParam('q', search); }}>
              <input id="asearch" className="input" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="MP / member, project, state or ID — press Enter" />
            </form>
          </div>
          <div>
            <label className="field-label" htmlFor="cls">Classification</label>
            <select id="cls" className="select" value={params.get('classification') || ''} onChange={(e) => setParam('classification', e.target.value)}>
              <option value="">All classifications</option>
              {CLASSIFICATIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="rev">Review status</label>
            <select id="rev" className="select" value={params.get('reviewStatus') || ''} onChange={(e) => setParam('reviewStatus', e.target.value)}>
              <option value="">All review states</option>
              {REVIEW_STATUSES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => setShowCols(!showCols)} aria-expanded={showCols}>Columns</button>
            <button className="btn-secondary" onClick={() => { setSearch(''); setParams({}); }}>Reset</button>
          </div>
        </div>

        {showCols && (
          <div className="flex flex-wrap gap-3 border-t border-line bg-surface-raised px-5 py-3">
            {ALL_COLUMNS.map((c) => (
              <label key={c.key} className={`flex items-center gap-1.5 text-[13px] ${c.always ? 'opacity-50' : ''}`}>
                <input
                  type="checkbox" disabled={c.always} checked={show(c.key)}
                  onChange={() => setVisible(show(c.key) ? visible.filter((v) => v !== c.key) : [...visible, c.key])}
                />
                {c.label}
              </label>
            ))}
          </div>
        )}
      </Card>

      {loading && <TableSkeleton rows={10} cols={8} />}
      {error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && data?.total === 0 && (
        <EmptyState
          icon="◈"
          title="No statistical anomalies identified"
          description="No records match the current filters. Reset the filters to view all analysed records."
          action={<button className="btn-secondary" onClick={() => setParams({})}>Reset filters</button>}
        />
      )}

      {!loading && !error && data?.total > 0 && (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {show('risk') && <th>Risk</th>}
                  {show('record') && <th>ID</th>}
                  {show('state') && <th>State</th>}
                  {show('constituency') && <th>Constituency</th>}
                  {show('mp') && <th>MP / Member</th>}
                  {show('domain') && <th>Domain</th>}
                  {show('amount') && (
                    <th className="text-right">
                      <button onClick={() => toggleSort('amount')} className="hover:text-navy-600">Amount{sortArrow('amount')}</button>
                    </th>
                  )}
                  {show('reason') && <th>Reason</th>}
                  {show('percentile') && (
                    <th className="text-right">
                      <button onClick={() => toggleSort('percentile_rank')} className="hover:text-navy-600">Pctl{sortArrow('percentile_rank')}</button>
                    </th>
                  )}
                  {show('flags') && <th>IQR / Z / ModZ</th>}
                  {show('methods') && (
                    <th className="text-right">
                      <button onClick={() => toggleSort('method_count')} className="hover:text-navy-600">Methods{sortArrow('method_count')}</button>
                    </th>
                  )}
                  {show('score') && (
                    <th className="text-right">
                      <button onClick={() => toggleSort('anomaly_score')} className="hover:text-navy-600">Score{sortArrow('anomaly_score')}</button>
                    </th>
                  )}
                  {show('review') && <th>Review</th>}
                </tr>
              </thead>
              <tbody>
                {data.results.map((row: any) => (
                  <tr
                    key={row.record_id} className="row-clickable" tabIndex={0}
                    onClick={() => setSelected(row.record_id)}
                    onKeyDown={(e) => { if (e.key === 'Enter') setSelected(row.record_id); }}
                  >
                    {show('risk') && <td><RiskBadge classification={row.classification} short /></td>}
                    {show('record') && <td className="tabular-nums text-ink-muted">{row.record_id}</td>}
                    {show('state') && <td>{row.state || '—'}</td>}
                    {show('constituency') && <td><Constituency value={row.constituency} house={row.house} /></td>}
                    {show('mp') && <td className="font-medium text-navy-900">{row.mp_name || '—'}</td>}
                    {show('domain') && <td>{row.domain || <span className="text-2xs italic text-ink-faint">Not provided in source data</span>}</td>}
                    {show('amount') && <td className="num font-medium">{formatCompactINR(row.amount)}</td>}
                    {show('reason') && (
                      <td className="max-w-[280px] text-2xs leading-relaxed text-ink-muted">{shortReason(row)}</td>
                    )}
                    {show('percentile') && <td className="num">{row.percentile_rank?.toFixed(1)}%</td>}
                    {show('flags') && (
                      <td>
                        <span className="flex gap-1">
                          {[['IQR', row.iqr_flag], ['Z', row.z_flag], ['M', row.modz_flag]].map(([l, on]: any) => (
                            <span key={l} className={`inline-flex h-5 min-w-[26px] items-center justify-center rounded border px-1 text-[10px] font-semibold ${on ? 'border-navy-700 bg-navy-700 text-white' : 'border-line text-ink-faint'}`}>
                              {l}
                            </span>
                          ))}
                        </span>
                      </td>
                    )}
                    {show('methods') && <td className="num">{row.method_count}</td>}
                    {show('score') && <td className="num font-semibold">{row.anomaly_score}</td>}
                    {show('review') && <td><ReviewBadge status={row.review_status} /></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={(p) => setParam('page', String(p))} />
          <p className="mt-3 text-2xs text-ink-muted">
            {formatNumber(data.total)} records match. Statistical anomalies are signals requiring human review, not
            findings of wrongdoing.
          </p>
        </>
      )}

      {exportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Verify export">
          <div className="absolute inset-0 bg-navy-950/45" onClick={() => setExportOpen(false)} />
          <form onSubmit={runExport} className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-[16px] font-bold text-slate-900">Verify this export</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
              Bulk downloads are verified to keep automated scraping off this endpoint. The exported file
              carries the prototype notice — a flagged record is a screening signal, not a finding.
            </p>
            {exportError && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800" role="alert">
                {exportError}
              </div>
            )}
            <div className="mt-4">
              <Captcha value={exportCaptcha} onChange={setExportCaptcha} challenge={exportChallenge} />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setExportOpen(false)} className="btn-outline">Cancel</button>
              <button type="submit" disabled={exporting} className="btn-slate">
                {exporting ? 'Preparing…' : 'Download CSV'}
              </button>
            </div>
          </form>
        </div>
      )}

      <RecordDrawer recordId={selected} onClose={() => setSelected(null)} onUpdated={load} />
    </AdminLayout>
  );
}
