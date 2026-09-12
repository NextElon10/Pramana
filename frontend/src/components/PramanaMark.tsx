// Original PRAMANA mark — a document/ledger with a verification check, deliberately
// distinct from the State Emblem / Ashoka Lion Capital. Do not modify to resemble it.
export default function PramanaMark({ size = 34, tone = 'light' }: { size?: number; tone?: 'light' | 'dark' }) {
  // `tone="dark"` renders the document panel light so the mark stays legible on a dark strip.
  const panel = tone === 'dark' ? '#e7eef7' : '#0d2a52';
  const rule = tone === 'dark' ? '#0d2a52' : '#e7eef7';
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="6" y="4" width="30" height="40" rx="2" fill={panel} />
      <rect x="10" y="10" width="22" height="2.4" fill={rule} />
      <rect x="10" y="16" width="22" height="2.4" fill={rule} />
      <rect x="10" y="22" width="14" height="2.4" fill={rule} />
      <circle cx="32" cy="34" r="11" fill="#ff9933" stroke="#0d2a52" strokeWidth="2" />
      <path d="M27 34l3.2 3.4L38 29" stroke="#0d2a52" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
