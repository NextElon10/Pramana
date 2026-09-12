import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import IndiaMap from '../../components/IndiaMap';
import { api, formatCompactINR, formatNumber } from '../../lib/api';
import { useI18n } from '../../i18n';
import { useHouse } from '../../context/HouseContext';

type Summary = {
  members: number; states: number; allocated: number;
  expenditure: number | null; utilization: number | null;
  worksCompleted: number | null; flagged: number; normal: number;
};
type StateRow = {
  state: string; mps: number; allocated: number;
  expenditure: number | null; utilization: number | null;
};

const METHODS = [
  ['IQR rule', 'Flags values above Q3 + 1.5 × IQR, and treats those above Q3 + 3 × IQR as extreme.'],
  ['Z-score', 'Flags a value more than three standard deviations from the mean.'],
  ['Modified Z-score', 'Uses the median and MAD, so a few large values cannot hide the rest.'],
  ['Percentile position', 'Places each value against the 95th and 99th percentile of its own dataset.'],
];

/* ---------- icons: simple line marks, decorative only ---------- */
const Icon = {
  rupee: (
    <svg viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px]"><path d="M6 4h8M6 7.5h8M12.5 4c0 2.5-1.6 3.5-4 3.5h-.5L13 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  users: (
    <svg viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px]"><circle cx="7.5" cy="7" r="2.6" stroke="currentColor" strokeWidth="1.5" /><path d="M3 16c0-2.5 2-4.2 4.5-4.2S12 13.5 12 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M13.5 5.2a2.6 2.6 0 0 1 0 4.6M14.5 11.9c1.6.5 2.7 1.9 2.7 4.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
  ),
  map: (
    <svg viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px]"><path d="M10 17s5-4.6 5-8a5 5 0 0 0-10 0c0 3.4 5 8 5 8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><circle cx="10" cy="8.6" r="1.8" stroke="currentColor" strokeWidth="1.5" /></svg>
  ),
  flag: (
    <svg viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px]"><path d="M5 17V3.5M5 4.2h9.2l-1.8 3 1.8 3H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
};

function KpiTile({ label, value, icon, tone, children }: {
  label: string; value: string; icon: ReactNode; tone: string; children?: ReactNode;
}) {
  return (
    <div className="kpi-tile">
      <div className="flex items-start justify-between gap-3">
        <p className="kpi-label">{label}</p>
        <span className={`kpi-icon ${tone}`} aria-hidden="true">{icon}</span>
      </div>
      <p className="kpi-value">{value}</p>
      {children}
    </div>
  );
}

