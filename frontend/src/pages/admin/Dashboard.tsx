import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LabelList,
} from 'recharts';
import { api, formatCompactINR, formatNumber } from '../../lib/api';
import AdminLayout from '../../components/admin/AdminLayout';
import {
  KpiCard, LoadingState, ErrorState, Card, CardHead, EmptyState,
  WorkflowSteps, Advanced, RiskBadge, shortReason, Constituency,
} from '../../components/Shared';

const RISK_ORDER = ['Normal', 'Slightly Unusual', 'Unusual', 'Highly Unusual', 'Extreme Statistical Anomaly'];
const SHORT: Record<string, string> = { 'Extreme Statistical Anomaly': 'Extreme' };

/* Single-hue magnitude ramp: severity is ordered, so lightness carries the order.
   Identity never rests on colour — every bar is labelled on the axis. */
const SEVERITY_FILL = ['#9db1d1', '#6c88b6', '#4a689c', '#2b4069', '#132038'];

function ChartTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded border border-line bg-white px-3 py-2 shadow-raised">
      <div className="text-2xs font-semibold text-navy-900">{label}</div>
      <div className="mt-0.5 text-[13px] tabular-nums text-ink">
        {formatter ? formatter(payload[0].value) : formatNumber(payload[0].value)}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [kpis, setKpis] = useState<any>(null);
  const [risk, setRisk] = useState<any[]>([]);
  const [overview, setOverview] = useState<any>(null);
  const [stateTotals, setStateTotals] = useState<any[]>([]);
  const [methods, setMethods] = useState<any[]>([]);
  const [priority, setPriority] = useState<any[]>([]);
  const [error, setError] = useState('');
  const nav = useNavigate();

  const load = () => {
    setError('');
    Promise.all([
      api.get('/analytics/kpis'),
      api.get('/analytics/risk-distribution'),
      api.get('/meta/overview'),
      api.get('/analytics/charts/state-totals'),
      api.get('/analytics/charts/method-contribution'),
      // The queue an official actually acts on: unreviewed flags, highest score first.
      api.get('/anomalies?reviewStatus=Unreviewed&sort=anomaly_score&dir=desc&pageSize=5'),
    ]).then(([k, r, o, s, m, p]) => {
      setKpis(k); setRisk(r.distribution); setOverview(o);
      setStateTotals(s.states.slice(0, 10)); setMethods(m.methods);
      setPriority((p.results || []).filter((row: any) => row.classification !== 'Normal'));
    }).catch((e) => setError(e.message));
  };
  useEffect(load, []);

  if (error) return <AdminLayout title="Overview"><ErrorState message={error} onRetry={load} /></AdminLayout>;
  if (!kpis) return <AdminLayout title="Overview"><LoadingState label="Loading statistical overview…" /></AdminLayout>;

  const riskData = RISK_ORDER.map((c) => ({
    name: SHORT[c] || c,
    full: c,
    count: risk.find((r) => r.classification === c)?.c || 0,
  }));
  const hasRecords = kpis.totalRecords > 0;

  return (
    <AdminLayout
      title="Overview"
      description="Screening summary across every analysed dataset"
      actions={<button onClick={load} className="btn-secondary btn-sm">Refresh</button>}
    >
      {!hasRecords ? (
        <EmptyState
          title="No analytical dataset loaded"
          description="Upload a CSV or XLSX dataset to run the statistical screening engine."
          action={<button className="btn-primary" onClick={() => nav('/admin/datasets')}>Upload dataset</button>}
        />
      ) : (
        <div className="space-y-5">
          <WorkflowSteps current="analyse" />

          {/* What needs attention — the first thing an official should read. */}
          <Card className="overflow-hidden">
            <div className="grid gap-0 lg:grid-cols-[300px_1fr]">
              <div className="border-b border-line bg-navy-900 p-6 lg:border-b-0 lg:border-r">
                <p className="text-2xs uppercase tracking-[0.14em] text-white/50">Needs your attention</p>
                <p className="mt-3 text-4xl font-semibold tabular-nums leading-none text-white">
                  {formatNumber(kpis.requiresReview)}
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-white/70">
                  {kpis.requiresReview === 0
                    ? 'Every flagged record has been reviewed.'
                    : `record${kpis.requiresReview === 1 ? '' : 's'} carry a statistical signal and have not yet been reviewed by a person, out of ${formatNumber(kpis.totalRecords)} screened.`}
                </p>
                <button
                  onClick={() => nav('/admin/anomalies?reviewStatus=Unreviewed')}
                  className="btn-accent btn-sm mt-4"
                >
                  Open the review queue →
                </button>
              </div>

              <div className="p-5">
                <h2 className="text-sm font-semibold text-navy-900">Highest-priority records</h2>
                <p className="mt-0.5 text-2xs text-ink-muted">
                  Ranked by how many independent methods agree. A signal is a reason to look, not a finding.
                </p>

                {priority.length === 0 ? (
                  <p className="mt-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-900">
                    Nothing is waiting for review. New signals appear here as datasets are uploaded.
                  </p>
                ) : (
                  <ul className="mt-3 divide-y divide-line border-t border-line">
                    {priority.map((row) => (
                      <li key={row.record_id}>
                        <button
                          onClick={() => nav(`/admin/anomalies?q=${encodeURIComponent(row.mp_name || '')}`)}
                          className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-3 text-left transition-colors hover:bg-surface-raised"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-navy-900">{row.mp_name}</span>
                            <span className="block truncate text-2xs text-ink-muted">
                              {row.state} · <Constituency value={row.constituency} house={row.house} />
                            </span>
                          </span>
                          <span className="text-[13px] font-medium tabular-nums text-ink">
                            {formatCompactINR(row.amount)}
                          </span>
                          <RiskBadge classification={row.classification} short />
                          <span className="w-full text-2xs leading-relaxed text-ink-muted sm:w-auto sm:max-w-[46%]">
                            {shortReason(row)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Card>

          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
            <KpiCard label="Total Records" value={formatNumber(kpis.totalRecords)} hint="Across all datasets" />
            <KpiCard label="Normal" value={formatNumber(kpis.normal)} tone="good" hint="No method flagged" onClick={() => nav('/admin/anomalies?classification=Normal')} />
            <KpiCard label="Slightly Unusual" value={formatNumber(kpis.slightlyUnusual)} tone="warn" hint="1 method" onClick={() => nav('/admin/anomalies?classification=Slightly%20Unusual')} />
            <KpiCard label="Unusual" value={formatNumber(kpis.unusual)} tone="warn" hint="2 methods" onClick={() => nav('/admin/anomalies?classification=Unusual')} />
            <KpiCard label="Highly Unusual" value={formatNumber(kpis.highlyUnusual)} tone="danger" hint="3+ methods" onClick={() => nav('/admin/anomalies?classification=Highly%20Unusual')} />
            <KpiCard label="Extreme" value={formatNumber(kpis.extreme)} tone="danger" hint="Extreme threshold breached" onClick={() => nav('/admin/anomalies?classification=Extreme%20Statistical%20Anomaly')} />
            <KpiCard label="Requires Review" value={formatNumber(kpis.requiresReview)} tone="danger" hint="Unreviewed & flagged" onClick={() => nav('/admin/anomalies?reviewStatus=Unreviewed')} />
          </div>

          <Advanced
            summary="Statistical detail"
            hint="Risk distribution, cross-dataset intelligence, state totals and method contribution — every metric, kept one click away."
          >
          <div className="grid gap-4 p-4 xl:grid-cols-2">
            {/* Risk distribution */}
            <Card>
              <CardHead title="Risk Distribution" sub="Select a bar to open the filtered anomaly explorer" />
              <div className="p-4">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={riskData} layout="vertical" margin={{ top: 4, right: 44, bottom: 4, left: 4 }}>
                    <CartesianGrid horizontal={false} stroke="#eef1f5" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#5b6675' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={104} tick={{ fontSize: 11, fill: '#16202e' }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: '#f2f5f9' }} content={<ChartTooltip />} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18} cursor="pointer"
                      onClick={(d: any) => nav(`/admin/anomalies?classification=${encodeURIComponent(d.full)}`)}>
                      {riskData.map((_, i) => <Cell key={i} fill={SEVERITY_FILL[i]} />)}
                      <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: '#5b6675' }} formatter={(v: any) => formatNumber(v)} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Multi-dataset */}
            <Card>
              <CardHead
                title="Multi-Dataset Intelligence"
                sub={overview?.crossDatasetActive ? 'CROSS-DATASET ANALYSIS ACTIVATED' : 'Load a second dataset to activate cross-dataset analysis'}
              />
              <div className="p-5">
                {overview && (
                  <>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {[
                        ['Datasets', formatNumber(overview.totalDatasets)],
                        ['Entities matched', formatNumber(overview.entitiesMatched)],
                        ['Connected pairs', formatNumber(overview.datasetsConnected)],
                        ['Duplicate signals', formatNumber(overview.duplicateSignals)],
                      ].map(([l, v]) => (
                        <div key={l} className="rounded border border-line bg-surface-raised p-3">
                          <div className="text-2xs uppercase tracking-wide text-ink-muted">{l}</div>
                          <div className="mt-1 text-lg font-semibold tabular-nums text-navy-900">{v}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 space-y-2">
                      {overview.relationships.length === 0 && (
                        <p className="prose-note">Only one dataset is loaded. Independent statistical analysis is fully available; cross-dataset comparison activates automatically when a second dataset is added.</p>
                      )}
                      {overview.relationships.map((r: any, i: number) => (
                        <div key={i} className="rounded border border-line px-3 py-2.5 text-[13px]">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-ink-muted">{r.datasetA} ↔ {r.datasetB}</span>
                            <span className={`chip ${r.relationship === 'CONNECTED' ? 'chip-good' : r.relationship === 'PARTIALLY CONNECTED' ? 'chip-warn' : 'chip-neutral'}`}>
                              {r.relationship}
                            </span>
                          </div>
                          <div className="mt-1 text-2xs text-ink-faint">{formatNumber(r.matches)} entity match(es) resolved with recorded confidence</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </Card>

            {/* State totals */}
            <Card>
              <CardHead title="Top 10 States by Total Allocation" sub="Aggregated across all loaded datasets" />
              <div className="p-4">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stateTotals} layout="vertical" margin={{ top: 4, right: 86, bottom: 4, left: 4 }}>
                    <CartesianGrid horizontal={false} stroke="#eef1f5" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#5b6675' }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => `${(v / 1e9).toFixed(0)}B`} />
                    <YAxis type="category" dataKey="state" width={110} tick={{ fontSize: 11, fill: '#16202e' }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: '#f2f5f9' }} content={<ChartTooltip formatter={formatCompactINR} />} />
                    <Bar dataKey="total" fill="#365182" radius={[0, 4, 4, 0]} barSize={14}>
                      <LabelList dataKey="total" position="right" style={{ fontSize: 10, fill: '#5b6675' }} formatter={(v: any) => formatCompactINR(v)} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Method contribution */}
            <Card>
              <CardHead title="Detection Method Contribution" sub="How many records each independent method flags" />
              <div className="p-4">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={methods} margin={{ top: 16, right: 12, bottom: 4, left: 4 }}>
                    <CartesianGrid vertical={false} stroke="#eef1f5" />
                    <XAxis dataKey="method" tick={{ fontSize: 11, fill: '#16202e' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#5b6675' }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: '#f2f5f9' }} content={<ChartTooltip />} />
                    <Bar dataKey="count" fill="#365182" radius={[4, 4, 0, 0]} barSize={44}>
                      <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: '#5b6675' }} formatter={(v: any) => formatNumber(v)} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <p className="mt-2 text-2xs text-ink-muted">
                  A record flagged by several independent methods is prioritised for review. Convergence indicates
                  statistical consistency, not intent.
                </p>
              </div>
            </Card>
          </div>
          </Advanced>
        </div>
      )}
    </AdminLayout>
  );
}
