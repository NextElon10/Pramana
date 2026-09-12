import { useEffect, useRef, useState } from 'react';
import { HOUSES, useHouse, type House } from '../context/HouseContext';

/**
 * House lens for the whole portal. A custom listbox rather than a native <select> so
 * it matches the header treatment, with full keyboard support and an explicit
 * aria-label — the control changes what every figure on the page refers to, so it has
 * to be reachable without a mouse.
 */
export default function HouseSelector({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const { house, setHouse, label } = useHouse();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (value: House) => { setHouse(value); setOpen(false); };

  const trigger = tone === 'dark'
    ? 'border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-600 hover:text-white'
    : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:text-slate-900';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`House filter, currently ${label}`}
        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${trigger}`}
      >
        <span className={tone === 'dark' ? 'text-slate-400' : 'text-slate-500'}>House:</span>
        <span>{label}</span>
        <svg viewBox="0 0 16 16" className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true">
          <path d="M4 6.5 8 10.5l4-4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Filter by House"
          className="absolute right-0 z-50 mt-1.5 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {HOUSES.map((h) => (
            <li key={h.value}>
              <button
                type="button"
                role="option"
                aria-selected={h.value === house}
                onClick={() => choose(h.value)}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 ${
                  h.value === house ? 'font-semibold text-slate-900' : 'text-slate-600'
                }`}
              >
                {h.label}
                {h.value === house && <span aria-hidden="true" className="text-slate-900">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
