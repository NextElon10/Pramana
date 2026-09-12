import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';

/**
 * Language menu. A native <select> is avoided here because the option list has to
 * render each language in its own script, which several browsers refuse to do inside
 * a select on Windows.
 */
export default function LanguageSwitcher({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const { language, languages, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const trigger = tone === 'dark'
    ? 'text-white/70 hover:text-white'
    : 'text-ink-muted hover:text-navy-800';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={t('language')}
        className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] transition-colors ${trigger}`}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="6.4" stroke="currentColor" strokeWidth="1.3" />
          <path d="M1.6 8h12.8M8 1.6c1.7 1.8 2.6 4 2.6 6.4s-.9 4.6-2.6 6.4C6.3 12.6 5.4 10.4 5.4 8S6.3 3.4 8 1.6Z"
            stroke="currentColor" strokeWidth="1.3" />
        </svg>
        {language.native}
        <span aria-hidden="true" className="text-[8px]">▾</span>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={t('language')}
          className="absolute right-0 z-50 mt-1.5 max-h-[70vh] w-52 overflow-y-auto rounded-md border border-line bg-white py-1 shadow-raised"
        >
          {languages.map((l) => {
            const active = l.code === language.code;
            return (
              <li key={l.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => { setLang(l.code); setOpen(false); }}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-navy-50 ${
                    active ? 'bg-navy-50 font-semibold text-navy-900' : 'text-ink'
                  }`}
                >
                  <span dir={l.dir || 'ltr'}>{l.native}</span>
                  <span className="text-[10px] uppercase tracking-wide text-ink-faint">{l.english}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
