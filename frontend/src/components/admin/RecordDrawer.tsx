import { useEffect, useState } from 'react';
import { api, formatINR, formatCompactINR } from '../../lib/api';
import { RiskBadge, LoadingState, ErrorState, Constituency, shortReason } from '../Shared';

const STATUSES = ['Unreviewed', 'Under Review', 'Reviewed - No Issue', 'Escalated'];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line bg-surface-raised px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-ink-muted">{label}</div>
      <div className="mt-0.5 text-[13px] font-medium tabular-nums text-ink">{value}</div>
    </div>
  );
}

export default function RecordDrawer({ recordId, onClose, onUpdated }: {
  recordId: number | null; onClose: () => void; onUpdated?: () => void;
}) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('Unreviewed');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!recordId) return;
    setData(null); setError(''); setSaved(false);
    api.get(`/anomalies/${recordId}`)
      .then((d) => {
        setData(d);
        setStatus(d.anomaly?.review_status || 'Unreviewed');
        setNotes(d.anomaly?.review_notes || '');
      })
      .catch((e) => setError(e.message));
  }, [recordId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (recordId) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [recordId, onClose]);

  if (!recordId) return null;

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/reviews/${recordId}`, { status, notes });
      setSaved(true);
      onUpdated && onUpdated();
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e.message);
    } finally { setSaving(false); }
  };

  const r = data?.record;
  const a = data?.anomaly;
  const s = data?.distributionSummary;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Record detail">
      <div className="absolute inset-0 bg-navy-950/45 animate-fade-in" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-panel animate-slide-in">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <div className="text-2xs uppercase tracking-wide text-ink-muted">Record #{recordId}</div>
            <h2 className="mt-0.5 truncate text-base">{r?.mp_name || 'Record detail'}</h2>
          </div>
          <button onClick={onClose} className="btn-secondary btn-sm">Close ✕</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {error && <div className="p-5"><ErrorState message={error} /></div>}
          {!data && !error && <LoadingState label="Loading record…" />}

          {data && (
            <div className="space-y-6 p-5">
              {/* Header summary */}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  {a && <RiskBadge classification={a.classification} />}
                  {a && <span className="chip chip-neutral">{a.method_count} method(s) agree</span>}
                  {a && <span className="chip chip-neutral">Score {a.anomaly_score}</span>}
                </div>
                <div className="mt-4 rounded-md border border-line bg-surface-raised p-4">
                  <div className="stat-label">Allocated amount</div>
                  <div className="stat-value mt-1.5">{formatINR(r.amount)}</div>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-[13px]">
                  <div className="flex gap-2">
                    <dt className="text-ink-muted">State:</dt>
                    <dd className={r.state ? '' : 'italic text-ink-faint'}>{r.state || 'Not provided in source data'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-ink-muted">Constituency:</dt>
                    <dd><Constituency value={r.constituency} house={r.house} /></dd>
                  </div>
                  {[
                    ['District', r.district], ['Domain', r.domain],
                    ['House', r.house], ['Financial year', r.financial_year],
                  ].map(([l, v]) => (
                    <div key={l as string} className="flex gap-2">
                      <dt className="text-ink-muted">{l}:</dt>
                      <dd className={v ? '' : 'italic text-ink-faint'}>{v || 'Not provided in source data'}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Why flagged — the plain-language answer comes first. The full
                  technical evidence is one click below, unchanged. */}
              <section>
                <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-navy-900">Why was this flagged?</h3>
                <div className={`rounded-md border px-4 py-3 ${a?.classification === 'Normal' ? 'border-line bg-surface-raised' : 'border-amber-300 bg-amber-50'}`}>
                  <p className={`text-[14px] font-medium ${a?.classification === 'Normal' ? 'text-ink' : 'text-amber-900'}`}>
                    {shortReason(a)}
                  </p>
                  <p className={`mt-2 text-[13px] leading-relaxed ${a?.classification === 'Normal' ? 'text-ink-muted' : 'text-amber-900/90'}`}>
                    {a?.explanation}
                  </p>
                  {a?.classification !== 'Normal' && (
                    <p className="mt-2 border-t border-amber-300/60 pt-2 text-2xs leading-relaxed text-amber-900/80">
                      This is a screening signal for human review, not a finding of wrongdoing. Allocation limits
                      vary legitimately with a member&rsquo;s term length, house and date of entry.
                    </p>
                  )}
                </div>
              </section>

              {/* Statistical evidence */}
              {s && (
                <details className="group rounded-md border border-line">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                    <span>
                      <span className="text-[13px] font-semibold text-navy-900">View statistical details</span>
                      <span className="mt-0.5 block text-2xs text-ink-muted">
                        IQR, Z-score, Modified Z-score, percentiles and the anomaly score
                      </span>
                    </span>
                    <span aria-hidden="true" className="shrink-0 text-2xs text-navy-600 transition-transform group-open:rotate-180">▼</span>
                  </summary>
                  <div className="border-t border-line p-4">
                  <p className="mb-3 text-2xs text-ink-muted">Computed from this dataset's own distribution of {s.count} values.</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <Stat label="Actual amount" value={formatCompactINR(r.amount)} />
                    <Stat label="Mean" value={formatCompactINR(s.mean)} />
                    <Stat label="Median" value={formatCompactINR(s.median)} />
                    <Stat label="Q1" value={formatCompactINR(s.q1)} />
                    <Stat label="Q3" value={formatCompactINR(s.q3)} />
                    <Stat label="IQR" value={formatCompactINR(s.iqr)} />
                    <Stat label="IQR upper bound" value={formatCompactINR(s.iqrUpper)} />
                    <Stat label="MAD" value={formatCompactINR(s.mad)} />
                    <Stat label="Std deviation" value={formatCompactINR(s.stddev)} />
                    <Stat label="95th percentile" value={formatCompactINR(s.p95)} />
                    <Stat label="99th percentile" value={formatCompactINR(s.p99)} />
                    <Stat label="Percentile rank" value={`${a?.percentile_rank?.toFixed(1)}%`} />
                    <Stat label="Z-score" value={a?.z_score?.toFixed(2) ?? '—'} />
                    <Stat label="Modified Z-score" value={a?.mod_z_score?.toFixed(2) ?? '—'} />
                    <Stat label="Method count" value={String(a?.method_count ?? 0)} />
                  </div>
                  </div>
                </details>
              )}

              {/* Cross dataset */}
              {data.crossDatasetSignals?.length > 0 && (
                <section>
                  <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-navy-900">Cross-dataset signals</h3>
                  <div className="space-y-2">
                    {data.crossDatasetSignals.map((c: any, i: number) => (
                      <div key={i} className="rounded border border-line px-3 py-2 text-[13px]">
                        <div className="flex items-center justify-between gap-2">
                          <span>Matched in <strong>{c.matchedDataset}</strong></span>
                          <span className={`chip ${c.confidence >= 0.9 ? 'chip-good' : 'chip-warn'}`}>
                            {c.confidence >= 0.9 ? 'MATCH' : 'POSSIBLE MATCH'} · {(c.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="mt-1 text-2xs text-ink-muted">Resolution method: {c.match_type}</div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Review */}
              <section className="rounded-md border border-line bg-surface-raised p-4">
                <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-navy-900">Human review</h3>
                <label className="field-label" htmlFor="rstatus">Review status</label>
                <select id="rstatus" className="select mb-3" value={status} onChange={(e) => setStatus(e.target.value)}>
                  {STATUSES.map((s2) => <option key={s2} value={s2}>{s2}</option>)}
                </select>
                <label className="field-label" htmlFor="rnotes">Reviewer notes</label>
                <textarea id="rnotes" className="textarea mb-3" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="Record the verification steps taken and the basis for this decision." />
                <div className="flex items-center gap-3">
                  <button onClick={save} disabled={saving} className="btn-primary btn-sm">{saving ? 'Saving…' : 'Save review'}</button>
                  {saved && <span className="text-2xs text-emerald-700">Saved and written to the audit log.</span>}
                </div>
                {a?.reviewer && (
                  <p className="mt-3 border-t border-line pt-2 text-2xs text-ink-muted">
                    Last reviewed by {a.reviewer} · {a.reviewed_at}
                  </p>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
