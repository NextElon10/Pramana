import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { AuthShell } from '../../components/AuthShell';
import { ErrorState, LoadingState } from '../../components/Shared';
import PasswordInput from '../../components/PasswordInput';

type Strength = { score: number; label: string; tone: string };

function assess(pw: string): Strength {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 2) return { score, label: 'Weak', tone: 'bg-red-500' };
  if (score === 3) return { score, label: 'Fair', tone: 'bg-amber-500' };
  if (score === 4) return { score, label: 'Good', tone: 'bg-emerald-500' };
  return { score, label: 'Strong', tone: 'bg-emerald-600' };
}

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const nav = useNavigate();

  const [checking, setChecking] = useState(true);
  const [account, setAccount] = useState<{ email: string; role: string } | null>(null);
  const [tokenError, setTokenError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) { setTokenError('This link is missing its reset token.'); setChecking(false); return; }
    api.get(`/password/verify?token=${encodeURIComponent(token)}`)
      .then((d) => setAccount({ email: d.email, role: d.role }))
      .catch((e) => setTokenError(e.message))
      .finally(() => setChecking(false));
  }, [token]);

  const strength = assess(password);
  const mismatch = confirm.length > 0 && confirm !== password;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('The two passwords do not match.'); return; }
    setBusy(true);
    try {
      await api.post('/password/reset', { token, password });
      setDone(true);
      setTimeout(() => nav('/admin/login'), 2200);
    } catch (err: any) {
      setError(err.message || 'The password could not be changed.');
    } finally {
      setBusy(false);
    }
  };


  return (
    <AuthShell
      title="Choose a new password"
      subtitle={account ? `Resetting the password for ${account.email}` : 'Verifying your reset link'}
      note="Changing your password signs you out of every device."
      footer={<Link className="link" to="/admin/login">Back to sign in</Link>}
    >
      {checking && <LoadingState label="Checking your reset link…" />}

      {!checking && tokenError && (
        <div className="space-y-4">
          <ErrorState message={tokenError} />
          <Link to="/forgot-password" className="btn-primary w-full">Request a new link</Link>
        </div>
      )}

      {!checking && done && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-900">
          Your password has been changed. Redirecting you to sign in.
        </div>
      )}

      {!checking && account && !done && (
        <form onSubmit={submit} className="space-y-4">
          {error && <ErrorState message={error} />}

          <PasswordInput
            label="New password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            required
            hint="At least 8 characters. Longer passphrases are stronger than short complex ones."
          />

          {password.length > 0 && (
            <div>
              <div className="flex gap-1" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className={`h-1 flex-1 rounded-full ${i < strength.score ? strength.tone : 'bg-navy-100'}`}
                  />
                ))}
              </div>
              <p className="mt-1 text-2xs text-ink-muted">Password strength: {strength.label}</p>
            </div>
          )}

          <PasswordInput
            label="Confirm new password"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            required
          />
          {mismatch && <p className="text-2xs text-red-700">The two passwords do not match.</p>}

          <button className="btn-primary w-full" disabled={busy || password.length < 8 || mismatch}>
            {busy ? 'Updating…' : 'Change password'}
          </button>

          <p className="text-2xs text-ink-muted">
            You will sign in again at /admin/login. Every existing session is revoked.
          </p>
        </form>
      )}
    </AuthShell>
  );
}
