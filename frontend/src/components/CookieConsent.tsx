import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

const STORAGE_KEY = 'pramana.cookieConsent';

/**
 * Cookie notice.
 *
 * PRAMANA sets exactly two kinds of client-side state: an HTTP-only session cookie for
 * administrators, and localStorage entries for display preferences (language, House
 * lens, this consent record). There is no analytics, advertising or third-party
 * tracking, so the banner says that plainly rather than implying choices that do not
 * exist. Dismissing it does not silently opt anyone into anything.
 */
export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [details, setDetails] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  /**
   * The notice is a fixed bottom bar, so anything else anchored to the bottom of the
   * viewport — the PRAMANA AI launcher — would sit underneath it and be unclickable
   * until the notice is dismissed. Publishing the bar's height as a custom property
   * lets those elements lift themselves clear of it, and go back down when it closes.
   */
  useEffect(() => {
    const root = document.documentElement;
    if (!visible) {
      root.style.setProperty('--consent-inset', '0px');
      return undefined;
    }
    const measure = () => {
      const h = barRef.current?.offsetHeight ?? 0;
      root.style.setProperty('--consent-inset', `${h}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (barRef.current) observer.observe(barRef.current);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      root.style.setProperty('--consent-inset', '0px');
    };
  }, [visible, details]);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // Storage blocked: showing the notice every load is better than assuming consent.
      setVisible(true);
    }
  }, []);

  const record = (choice: 'all' | 'essential') => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ choice, at: new Date().toISOString() }));
    } catch { /* ignore */ }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      ref={barRef}
      role="region"
      aria-label="Cookie notice"
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-slate-200 bg-white/95 shadow-[0_-4px_20px_rgba(15,23,42,0.08)] backdrop-blur"
    >
      <div className="shell flex flex-wrap items-center gap-x-4 gap-y-3 py-3">
        <p className="min-w-[240px] flex-1 text-xs leading-relaxed text-slate-600">
          We use essential cookies to maintain session state and statistical preferences.
          {' '}
          <button
            onClick={() => setDetails((v) => !v)}
            className="font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900"
            aria-expanded={details}
          >
            Cookie settings
          </button>
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => record('essential')}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Essential only
          </button>
          <button
            onClick={() => record('all')}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-800"
          >
            Accept All
          </button>
        </div>

        {details && (
          <div className="w-full rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
            <p className="font-semibold text-slate-800">What PRAMANA actually stores</p>
            <ul className="mt-2 space-y-1.5">
              <li>
                <strong>Session cookie</strong> — set only when an administrator signs in. HTTP-only, so page
                scripts cannot read it. Cleared on sign-out.
              </li>
              <li>
                <strong>Display preferences</strong> — your language, your House filter and this choice, kept in
                your browser&rsquo;s local storage. They never reach the server.
              </li>
              <li>
                <strong>No analytics, advertising or third-party trackers.</strong> &ldquo;Accept All&rdquo; and
                &ldquo;Essential only&rdquo; therefore store the same things; the choice is recorded so the notice
                stops appearing.
              </li>
            </ul>
            <Link to="/policy" className="mt-3 inline-block font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900">
              Read the full policy →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
