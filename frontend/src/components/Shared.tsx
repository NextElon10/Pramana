import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

/* ---------------- Cards & tiles ---------------- */

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function CardHead({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="card-head">
      <div>
        <div className="card-title">{title}</div>
        {sub && <div className="card-sub">{sub}</div>}
      </div>
      {action}
    </div>
  );
}

const TILE_ACCENT: Record<string, string> = {
  default: 'bg-navy-600',
  good: 'bg-emerald-600',
  warn: 'bg-amber-500',
  danger: 'bg-red-600',
};

export function KpiCard({
  label, value, hint, tone = 'default', onClick,
}: {
  label: string; value: string | number; hint?: string;
  tone?: 'default' | 'good' | 'warn' | 'danger'; onClick?: () => void;
}) {
  const Tag: any = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`card relative overflow-hidden p-4 text-left w-full ${onClick ? 'hover:shadow-raised hover:border-navy-300 transition-all' : ''}`}
    >
      <span className={`absolute left-0 top-0 h-full w-1 ${TILE_ACCENT[tone]}`} aria-hidden="true" />
      <div className="pl-2">
        <div className="stat-label">{label}</div>
        <div className="stat-value mt-2">{value}</div>
        {hint && <div className="text-2xs text-ink-faint mt-1.5">{hint}</div>}
      </div>
    </Tag>
  );
}

/* ---------------- States ---------------- */

