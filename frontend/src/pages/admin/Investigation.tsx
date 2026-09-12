import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import { api, formatCompactINR, formatINR, formatNumber } from '../../lib/api';
import { Card, CardHead, LoadingState, ErrorState, RiskBadge, EmptyState, Disclaimer, Constituency, WorkflowSteps } from '../../components/Shared';

export default function Investigation() {
  const [params, setParams] = useSearchParams();
  const [members, setMembers] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState('');

  const selectedName = params.get('mp') || '';

  useEffect(() => {
    api.get('/analytics/mps')
      .then((d) => setMembers(d.mps))
      .catch((e) => setError(e.message))
      .finally(() => setListLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedName) { setProfile(null); return; }
    setLoading(true); setError('');
    api.get(`/analytics/mps/${encodeURIComponent(selectedName)}/profile`)
      .then(setProfile)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedName]);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const list = f
      ? members.filter((m) => (m.mp_name || '').toLowerCase().includes(f) || (m.state || '').toLowerCase().includes(f))
      : members;
    return list.slice(0, 120);
  }, [members, filter]);

  const select = (name: string) => {
    const next = new URLSearchParams(params);
    next.set('mp', name);
    setParams(next);
  };

  return (
    <AdminLayout title="Investigation Workspace" description="Member-level statistical profile, peer comparison and related records">
      <WorkflowSteps current="investigate" />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr] items-start">
        {/* Member picker */}
        <Card className="lg:sticky lg:top-20">
          <CardHead title="Members" sub="Ranked by total allocation in loaded datasets" />
          <div className="border-b border-line p-3">
            <label className="sr-only" htmlFor="mfilter">Filter members</label>
            <input id="mfilter" className="input" placeholder="Filter by name or state" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            {listLoading && <LoadingState label="Loading members…" />}
            {!listLoading && filtered.length === 0 && (
              <p className="p-4 text-[13px] text-ink-muted">No members match that filter.</p>
            )}
            {filtered.map((m) => (
              <button
                key={`${m.mp_name}-${m.state}`}
                onClick={() => select(m.mp_name)}
                className={`block w-full border-b border-line px-4 py-2.5 text-left transition-colors hover:bg-navy-50 ${
                  selectedName === m.mp_name ? 'bg-navy-50 border-l-2 border-l-navy-700' : ''}`}
              >
                <div className="truncate text-[13px] font-medium text-navy-900">{m.mp_name}</div>
                <div className="mt-0.5 flex items-center justify-between text-2xs text-ink-muted">
                  <span className="truncate">{m.state}</span>
                  <span className="tabular-nums">{formatCompactINR(m.total)}</span>
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* Profile */}
        <div className="space-y-4">
          {error && <ErrorState message={error} />}
          {loading && <LoadingState label="Building investigation profile…" />}

          {!selectedName && !loading && (
            <EmptyState icon="◎" title="Select a member to begin" description="Choose a member from the list to open their statistical profile, peer comparison and related records." />
          )}

          {profile && !loading && (
            <>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4">
                  <div>
                    <h2 className="text-lg">{profile.mp}</h2>
                    <p className="mt-1 text-[13px] text-ink-muted">
                      <Constituency value={profile.constituency} house={profile.house} /> · {profile.state} · {profile.house || 'House not recorded'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="stat-label">Total allocation</div>
                    <div className="stat-value mt-1">{formatCompactINR(profile.totalAllocation)}</div>
                    <div className="mt-1 text-2xs text-ink-muted">{formatNumber(profile.projectCount)} record(s)</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
                  {[
                    ['Average', formatCompactINR(profile.avgAllocation)],
                    ['Median', formatCompactINR(profile.medianAllocation)],
                    ['State median', formatCompactINR(profile.peerComparison.stateMedian)],
                    ['National median', formatCompactINR(profile.peerComparison.nationalMedian)],
                  ].map(([l, v]) => (
                    <div key={l} className="bg-white px-4 py-3">
                      <div className="text-[10px] uppercase tracking-wide text-ink-muted">{l}</div>
                      <div className="mt-0.5 text-[13px] font-semibold tabular-nums text-navy-900">{v}</div>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHead title="Peer comparison" sub="Compared against state and national distributions" />
                  <div className="p-5 space-y-3 text-[13px]">
                    <div className="flex justify-between border-b border-line pb-2">
                      <span className="text-ink-muted">National percentile</span>
                      <span className="font-semibold tabular-nums">{profile.peerComparison.percentileNational.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between border-b border-line pb-2">
                      <span className="text-ink-muted">Deviation from state median</span>
                      <span className="font-semibold tabular-nums">
                        {formatCompactINR(profile.avgAllocation - profile.peerComparison.stateMedian)}
                      </span>
                    </div>
                    <p className="text-2xs leading-relaxed text-ink-muted">
                      Peers are members appearing in the same state within the loaded datasets. Allocation limits vary
                      legitimately with term length, house and entry date.
                    </p>
                  </div>
                </Card>

                <Card>
                  <CardHead title="Statistical signals" sub="Flags raised by the screening engine" />
                  <div className="p-5">
                    <div className="text-3xl font-semibold tabular-nums text-navy-900">
                      {formatNumber(profile.anomalySignals.count)}
                      <span className="ml-2 text-sm font-normal text-ink-muted">of {formatNumber(profile.projectCount)} record(s)</span>
                    </div>
                    <div className="mt-4 space-y-2">
                      {profile.anomalySignals.records.filter((r: any) => r.classification !== 'Normal').slice(0, 4).map((r: any) => (
                        <div key={r.id} className="rounded border border-line p-3">
                          <RiskBadge classification={r.classification} short />
                          <p className="mt-1.5 text-2xs leading-relaxed text-ink-muted">{r.explanation}</p>
                        </div>
                      ))}
                      {profile.anomalySignals.count === 0 && (
                        <p className="text-[13px] text-ink-muted">No statistical anomalies identified for this member.</p>
                      )}
                    </div>
                  </div>
                </Card>
              </div>

              <Card>
                <CardHead title="Related records" sub="All records for this member across loaded datasets" />
                <div className="table-wrap border-0 shadow-none">
                  <table className="data-table">
                    <thead>
                      <tr><th>State</th><th>Constituency</th><th>Domain</th><th>House</th><th className="text-right">Allocation</th></tr>
                    </thead>
                    <tbody>
                      {profile.projects.map((p: any) => (
                        <tr key={p.id}>
                          <td>{p.state}</td>
                          <td><Constituency value={p.constituency} house={p.house} /></td>
                          <td>{p.domain || <span className="text-2xs italic text-ink-faint">Not provided in source data</span>}</td>
                          <td>{p.house || '—'}</td>
                          <td className="num font-medium">{formatINR(p.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Disclaimer>{profile.disclaimer}</Disclaimer>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
