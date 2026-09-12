import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { api, formatNumber } from '../../lib/api';
import { ErrorState, LoadingState, Card, CardHead, KpiCard } from '../../components/Shared';

const EVENT_STYLE: Record<string, string> = {
  login_success: 'chip-good',
  login_failed: 'chip-warn',
  login_blocked_locked: 'chip-high',
};

export default function Security() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setError('');
    api.get('/security/dashboard').then(setData).catch((e) => setError(e.message));
  };
  useEffect(load, []);

  const terminate = async (id: string) => { await api.post(`/security/sessions/${id}/terminate`); load(); };
  const logoutOthers = async () => { await api.post('/security/sessions/logout-others'); load(); };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault(); setPwMsg(null); setBusy(true);
    try {
      await api.post('/security/change-password', pw);
      setPwMsg({ ok: true, text: 'Password updated. Existing sessions remain valid — sign other devices out if needed.' });
      setPw({ currentPassword: '', newPassword: '' });
    } catch (e: any) {
      setPwMsg({ ok: false, text: e.message });
    } finally { setBusy(false); }
  };

  if (error) return <AdminLayout title="Security"><ErrorState message={error} onRetry={load} /></AdminLayout>;
  if (!data) return <AdminLayout title="Security"><LoadingState label="Loading security status…" /></AdminLayout>;

  return (
    <AdminLayout title="Security Dashboard" description="Session, authentication and account controls">
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Signed in as" value={data.user.role} hint={data.user.email} />
        <KpiCard label="Active sessions" value={formatNumber(data.activeSessions.length)} tone="good" />
        <KpiCard label="Failed attempts (24h)" value={formatNumber(data.failedAttempts)} tone={data.failedAttempts > 0 ? 'warn' : 'default'} hint="All accounts" />
        <KpiCard label="MFA / OTP" value="Not enabled" tone="warn" hint="Not implemented in this prototype" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHead
            title="Active sessions"
            sub={`Last login: ${data.user.last_login_at || 'not recorded'}`}
            action={<button onClick={logoutOthers} className="btn-secondary btn-sm">Sign out others</button>}
          />
          <div className="divide-y divide-line">
            {data.activeSessions.length === 0 && <p className="p-5 text-[13px] text-ink-muted">No active sessions recorded.</p>}
            {data.activeSessions.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <div className="truncate text-[13px]">{s.user_agent || 'Unknown device'}</div>
                  <div className="text-2xs text-ink-muted">
                    Started {new Date(s.created_at + 'Z').toLocaleString()} · expires {new Date(s.expires_at).toLocaleString()}
                  </div>
                </div>
                <button onClick={() => terminate(s.id)} className="btn-danger btn-sm">Terminate</button>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHead title="Change password" sub="Minimum 8 characters, hashed with bcrypt" />
          <form onSubmit={changePassword} className="space-y-3 p-5">
            <div>
              <label className="field-label" htmlFor="cpw">Current password</label>
              <input id="cpw" type="password" autoComplete="current-password" className="input"
                value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
            </div>
            <div>
              <label className="field-label" htmlFor="npw">New password</label>
              <input id="npw" type="password" autoComplete="new-password" className="input"
                value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
            </div>
            <button className="btn-primary" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button>
            {pwMsg && (
              <div className={`rounded-md border px-3 py-2 text-[13px] ${pwMsg.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
                {pwMsg.text}
              </div>
            )}
          </form>
        </Card>

        <Card className="lg:col-span-2">
          <CardHead title="Recent security events" sub="Authentication activity across all accounts" />
          <div className="table-wrap border-0 shadow-none">
            <table className="data-table">
              <thead><tr><th>Timestamp (UTC)</th><th>Event</th><th>Account</th><th>IP</th><th>Detail</th></tr></thead>
              <tbody>
                {data.recentEvents.map((e: any) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap tabular-nums text-ink-muted">{e.ts}</td>
                    <td><span className={`chip ${EVENT_STYLE[e.event_type] || 'chip-neutral'}`}>{e.event_type}</span></td>
                    <td>{e.email || '—'}</td>
                    <td className="font-mono text-[11px] text-ink-muted">{e.ip}</td>
                    <td className="text-2xs text-ink-muted">{e.detail || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <p className="mt-4 text-2xs leading-relaxed text-ink-muted">
        Controls in force: bcrypt password hashing (cost 12), HTTP-only session cookies, login rate limiting,
        account lockout after 5 failed attempts, server-side RBAC, upload validation, CSV-injection protection and
        full audit logging. MFA/OTP and CSRF tokens are not implemented in this prototype and are reported here
        honestly rather than displayed as enabled.
      </p>
    </AdminLayout>
  );
}
