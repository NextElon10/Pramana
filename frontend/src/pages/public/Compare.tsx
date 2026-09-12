import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, formatCompactINR, formatNumber } from '../../lib/api';
import { useHouse } from '../../context/HouseContext';
import { PageHeading } from '../../components/PublicLayout';
import { ErrorState, LoadingState } from '../../components/Shared';

type Member = {
  id: number;
  mp: string;
  state: string;
  house: string;
  constituency: string | null;
  allocated: number | null;
  expenditure: number | null;
  recommended: number | null;
  utilization: number | null;
  utilizationBand: 'high' | 'medium' | 'low' | 'unknown';
  expenditureShare: number | null;
  worksCompleted: number | null;
  worksRecommended: number | null;
  worksInProgress: number | null;
  completionRate: number | null;
  transactions: number | null;
};

const MAX = 4;

const BAND_BAR: Record<string, string> = {
  high: 'bg-emerald-500', medium: 'bg-amber-500', low: 'bg-rose-500', unknown: 'bg-slate-300',
};

const ORDINAL = ['first', 'second', 'third', 'fourth'];

/** Typeahead picker over the member list for the current House. */
function MemberPicker({ slot, members, chosen, onPick, onClear }: {
  slot: number;
  members: Member[];
  chosen: Member | null;
  onPick: (m: Member) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? members.filter((m) =>
        m.mp.toLowerCase().includes(q)
        || m.state.toLowerCase().includes(q)
        || (m.constituency || '').toLowerCase().includes(q))
      : members;
    return pool.slice(0, 40);
  }, [members, query]);

  if (chosen) {
    return (
      <div className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-slate-900">{chosen.mp}</p>
            <p className="mt-0.5 truncate text-2xs text-slate-500">
              {chosen.constituency || chosen.house} · {chosen.state}
            </p>
          </div>
          <button
            onClick={onClear}
            className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label={`Remove ${chosen.mp} from the comparison`}
          >
            Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <label htmlFor={`picker-${slot}`} className="sr-only">
        {slot === 0 ? 'Select first MP or constituency' : `Select ${ORDINAL[slot]} to compare`}
      </label>
      <input
        id={`picker-${slot}`}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
        placeholder={slot === 0 ? 'Select first MP / constituency' : slot === 1 ? 'Select second to compare' : '+ Add MP'}
        className="w-full rounded-xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-700 placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
      />
      {open && (
        <ul
          role="listbox"
          className="absolute z-40 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {matches.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">No members match that search.</li>}
          {matches.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                role="option"
                aria-selected="false"
                onClick={() => { onPick(m); setQuery(''); setOpen(false); }}
                className="w-full px-3 py-2 text-left transition-colors hover:bg-slate-50"
              >
                <span className="block truncate text-[13px] font-medium text-slate-900">{m.mp}</span>
                <span className="block truncate text-2xs text-slate-500">
                  {m.constituency || m.house} · {m.state}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MetricRow({ label, values, render }: {
  label: string;
  values: (Member | null)[];
  render: (m: Member) => React.ReactNode;
}) {
  return (
    <tr className="border-b border-slate-100 last:border-b-0">
      <th scope="row" className="whitespace-nowrap px-4 py-3 text-left text-[12px] font-medium text-slate-500">{label}</th>
      {values.map((m, i) => (
        <td key={i} className="px-4 py-3 text-[13px] text-slate-900">
          {m ? render(m) : <span className="text-slate-300">—</span>}
        </td>
      ))}
    </tr>
  );
}

const na = <span className="text-2xs italic text-slate-400">Not in dataset</span>;

export default function Compare() {
  const { house, param, label } = useHouse();
  const [params, setParams] = useSearchParams();
  const [members, setMembers] = useState<Member[]>([]);
  const [selected, setSelected] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState<string[]>([]);

  // The member list follows the portal-wide House lens.
  useEffect(() => {
    setLoading(true); setError('');
    api.get(`/performance/members${param()}`)
      .then((d) => setMembers(d.members || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [house]);

  // Selection is mirrored into the URL so a comparison can be linked or bookmarked.
  useEffect(() => {
    const ids = (params.get('ids') || '').split(',').filter(Boolean);
    if (!ids.length) { setSelected([]); setNotes([]); return; }
    api.get(`/performance/compare?ids=${ids.join(',')}`)
      .then((d) => { setSelected(d.members || []); setNotes(d.notes || []); })
      .catch(() => { setSelected([]); setNotes([]); });
  }, [params]);

  const setIds = (ids: number[]) => {
    const next = new URLSearchParams(params);
    if (ids.length) next.set('ids', ids.join(',')); else next.delete('ids');
    setParams(next);
  };

  const pick = (slot: number, m: Member) => {
    const ids = selected.map((s) => s.id);
    ids[slot] = m.id;
    setIds(ids.filter(Boolean));
  };
  const clear = (slot: number) => setIds(selected.filter((_, i) => i !== slot).map((s) => s.id));

  const slots = Math.min(MAX, Math.max(2, selected.length + 1));
  const slotList = Array.from({ length: slots }, (_, i) => selected[i] || null);
  const maxUtil = Math.max(100, ...selected.map((m) => m.utilization || 0));

  return (
    <div>
      <PageHeading
        title="Compare constituencies"
        description="Compare performance and fund utilisation across different constituencies and MPs."
      />

      {error && <ErrorState message={error} onRetry={() => window.location.reload()} />}
      {loading && <LoadingState label="Loading members…" />}

      {!loading && !error && (
        <>
          <div className={`mb-6 grid gap-3 ${slots <= 2 ? 'sm:grid-cols-2' : slots === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4'}`}>
            {slotList.map((m, i) => (
              <MemberPicker
                key={i}
                slot={i}
                members={members.filter((c) => !selected.some((s) => s.id === c.id))}
                chosen={m}
                onPick={(picked) => pick(i, picked)}
                onClear={() => clear(i)}
              />
            ))}
          </div>

          {selected.length < 2 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <p className="text-[15px] font-semibold text-slate-900">Select at least two members to compare</p>
              <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-slate-600">
                Search by member name, constituency or state. Up to four can be compared side by side, drawn
                from the {label} records currently loaded.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Metric matrix */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full min-w-[640px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="w-44 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Metric
                      </th>
                      {slotList.map((m, i) => (
                        <th key={i} className="px-4 py-3 text-left">
                          <span className="block truncate text-[13px] font-bold text-slate-900">{m ? m.mp : '—'}</span>
                          {m && <span className="block truncate text-2xs font-normal text-slate-500">{m.state}</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-slate-50/60">
                      <td colSpan={slots + 1} className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Profile
                      </td>
                    </tr>
                    <MetricRow label="Constituency" values={slotList} render={(m) => m.constituency || (
                      <span className="text-2xs italic text-slate-400" title="Rajya Sabha members are elected by the State Legislative Assembly and do not represent a constituency.">
                        Rajya Sabha seat
                      </span>
                    )} />
                    <MetricRow label="State / UT" values={slotList} render={(m) => m.state} />
                    <MetricRow label="House" values={slotList} render={(m) => m.house || na} />

                    <tr className="bg-slate-50/60">
                      <td colSpan={slots + 1} className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Financial
                      </td>
                    </tr>
                    <MetricRow label="Total allocated" values={slotList} render={(m) => (
                      <span className="font-semibold tabular-nums">{m.allocated === null ? na : formatCompactINR(m.allocated)}</span>
                    )} />
                    <MetricRow label="Amount recommended" values={slotList} render={(m) => (
                      <span className="tabular-nums">{m.recommended === null ? na : formatCompactINR(m.recommended)}</span>
                    )} />
                    <MetricRow label="Total spent" values={slotList} render={(m) => (
                      <span className="tabular-nums">{m.expenditure === null ? na : formatCompactINR(m.expenditure)}</span>
                    )} />
                    <MetricRow label="Fund utilisation" values={slotList} render={(m) => (
                      m.utilization === null ? na : (
                        <span className="inline-flex items-center gap-2">
                          <span className="font-semibold tabular-nums">{m.utilization.toFixed(1)}%</span>
                          <span className="inline-block h-2 w-16 overflow-hidden rounded-full bg-slate-100">
                            <span className={`block h-full rounded-full ${BAND_BAR[m.utilizationBand]}`} style={{ width: `${Math.min(100, m.utilization)}%` }} />
                          </span>
                        </span>
                      )
                    )} />
                    <MetricRow label="Share actually paid" values={slotList} render={(m) => (
                      <span className="tabular-nums">{m.expenditureShare === null ? na : `${m.expenditureShare.toFixed(1)}%`}</span>
                    )} />

                    <tr className="bg-slate-50/60">
                      <td colSpan={slots + 1} className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Works
                      </td>
                    </tr>
                    <MetricRow label="Recommended" values={slotList} render={(m) => (
                      <span className="tabular-nums">{m.worksRecommended === null ? na : formatNumber(m.worksRecommended)}</span>
                    )} />
                    <MetricRow label="Completed" values={slotList} render={(m) => (
                      <span className="tabular-nums">{m.worksCompleted === null ? na : formatNumber(m.worksCompleted)}</span>
                    )} />
                    <MetricRow label="Not yet completed" values={slotList} render={(m) => (
                      <span className="tabular-nums">{m.worksInProgress === null ? na : formatNumber(m.worksInProgress)}</span>
                    )} />
                    <MetricRow label="Completion rate" values={slotList} render={(m) => (
                      <span className="tabular-nums">{m.completionRate === null ? na : `${m.completionRate.toFixed(1)}%`}</span>
                    )} />
                  </tbody>
                </table>
              </div>

              {/* Overlay comparison */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-[15px] font-semibold text-slate-900">Fund utilisation side by side</h2>
                <p className="mt-1 text-2xs text-slate-500">
                  Recommended amount as a share of allocation, with the share actually paid shown beneath it.
                </p>
                <div className="mt-5 space-y-4">
                  {selected.map((m) => (
                    <div key={m.id}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-[13px] font-medium text-slate-800">{m.mp}</span>
                        <span className="shrink-0 text-[13px] font-semibold tabular-nums text-slate-900">
                          {m.utilization === null ? '—' : `${m.utilization.toFixed(1)}%`}
                        </span>
                      </div>
                      <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full transition-[width] duration-500 ${BAND_BAR[m.utilizationBand]}`}
                          style={{ width: `${Math.min(100, ((m.utilization || 0) / maxUtil) * 100)}%` }}
                        />
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-50">
                          <div
                            className="h-full rounded-full bg-slate-400"
                            style={{ width: `${Math.min(100, ((m.expenditureShare || 0) / maxUtil) * 100)}%` }}
                          />
                        </div>
                        <span className="w-24 shrink-0 text-right text-2xs tabular-nums text-slate-500">
                          {m.expenditureShare === null ? '—' : `${m.expenditureShare.toFixed(1)}% paid`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900 shadow-sm">
                <strong>Reading this comparison.</strong> Allocation varies legitimately with a member&rsquo;s
                term length, House and date of entry, so a lower total is not a lower effort. Utilisation and
                completion rates describe the pace of a pipeline, not the conduct of any member.
                {notes.map((n) => <span key={n} className="mt-1 block">{n}</span>)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
