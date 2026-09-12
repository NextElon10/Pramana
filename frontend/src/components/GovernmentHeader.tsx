import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import EmblemPlaceholder from './EmblemPlaceholder';
import LanguageSwitcher from './LanguageSwitcher';
import HouseSelector from './HouseSelector';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';
import type { StringKey } from '../i18n';

const navItems: { to: string; key: StringKey; end?: boolean }[] = [
  { to: '/', key: 'nav.home', end: true },
  { to: '/projects', key: 'nav.projects' },
  { to: '/states', key: 'nav.states' },
  { to: '/compare', key: 'nav.compare' },
  { to: '/about', key: 'nav.about' },
];

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M13.2 13.2 17 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default function GovernmentHeader() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();

  const signOut = async () => { await logout(); nav('/'); };

  // Search is a real query against the record explorer, not decoration.
  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    nav(q ? `/projects?q=${encodeURIComponent(q)}` : '/projects');
    setOpen(false);
  };

  return (
    <header>
      {/* Government ribbon. The scheme context line sits alongside a permanent
          "prototype, not an official portal" marker, so the styling can read as a
          government service without the page ever claiming to be one. */}
      <div className="bg-slate-900 text-slate-300 border-b border-slate-800">
        <div className="shell flex items-center justify-between gap-4 py-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <EmblemPlaceholder className="h-5 w-5 shrink-0 opacity-80" />
            <p className="truncate text-xs font-normal">
              <span className="uppercase tracking-wide">Government of India</span>
              <span className="mx-2 text-slate-600" aria-hidden="true">|</span>
              <span>Ministry of Statistics &amp; PI</span>
              <span className="mx-2 text-slate-600" aria-hidden="true">|</span>
              <span className="text-slate-400">PRAMANA (MPLADS Integrity)</span>
              <span className="mx-2 hidden text-slate-600 sm:inline" aria-hidden="true">|</span>
              <span className="hidden text-slate-500 sm:inline">Prototype</span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <a href="#main" className="hidden text-[11px] transition-colors hover:text-white sm:inline">
              {t('skipToContent')}
            </a>
            <span aria-hidden="true" className="hidden text-slate-600 sm:inline">|</span>
            <LanguageSwitcher tone="dark" />
          </div>
        </div>
      </div>

      {/* Main header */}
      <div className="border-b border-slate-200 bg-white">
        <div className="shell flex items-center gap-6">
          <Link
            to="/"
            aria-label="PRAMANA — go to homepage"
            className="flex shrink-0 items-center gap-3 rounded-sm py-3.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
          >
            <EmblemPlaceholder className="h-9 w-9 rounded-full ring-1 ring-slate-200" />
            <span className="font-display text-xl font-extrabold tracking-tight text-slate-900">PRAMANA</span>
          </Link>

          <nav className="hidden items-center gap-7 md:flex flex-1 justify-center" aria-label="Primary">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `top-link ${isActive ? 'top-link-active' : ''}`}
              >
                {t(item.key)}
              </NavLink>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-4">
            <div className="hidden xl:block"><HouseSelector /></div>

            <form onSubmit={submitSearch} className="relative hidden w-52 lg:block" role="search">
              <label htmlFor="site-search" className="sr-only">{t('action.search')}</label>
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                <SearchIcon />
              </span>
              <input
                id="site-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="search-field"
                placeholder={t('action.search')}
              />
            </form>

            {user ? (
              <div className="hidden items-center gap-2.5 md:flex">
                <span className="text-right text-[11px] leading-tight text-slate-500 mr-2">
                  <span className="block font-semibold text-slate-800">{user.name || user.email}</span>
                  <span className="uppercase tracking-wide">{user.role}</span>
                </span>
                <Link to="/admin/dashboard" className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-4 py-2 rounded-lg">Admin Portal</Link>
                <button onClick={signOut} className="text-sm font-medium text-slate-500 hover:text-slate-900 ml-2">
                  {t('auth.signOut')}
                </button>
              </div>
            ) : (
              <Link to="/admin/login" className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-4 py-2 rounded-lg hidden md:inline-flex">Admin Portal</Link>
            )}

            <button
              className="ml-auto py-3 text-sm font-medium text-slate-700 md:hidden"
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              aria-controls="primary-nav"
            >
              <span aria-hidden="true">☰</span> Menu
            </button>
          </div>
        </div>

        {/* Mobile navigation */}
        {open && (
          <div id="primary-nav" className="border-t border-slate-200 px-4 pb-4 md:hidden">
            <div className="mt-3"><HouseSelector /></div>
            <form onSubmit={submitSearch} className="relative my-3" role="search">
              <label htmlFor="site-search-m" className="sr-only">{t('action.search')}</label>
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                <SearchIcon />
              </span>
              <input
                id="site-search-m" type="search" value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="search-field" placeholder={t('action.search')}
              />
            </form>
            <ul className="space-y-1">
              {navItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to} end={item.end} onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `block rounded-md px-3 py-2 text-[15px] font-medium ${isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-600'}`}
                  >
                    {t(item.key)}
                  </NavLink>
                </li>
              ))}
              <li className="pt-2">
                {user
                  ? <button onClick={signOut} className="btn-outline w-full">{t('auth.signOut')}</button>
                  : <Link to="/admin/login" className="btn-slate-sm w-full" onClick={() => setOpen(false)}>Admin Portal</Link>}
              </li>
            </ul>
          </div>
        )}
      </div>
    </header>
  );
}
