import { useState, type ReactNode } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import PramanaMark from '../PramanaMark';
import AssistantPanel from '../AssistantPanel';

const GROUPS: { label: string; links: { to: string; label: string; icon: string }[] }[] = [
  {
    label: 'Analysis',
    links: [
      { to: '/admin/dashboard', label: 'Overview', icon: '◱' },
      { to: '/admin/anomalies', label: 'Anomaly Explorer', icon: '◈' },
      { to: '/admin/investigation', label: 'Investigation', icon: '◎' },
    ],
  },
  {
    label: 'Data',
    links: [
      { to: '/admin/datasets', label: 'Datasets', icon: '▤' },
      { to: '/admin/reports', label: 'Reports', icon: '▦' },
    ],
  },
  {
    label: 'Governance',
    links: [
      { to: '/admin/audit', label: 'Audit Log', icon: '☰' },
      { to: '/admin/security', label: 'Security', icon: '⚿' },
      { to: '/admin/ai', label: 'AI Configuration', icon: '◇' },
    ],
  },
];

export default function AdminLayout({ children, title, description, actions }: {
  children: ReactNode; title: string; description?: string; actions?: ReactNode;
}) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();

  const signOut = async () => { await logout(); nav('/admin/login'); };

  return (
    <div className="flex min-h-screen bg-surface-sunken">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col bg-navy-950 lg:static lg:translate-x-0 transition-transform ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-4">
          <PramanaMark size={26} />
          <div className="leading-tight">
            <div className="text-[13px] font-bold tracking-[0.14em] text-white">PRAMANA</div>
            <div className="text-[9px] uppercase tracking-[0.16em] text-saffron-500">Admin Portal</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-2" aria-label="Administrator sections">
          {GROUPS.map((g) => (
            <div key={g.label}>
              <div className="section-label">{g.label}</div>
              {g.links.map((l) => (
                <NavLink
                  key={l.to} to={l.to} onClick={() => setOpen(false)}
                  className={({ isActive }) => `side-link ${isActive ? 'side-link-active' : ''}`}
                >
                  <span aria-hidden="true" className="text-white/40">{l.icon}</span>
                  {l.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 px-4 py-3">
          <div className="truncate text-[12px] font-medium text-white/85">{user?.email}</div>
          <div className="text-[10px] uppercase tracking-wide text-white/35">{user?.role}</div>
          <div className="mt-2.5 flex gap-2">
            <button onClick={signOut} className="btn btn-sm border-white/20 bg-white/10 text-white hover:bg-white/20">Logout</button>
            <Link to="/" className="btn btn-sm border-white/20 bg-transparent text-white/70 hover:bg-white/10">Public site</Link>
          </div>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-navy-950/50 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-20 border-b border-line bg-white">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <button className="btn-secondary btn-sm lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation">☰</button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base">{title}</h1>
              {description && <p className="mt-0.5 truncate text-2xs text-ink-muted">{description}</p>}
            </div>
            {actions}
            <span className="hidden xl:block text-2xs text-ink-faint">Prototype — not the official e-SAKSHI portal</span>
          </div>
        </div>

        <div className="proto-watermark flex-1 p-4 sm:p-6">{children}</div>
      </div>

      {/* The same assistant as the public site, but signed in: it can also answer on the
          review queue, datasets, reports, the audit trail and security status. */}
      <AssistantPanel variant="admin" />
    </div>
  );
}