export default function Home() {
  const { t } = useI18n();
  const { house, param } = useHouse();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [states, setStates] = useState<StateRow[]>([]);
  const [feed, setFeed] = useState<any[]>([]);

  useEffect(() => {
    api.get(`/performance/summary${param()}`).then(setSummary).catch(() => setSummary(null));
    api.get(`/performance/states${param()}`).then((d) => setStates(d.states || [])).catch(() => setStates([]));
    // Members with the highest utilisation in the current House lens.
    api.get(`/performance/members${param()}`)
      .then((d) => setFeed([...(d.members || [])]
        .filter((m: any) => m.utilization !== null)
        .sort((a: any, b: any) => (b.utilization - a.utilization) || (b.worksCompleted - a.worksCompleted))
        .slice(0, 3)))
      .catch(() => setFeed([]));
  }, [house]);

  const top = states.slice(0, 8);
  const max = top.length ? top[0].allocated : 1;
  const screened = summary ? summary.flagged + summary.normal : 0;
  const flaggedShare = screened ? (summary!.flagged / screened) * 100 : 0;

  return (
    <div className="space-y-12">
      {/* ---------- Hero + KPI grid ---------- */}
      <section className="grid items-start gap-8 lg:grid-cols-[1fr_1fr] lg:gap-12">
        <div className="pt-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-200/70 text-slate-800 text-xs font-semibold rounded-full mb-3">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>STATISTICAL TRANSPARENCY PORTAL
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            {t('home.title')}
          </h1>
          <p className="mt-3 max-w-lg text-base leading-relaxed text-slate-600">
            {t('home.subtitle')}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/projects" className="bg-slate-900 text-white rounded-lg px-4 py-2.5 font-medium text-sm">{t('home.exploreProjects')}</Link>
            <Link to="/states" className="border border-slate-300 bg-white text-slate-700 rounded-lg px-4 py-2.5 font-medium text-sm">{t('home.viewStates')}</Link>
          </div>
        </div>

        <div>
          <div className="grid gap-4 sm:grid-cols-2">
            <KpiTile
              label="Total Allocation"
              value={summary ? formatCompactINR(summary.allocated) : '—'}
              icon={Icon.rupee}
              tone="bg-amber-50 text-amber-700"
            >
              {/* Real utilisation for the current lens, not a decorative fill. */}
              <div className="mt-3">
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-slate-800 transition-[width] duration-500"
                    style={{ width: `${Math.min(100, summary?.utilization ?? 0)}%` }}
                  />
                </div>
                <p className="mt-1.5 text-2xs text-slate-500">
                  {summary?.utilization != null ? `${summary.utilization.toFixed(1)}% recommended against allocation` : 'Utilisation not in dataset'}
                </p>
              </div>
            </KpiTile>

            <KpiTile
              label="Members Covered"
              value={summary ? formatNumber(summary.members) : '—'}
              icon={Icon.users}
              tone="bg-sky-50 text-sky-700"
            />

            <KpiTile
              label="States and UTs"
              value={summary ? formatNumber(summary.states) : '—'}
              icon={Icon.map}
              tone="bg-violet-50 text-violet-700"
            />

            <KpiTile
              label="Works Completed"
              value={summary?.worksCompleted != null ? formatNumber(summary.worksCompleted) : '—'}
              icon={
                <svg viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px]">
                  <path d="M14.5 6L7.5 14L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
              tone="bg-emerald-50 text-emerald-700"
            />
          </div>

          <div className="mt-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 text-xs font-medium flex gap-2 shadow-sm">
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0" aria-hidden="true"><circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" /><path d="M10 6.2v4.4M10 13.4v.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            <span>
              <strong>Note:</strong> PRAMANA is an analytical prototype. Not official. A flagged record is a statistical signal for human review, never a finding of wrongdoing.
            </span>
          </div>
        </div>
      </section>

      {/* ---------- Project Map and Impact ---------- */}
      <section>
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Project Map and Impact</h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr] [&>*]:min-w-0">
          <div className="relative min-h-[380px] w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <IndiaMap />
          </div>

          {/* Highest-utilisation members in the current lens. Real members, real
              figures — the MPLADS extract carries no project photographs or titles,
              so this shows the performance the data does describe. */}
          <div className="min-w-0 space-y-4">
            {feed.slice(0, 3).map((m: any) => {
              const band = m.utilizationBand as 'high' | 'medium' | 'low' | 'unknown';
              const tone = band === 'high' ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                : band === 'medium' ? 'bg-amber-100 text-amber-800 border-amber-200'
                : band === 'low' ? 'bg-rose-100 text-rose-800 border-rose-200'
                : 'bg-slate-100 text-slate-700 border-slate-200';
              const bandLabel = band === 'high' ? 'High utilisation'
                : band === 'medium' ? 'Medium utilisation'
                : band === 'low' ? 'Low utilisation' : 'Utilisation not recorded';
              return (
                <Link
                  key={m.id}
                  to={`/compare?ids=${m.id}`}
                  className="flex min-w-0 gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300"
                >
                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div className="min-w-0">
                      <span className={`mb-2 inline-block rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>
                        {bandLabel}
                      </span>
                      <h3 className="truncate text-sm font-bold text-slate-900" title={m.mp}>{m.mp}</h3>
                      <p className="mt-1 truncate text-xs text-slate-600">
                        {m.constituency || 'Rajya Sabha seat'} · {m.state}
                      </p>
                    </div>
                    <div className="mt-3 text-sm font-semibold text-slate-900">
                      {m.allocated ? formatCompactINR(m.allocated) : '—'}{' '}
                      <span className="text-xs font-normal text-slate-500">allocated</span>
                    </div>
                  </div>
                  <div className="flex w-20 shrink-0 flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
                    <span className="text-lg font-extrabold tabular-nums text-slate-900">
                      {m.utilization === null ? '—' : `${Math.round(m.utilization)}%`}
                    </span>
                    <span className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">used</span>
                    <span className="mt-1.5 text-[10px] tabular-nums text-slate-500">
                      {m.worksCompleted === null ? '' : `${m.worksCompleted} done`}
                    </span>
                  </div>
                </Link>
              );
            })}
            <Link to="/compare" className="btn-outline w-full">Compare members →</Link>
          </div>
        </div>
      </section>

      {/* ---------- Allocation across India ----------
          Built entirely from the loaded records. There is no project-location or
          sector data in MPLADS allocation-limit statements, so this reports the
          distribution that does exist rather than inventing a map of works. */}
      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Allocation across India</h2>
            <p className="mt-1 text-[13px] text-slate-600">
              Every figure below is summed from the {summary ? formatNumber(summary.members) : ''} members
              currently loaded.
            </p>
          </div>
          <Link to="/states" className="btn-outline">{t('home.viewStates')}</Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
          {/* State ranking */}
          <div className="panel">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-[15px] font-semibold text-slate-900">Largest state totals</h3>
              <span className="text-2xs text-slate-500">Allocated limits</span>
            </div>

            {top.length === 0 ? (
              <p className="mt-4 text-[13px] text-slate-500">No records are loaded yet.</p>
            ) : (
              <ol className="mt-4 space-y-3">
                {top.map((s, i) => (
                  <li key={s.state}>
                    <Link
                      to={`/projects?state=${encodeURIComponent(s.state)}`}
                      className="group block rounded-md p-1.5 -m-1.5 transition-colors hover:bg-slate-50"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="flex min-w-0 items-baseline gap-2.5">
                          <span className="w-4 shrink-0 text-2xs font-semibold tabular-nums text-slate-400">{i + 1}</span>
                          <span className="truncate text-[13px] font-medium text-slate-800 group-hover:text-slate-900">
                            {s.state}
                          </span>
                        </span>
                        <span className="shrink-0 text-[13px] font-semibold tabular-nums text-slate-900">
                          {formatCompactINR(s.allocated)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-3 pl-6">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-slate-800 transition-[width] duration-500"
                            style={{ width: `${Math.max(2, (s.allocated / max) * 100)}%` }}
                          />
                        </div>
                        <span className="shrink-0 text-2xs tabular-nums text-slate-500">
                          {formatNumber(s.mps)} members
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Screening summary + method list */}
          <div className="min-w-0 space-y-4">
            <div className="panel">
              <h3 className="text-[15px] font-semibold text-slate-900">Screening outcome</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="pill pill-good">
                  ● Within normal range · {summary ? formatNumber(summary.normal) : '—'}
                </span>
                <span className="pill pill-warn">
                  ▲ Flagged for review · {summary ? formatNumber(summary.flagged) : '—'}
                </span>
              </div>
              {screened > 0 && (
                <div className="mt-4 flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full bg-emerald-500" style={{ width: `${100 - flaggedShare}%` }} />
                  <div className="h-full bg-amber-500" style={{ width: `${flaggedShare}%` }} />
                </div>
              )}
              <p className="mt-3 text-[13px] leading-relaxed text-slate-600">
                Thresholds come from each dataset&rsquo;s own distribution, so nothing is hard-coded. A record is
                flagged when independent methods agree that it sits far from the rest — which is a reason to
                look, not a conclusion.
              </p>
            </div>

            <div className="panel">
              <h3 className="text-[15px] font-semibold text-slate-900">{t('home.howScreened')}</h3>
              <ol className="mt-4 space-y-3.5">
                {METHODS.map(([name, detail], i) => (
                  <li key={name} className="flex gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold tabular-nums text-slate-700">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-[13px] font-semibold text-slate-800">{name}</p>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-slate-600">{detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <Link
                to="/about"
                className="mt-4 inline-block text-[13px] font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900"
              >
                {t('home.readMethodology')} →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- What PRAMANA does ---------- */}
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          [t('home.transparency'), 'Every field shown comes from the source file. Fields the source does not carry are labelled, never filled in.'],
          [t('home.screening'), 'Four independent statistical tests run per dataset, computed from that dataset’s own distribution.'],
          [t('home.humanReview'), 'A flag opens a review, not a verdict. Reviewers record what they checked and why.'],
        ].map(([title, body]) => (
          <div key={title} className="panel">
            <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-600">{body}</p>
          </div>
        ))}
      </section>

      {/* ---------- Reading the results ---------- */}
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
        <h2 className="text-base font-bold text-amber-900">{t('home.readingResults')}</h2>
        <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-amber-900">
          {t('footer.disclaimer')} Allocation limits vary legitimately with a member&rsquo;s term length, house
          and date of entry — a figure well above or below the median is usually explained by those factors
          alone. Every individual figure is visible on the record it came from.
        </p>
        <Link
          to="/about"
          className="mt-4 inline-block text-[13px] font-medium text-amber-900 underline underline-offset-2"
        >
          {t('home.readMethodology')} →
        </Link>
      </section>
    </div>
  );
}
