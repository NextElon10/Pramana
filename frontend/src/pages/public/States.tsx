import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatCompactINR, formatNumber } from '../../lib/api';
import { useHouse } from '../../context/HouseContext';
import { PageHeading } from '../../components/PublicLayout';
import { ErrorState, LoadingState, EmptyState } from '../../components/Shared';

type StateRow = {
  id: number;
  state: string;
  mps: number;
  allocated: number;
  expenditure: number | null;
  recommended: number | null;
  utilization: number | null;
  utilizationBand: 'high' | 'medium' | 'low' | 'unknown';
  expenditureShare: number | null;
  worksCompleted: number | null;
  worksRecommended: number | null;
  completionRate: number | null;
};

type Payload = {
  house: string;
  states: StateRow[];
  totals: {
    mps: number; allocated: number; expenditure: number; recommended: number;
    worksCompleted: number; worksRecommended: number;
    utilization: number | null; expenditureShare: number | null; completionRate: number | null;
  };
  bandDefinition: { high: string; medium: string; low: string; basis: string };
};

const BANDS = [
  { value: 'all', label: 'All states' },
  { value: 'high', label: 'High (≥80%)' },
  { value: 'medium', label: 'Medium (50–79%)' },
  { value: 'low', label: 'Low (<50%)' },
];

/* Utilisation is an ordered quantity, so the bar carries the band colour — but the
   percentage is always printed beside it and the band is named in the tooltip, so the
   reading never depends on colour alone. */
const BAND_BAR: Record<string, string> = {
  high: 'bg-emerald-500',
  medium: 'bg-amber-500',
  low: 'bg-rose-500',
  unknown: 'bg-slate-300',
};
const BAND_TEXT: Record<string, string> = {
  high: 'text-emerald-700',
  medium: 'text-amber-700',
  low: 'text-rose-700',
  unknown: 'text-slate-500',
};
const BAND_NAME: Record<string, string> = {
  high: 'High utilisation',
  medium: 'Medium utilisation',
  low: 'Low utilisation',
  unknown: 'Not in dataset',
};

