import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import EmblemPlaceholder from './EmblemPlaceholder';
import PramanaMark from './PramanaMark';
import LanguageSwitcher from './LanguageSwitcher';

/** Shared frame for every authentication screen, so they read as one system. */
export function AuthShell({
  title, subtitle, children, footer, tone = 'light', note,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  tone?: 'light' | 'dark';
  note?: ReactNode;
}) {
  const dark = tone === 'dark';

  return (
    <div className="flex min-h-dvh flex-col bg-navy-950">
      <div className="tricolour-rule" />

      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5" aria-label="PRAMANA home">
          <EmblemPlaceholder size={30} />
          <span className="h-6 w-px bg-white/20" aria-hidden="true" />
          <PramanaMark size={24} />
          <span className="text-[13px] font-bold tracking-[0.16em] text-white">PRAMANA</span>
        </Link>
        <LanguageSwitcher tone="dark" />
      </div>

      <main className="flex flex-1 items-center justify-center px-4 pb-12 pt-2">
        <div className="w-full max-w-md">
          <div
            className={`rounded-lg shadow-raised ${
              dark ? 'border border-navy-700 bg-navy-900' : 'border border-line bg-white'
            }`}
          >
            <div className={`border-b px-6 py-5 ${dark ? 'border-navy-700' : 'border-line'}`}>
              <h1 className={`text-lg ${dark ? 'text-white' : ''}`}>{title}</h1>
              {subtitle && (
                <p className={`mt-1 text-[13px] ${dark ? 'text-white/55' : 'text-ink-muted'}`}>{subtitle}</p>
              )}
            </div>

            <div className="px-6 py-5">{children}</div>

            {note && (
              <div
                className={`border-t px-6 py-3.5 text-2xs leading-relaxed ${
                  dark ? 'border-navy-700 text-white/40' : 'border-line bg-surface-raised text-ink-muted'
                }`}
              >
                {note}
              </div>
            )}
          </div>

          {footer && (
            <p className="mt-5 text-center text-2xs text-white/50">{footer}</p>
          )}
        </div>
      </main>
    </div>
  );
}

export default AuthShell;
