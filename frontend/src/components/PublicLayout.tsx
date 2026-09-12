import type { ReactNode } from 'react';
import GovernmentHeader from './GovernmentHeader';
import Footer from './Footer';
import AssistantPanel from './AssistantPanel';
import CookieConsent from './CookieConsent';
import { useLocation } from 'react-router-dom';
import { useI18n } from '../i18n';

/* Pages that present analysis rather than explanation carry the prototype watermark,
   so a screenshot of a table or chart travels with the words that qualify it. */
const ANALYTICAL = ['/projects', '/states', '/domains', '/compare'];

export default function PublicLayout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const analytical = ANALYTICAL.some((p) => pathname.startsWith(p));

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="skip-link">{t('skipToContent')}</a>
      <GovernmentHeader />
      <main
        id="main"
        className={`flex-1 ${wide ? 'w-full px-4 py-8 sm:px-6' : 'shell py-8'} ${analytical ? 'proto-watermark' : ''}`}
      >
        {children}
      </main>
      <Footer />
      <AssistantPanel />
      <CookieConsent />
    </div>
  );
}

export function PageHeading({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
      <div className="max-w-2xl">
        <h1 className="text-2xl">{title}</h1>
        {description && <p className="prose-note mt-2 text-pretty">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