function UtilBar({ value, band }: { value: number | null; band: string }) {
  if (value === null) {
    return <span className="text-2xs italic text-slate-400">Not provided in source data</span>;
  }
  return (
    <div className="min-w-[140px]" title={`${BAND_NAME[band]} — ${value.toFixed(1)}%`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className={`text-[13px] font-semibold tabular-nums ${BAND_TEXT[band]}`}>{value.toFixed(1)}%</span>
        <span className="text-[10px] uppercase tracking-wide text-slate-400">{BAND_NAME[band].replace(' utilisation', '')}</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${BAND_BAR[band]}`}
          style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

export default function States() {
  const { house, param, label } = useHouse();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [band, setBand] = useState('all');
  const [view, setView] = useState<'list' | 'grid'>('list');

  const load = () => {
    setLoading(true); setError('');
    api.get(`/performance/states${param()}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  // Refetches whenever the portal-wide House lens changes.
  useEffect(load, [house]);

  /* Search and band filtering run client-side so typing stays instant; the server
     supports the same parameters for the CSV export and for direct API use. */
  const rows = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.states.filter((r) => {
      if (q && !r.state.toLowerCase().includes(q)) return false;
      if (band !== 'all' && r.utilizationBand !== band) return false;
      return true;
    });
  }, [data, query, band]);

  const downloadHref = `/api/performance/states.csv${param()}`;

  return (
    <div>
      <PageHeading
        title="Browse states and UTs"
        description={`Fund utilisation and works delivery for every state and union territory, aggregated from the ${label} records loaded into PRAMANA.`}
      />

      {/* Toolbar */}
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative min-w-[220px] flex-1">
          <label htmlFor="state-filter" className="sr-only">Filter states and UTs</label>
          <svg viewBox="0 0 20 20" fill="none" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true">
            <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.6" />
            <path d="M13.2 13.2 17 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            id="state-filter"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="search-field"
            placeholder="Filter states and UTs…"
          />
        </div>

        <div>
          <label htmlFor="band-filter" className="sr-only">Filter by utilisation</label>
          <select
            id="band-filter"
            value={band}
            onChange={(e) => setBand(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 pr-8 text-sm text-slate-700 hover:border-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          >
            {BANDS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </div>

        <div className="flex items-center rounded-lg border border-slate-300 bg-white p-0.5" role="group" aria-label="View mode">
          {(['list', 'grid'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                view === v ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        <a
          href={downloadHref}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
            <path d="M10 3.5v9M6.5 9.5 10 13l3.5-3.5M4 15.5h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Download report
        </a>
      </div>

      {loading && <LoadingState label="Loading state performance…" />}
      {error && <ErrorState message={error} onRetry={load} />}

      {!loading && !error && data && (
        <>
          {/* Totals strip — the same aggregation, for the current lens */}
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              ['States and UTs', formatNumber(data.states.length)],
              ['Members', formatNumber(data.totals.mps)],
              ['Total allocated', formatCompactINR(data.totals.allocated)],
              ['Total expenditure', data.totals.expenditure ? formatCompactINR(data.totals.expenditure) : '—'],
              ['Works completed', formatNumber(data.totals.worksCompleted)],
            ].map(([l, v]) => (
              <div key={l} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{l}</div>
                <div className="mt-1 text-lg font-extrabold tabular-nums tracking-tight text-slate-900">{v}</div>
              </div>
            ))}
          </div>

          {rows.length === 0 ? (
            <EmptyState
              icon="⌕"
              title="No states match these filters"
              description="Try a different utilisation band, or clear the search."
              action={<button className="btn-outline" onClick={() => { setQuery(''); setBand('all'); }}>Clear filters</button>}
            />
          ) : view === 'list' ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    {['ID', 'State / UT', 'MPs', 'Total allocated', 'Total expenditure', 'Fund utilisation', 'Works completed', 'Works recommended'].map((h, i) => (
                      <th
                        key={h}
                        className={`px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600 ${i >= 2 && i !== 5 ? 'text-right' : ''}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.state} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                      <td className="px-3 py-3 tabular-nums text-slate-400">{r.id}</td>
                      <td className="px-3 py-3">
                        <Link
                          to={`/projects?state=${encodeURIComponent(r.state)}`}
                          className="font-medium text-slate-900 hover:underline"
                        >
                          {r.state}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-700">{formatNumber(r.mps)}</td>
                      <td className="px-3 py-3 text-right font-medium tabular-nums text-slate-900">{formatCompactINR(r.allocated)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                        {r.expenditure === null ? <span className="text-2xs italic text-slate-400">—</span> : formatCompactINR(r.expenditure)}
                      </td>
                      <td className="px-3 py-3"><UtilBar value={r.utilization} band={r.utilizationBand} /></td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                        {r.worksCompleted === null ? '—' : formatNumber(r.worksCompleted)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                        {r.worksRecommended === null ? '—' : formatNumber(r.worksRecommended)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((r) => (
                <div key={r.state} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <Link to={`/projects?state=${encodeURIComponent(r.state)}`} className="text-[15px] font-semibold text-slate-900 hover:underline">
                      {r.state}
                    </Link>
                    <span className="shrink-0 text-2xs text-slate-500">{formatNumber(r.mps)} MPs</span>
                  </div>
                  <div className="mt-3 text-xl font-extrabold tabular-nums tracking-tight text-slate-900">
                    {formatCompactINR(r.allocated)}
                  </div>
                  <div className="mt-0.5 text-2xs text-slate-500">
                    {r.expenditure === null ? 'Expenditure not in dataset' : `${formatCompactINR(r.expenditure)} spent`}
                  </div>
                  <div className="mt-4"><UtilBar value={r.utilization} band={r.utilizationBand} /></div>
                  <div className="mt-4 flex justify-between border-t border-slate-100 pt-3 text-2xs text-slate-500">
                    <span>{r.worksCompleted === null ? '—' : formatNumber(r.worksCompleted)} completed</span>
                    <span>{r.worksRecommended === null ? '—' : formatNumber(r.worksRecommended)} recommended</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="mt-4 text-2xs leading-relaxed text-slate-500">
            Fund utilisation is {data.bandDefinition.basis}, exactly as the source extract defines it, and is
            shown separately from the expenditure that has actually been paid out. Bands are a reading aid —
            high {data.bandDefinition.high}, medium {data.bandDefinition.medium}, low {data.bandDefinition.low} —
            and a low band describes a rate of spending, not any finding about the state or its members.
          </p>
        </>
      )}
    </div>
  );
}