export function EmptyState({ title, description, action, icon = '□' }: { title: string; description?: string; action?: ReactNode; icon?: string }) {
  return (
    <div className="card border-dashed p-12 text-center">
      <div className="text-3xl text-navy-200 mb-3" aria-hidden="true">{icon}</div>
      <div className="font-semibold text-navy-900 uppercase tracking-wide text-[13px]">{title}</div>
      {description && <p className="prose-note mt-2 max-w-md mx-auto">{description}</p>}
      {action && <div className="mt-5 flex justify-center gap-2">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-14 text-sm text-ink-muted" role="status" aria-live="polite">
      <span className="inline-block h-4 w-4 rounded-full border-2 border-navy-600 border-t-transparent animate-spin" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800" role="alert">
      <div className="flex items-start gap-2">
        <span aria-hidden="true" className="font-bold">!</span>
        <div className="flex-1">
          <div>{message}</div>
          {onRetry && <button onClick={onRetry} className="mt-2 underline underline-offset-2 font-medium">Try again</button>}
        </div>
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((__, c) => (
                <td key={c}><div className="h-3 rounded bg-navy-100 animate-pulse" style={{ width: `${40 + ((r + c) % 4) * 15}%` }} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Risk chips ----------------
   Severity is conveyed by symbol + text label, never colour alone. */

const RISK_STYLE: Record<string, { cls: string; symbol: string }> = {
  'Normal': { cls: 'chip-good', symbol: '●' },
  'Slightly Unusual': { cls: 'chip-warn', symbol: '▲' },
  'Unusual': { cls: 'chip-alert', symbol: '▲▲' },
  'Highly Unusual': { cls: 'chip-high', symbol: '■' },
  'Extreme Statistical Anomaly': { cls: 'chip-extreme', symbol: '✱' },
};

export function RiskBadge({ classification, short = false }: { classification: string; short?: boolean }) {
  const s = RISK_STYLE[classification] || { cls: 'chip-neutral', symbol: '•' };
  const label = short && classification === 'Extreme Statistical Anomaly' ? 'Extreme' : classification;
  return (
    <span className={`chip ${s.cls}`} title={classification}>
      <span aria-hidden="true">{s.symbol}</span>
      {label}
    </span>
  );
}

const REVIEW_STYLE: Record<string, string> = {
  'Unreviewed': 'chip-neutral',
  'Under Review': 'chip-warn',
  'Reviewed - No Issue': 'chip-good',
  'Escalated': 'chip-high',
};

export function ReviewBadge({ status }: { status: string }) {
  return <span className={`chip ${REVIEW_STYLE[status] || 'chip-neutral'}`}>{status}</span>;
}

/* ---------------- Banners ---------------- */

export function Disclaimer({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
      {children}
    </div>
  );
}

/* ---------------- Pagination ---------------- */

export function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (p: number) => void }) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 text-[13px]">
      <span className="text-ink-muted tabular-nums">
        Showing <strong className="text-ink">{from.toLocaleString('en-IN')}–{to.toLocaleString('en-IN')}</strong> of{' '}
        <strong className="text-ink">{total.toLocaleString('en-IN')}</strong>
      </span>
      <div className="flex items-center gap-2">
        <button className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>← Previous</button>
        <span className="text-ink-muted tabular-nums px-1">Page {page} of {lastPage}</span>
        <button className="btn-secondary btn-sm" disabled={page >= lastPage} onClick={() => onChange(page + 1)}>Next →</button>
      </div>
    </div>
  );
}

/**
 * Constituency, reported honestly. A Lok Sabha member represents a named constituency.
 * A Rajya Sabha member is elected by the State Legislative Assembly and has none, so an
 * empty value there describes the seat rather than a gap in the file. A genuinely
 * missing value says so. No constituency is ever inferred.
 */
export function Constituency({ value, house }: { value?: string | null; house?: string | null }) {
  if (value && !/^not (applicable|provided)/i.test(value)) return <>{value}</>;
  if (/rajya/i.test(house || '')) {
    return (
      <span
        className="text-2xs italic text-ink-faint"
        title="Rajya Sabha members are elected by the State Legislative Assembly and do not represent a parliamentary constituency."
      >
        Rajya Sabha seat
      </span>
    );
  }
  return (
    <span className="text-2xs italic text-ink-faint" title="The uploaded dataset does not carry a constituency for this record.">
      Not provided in source data
    </span>
  );
}

/* ---------------- Official workflow ---------------- */

/**
 * The five steps an official actually follows, shown in order with the current one
 * marked. It is navigation and orientation only — nothing is gated by it, and every
 * screen remains reachable from the sidebar exactly as before.
 */
const WORKFLOW = [
  { key: 'dataset', to: '/admin/datasets', label: 'Dataset', hint: 'Upload the allocation file' },
  { key: 'analyse', to: '/admin/dashboard', label: 'Analyse', hint: 'Screening runs automatically' },
  { key: 'findings', to: '/admin/anomalies', label: 'Review findings', hint: 'See what stood out' },
  { key: 'investigate', to: '/admin/investigation', label: 'Investigate', hint: 'Check a member in context' },
  { key: 'report', to: '/admin/reports', label: 'Report', hint: 'Record the outcome' },
] as const;

export type WorkflowStep = (typeof WORKFLOW)[number]['key'];

export function WorkflowSteps({ current }: { current: WorkflowStep }) {
  const currentIndex = WORKFLOW.findIndex((s) => s.key === current);
  return (
    <nav aria-label="Review workflow" className="mb-4 overflow-x-auto rounded-md border border-line bg-white shadow-card">
      <ol className="flex min-w-max items-stretch">
        {WORKFLOW.map((step, i) => {
          const isCurrent = i === currentIndex;
          const isDone = i < currentIndex;
          return (
            <li key={step.key} className="flex-1">
              <Link
                to={step.to}
                aria-current={isCurrent ? 'step' : undefined}
                className={`flex h-full items-center gap-3 border-l-4 px-4 py-3 transition-colors ${
                  isCurrent
                    ? 'border-l-saffron-500 bg-navy-50'
                    : 'border-l-transparent hover:bg-surface-raised'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums ${
                    isCurrent ? 'bg-navy-800 text-white' : isDone ? 'bg-navy-200 text-navy-800' : 'bg-navy-50 text-navy-400'
                  }`}
                >
                  {i + 1}
                </span>
                <span className="leading-tight">
                  <span className={`block text-[13px] ${isCurrent ? 'font-semibold text-navy-900' : 'text-ink'}`}>
                    {step.label}
                  </span>
                  <span className="block text-2xs text-ink-muted">{step.hint}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * A collapsed section for the technical layer. The detail is always one click away
 * and nothing is removed — it simply does not compete with the answer an official
 * needs first.
 */
export function Advanced({ summary, hint, children, defaultOpen = false }: {
  summary: string; hint?: string; children: ReactNode; defaultOpen?: boolean;
}) {
  return (
    <details className="group rounded-md border border-line bg-white shadow-card" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5">
        <span>
          <span className="text-sm font-semibold text-navy-900">{summary}</span>
          {hint && <span className="mt-0.5 block text-2xs text-ink-muted">{hint}</span>}
        </span>
        <span aria-hidden="true" className="shrink-0 text-2xs text-navy-600 transition-transform group-open:rotate-180">▼</span>
      </summary>
      <div className="border-t border-line">{children}</div>
    </details>
  );
}

/**
 * A one-line, plain-language reason for a flag, derived from the flags the screening
 * engine already recorded. This is presentation only: no threshold, score or
 * classification is recomputed here, and the full technical explanation remains
 * available on the record itself.
 */
export function shortReason(a: any): string {
  if (!a) return 'Not yet analysed.';
  if (a.classification === 'Normal') return 'Sits within the normal range for its dataset.';
  if (a.pct99_flag) return 'Above the 99th percentile of its own dataset.';
  if (a.iqr_extreme) return 'Far above the upper bound of the interquartile range.';
  if (a.z_extreme) return 'More than four standard deviations from the mean.';
  if (a.pct95_flag) return 'Above the 95th percentile of its own dataset.';
  if (a.iqr_flag) return 'Above the upper bound of the interquartile range.';
  if (a.z_flag) return 'More than three standard deviations from the mean.';
  if (a.modz_flag) return 'Far from the median on a robust (median-based) scale.';
  if (a.cross_dataset_flag) return 'Matched to a record in another loaded dataset.';
  const first = String(a.explanation || '').split(/(?<=\.)\s/)[0];
  return first || 'Flagged by the screening engine.';
}

/* ---------------- Project thumbnail ---------------- */

/**
 * Sector marks used when a record has no photograph. These are drawn from the record's
 * own `domain` value — they classify nothing on their own, and a record whose dataset
 * carries no domain gets the neutral default rather than a guessed sector.
 */
const SECTOR_ICONS: { match: RegExp; label: string; tone: string; path: ReactNode }[] = [
  {
    match: /road|highway|bridge|culvert|infrastructur|transport/i,
    label: 'Roads and infrastructure',
    tone: 'bg-slate-100 text-slate-600',
    path: (
      <>
        <path d="M4 21 9 3M20 21 15 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M12 4v3M12 10.5v3M12 17v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
  },
  {
    match: /educat|school|college|univers|library|comput|学|vidyalaya/i,
    label: 'Education',
    tone: 'bg-indigo-50 text-indigo-600',
    path: (
      <>
        <path d="M2.5 8.5 12 4.5l9.5 4-9.5 4-9.5-4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M6.5 10.6V15c0 1.4 2.5 2.6 5.5 2.6s5.5-1.2 5.5-2.6v-4.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M21 8.8v4.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
  },
  {
    match: /water|sanitat|drain|sewer|well|tank|toilet|irrigat/i,
    label: 'Water and sanitation',
    tone: 'bg-sky-50 text-sky-600',
    path: (
      <path
        d="M12 3.5s5.5 6 5.5 9.6A5.5 5.5 0 0 1 12 18.6a5.5 5.5 0 0 1-5.5-5.5C6.5 9.5 12 3.5 12 3.5Z"
        stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"
      />
    ),
  },
  {
    match: /health|hospital|medic|clinic|dispensar|ambulanc|phc/i,
    label: 'Healthcare',
    tone: 'bg-rose-50 text-rose-600',
    path: (
      <>
        <rect x="3.5" y="5.5" width="17" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 9.5v6M9 12.5h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
  },
  {
    match: /sport|stadium|playground|gym|khel/i,
    label: 'Sports',
    tone: 'bg-emerald-50 text-emerald-600',
    path: (
      <>
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 4c2.4 2 3.6 4.7 3.6 8s-1.2 6-3.6 8M12 4C9.6 6 8.4 8.7 8.4 12s1.2 6 3.6 8M4.4 9.5h15.2M4.4 14.5h15.2" stroke="currentColor" strokeWidth="1.3" />
      </>
    ),
  },
  {
    match: /electric|power|solar|light|energy/i,
    label: 'Power and lighting',
    tone: 'bg-amber-50 text-amber-600',
    path: (
      <path d="M13.5 3 6 13.2h5l-.5 7.8L18 10.8h-5l.5-7.8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    ),
  },
];

const DEFAULT_SECTOR = {
  label: 'Sector not recorded',
  tone: 'bg-slate-100 text-slate-500',
  path: (
    <>
      <rect x="3.5" y="8" width="17" height="11.5" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 8V6.2c0-.9.7-1.7 1.6-1.7h2.8c.9 0 1.6.8 1.6 1.7V8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
};

function sectorFor(domain?: string | null) {
  if (!domain) return DEFAULT_SECTOR;
  return SECTOR_ICONS.find((s) => s.match.test(domain)) || DEFAULT_SECTOR;
}

/**
 * A square thumbnail for a record.
 *
 * Shows the photograph the dataset supplied. When there is none — which is the case for
 * allocation-limit statements, and for any image that fails to load — it falls back to a
 * mark for the record's own sector. The fallback is clearly a symbol, never a stand-in
 * photograph of some other place, and its label describes the sector rather than
 * asserting that any work was built.
 */
export function ProjectThumb({ imageUrl, domain, projectName, state, size = 'md', className = '' }: {
  imageUrl?: string | null;
  domain?: string | null;
  projectName?: string | null;
  state?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const box = size === 'sm' ? 'w-12 h-12' : size === 'lg' ? 'w-24 h-24' : 'w-20 h-20';
  const sector = sectorFor(domain);
  const named = projectName && !/^not (provided|applicable)/i.test(projectName) ? projectName : null;
  const place = state && !/^not (provided|applicable)/i.test(state) ? state : null;

  if (imageUrl && !failed) {
    // Alt text is built only from fields the record actually carries.
    const alt = named
      ? `Photograph supplied with the record for ${named}${place ? `, ${place}` : ''}`
      : `Photograph supplied with this record${place ? ` from ${place}` : ''}`;
    return (
      <img
        src={imageUrl}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={`${box} aspect-square shrink-0 rounded-lg border border-slate-200 bg-slate-100 object-cover ${className}`}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={domain ? `${sector.label} — no photograph in the dataset` : 'No photograph or sector in the dataset'}
      title={domain ? `${domain} — the dataset carries no photograph` : 'The dataset carries no photograph or sector for this record'}
      className={`${box} aspect-square shrink-0 rounded-lg border border-slate-200 ${sector.tone} flex items-center justify-center ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-1/2 w-1/2" aria-hidden="true">
        {sector.path}
      </svg>
    </div>
  );
}

/** The sector mark on its own, for compact use beside a domain label. */
export function SectorMark({ domain, className = '' }: { domain?: string | null; className?: string }) {
  const sector = sectorFor(domain);
  return (
    <span
      aria-hidden="true"
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${sector.tone} ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">{sector.path}</svg>
    </span>
  );
}
