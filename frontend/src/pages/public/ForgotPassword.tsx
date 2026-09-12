import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { AuthShell } from '../../components/AuthShell';
import { ErrorState } from '../../components/Shared';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [devPath, setDevPath] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const res = await api.post('/password/forgot', { email });
      setSent(true);
      setDevPath(res.devResetPath || null);
    } catch (err: any) {
      setError(err.message || 'The request could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Account recovery for official / administrator accounts. The public portal needs no account."
      tone="dark"
      footer={
        <>
          Remembered it?{' '}
          <Link className="link" to="/admin/login">Back to sign in</Link>
        </>
      }
    >
      {sent ? (
        <div className="space-y-4">
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-900">
            If an account exists for <strong>{email}</strong>, a reset link has been generated. It is valid for
            30 minutes and can be used once.
          </div>

          {devPath ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
              <p className="font-semibold">Development mode</p>
              <p className="mt-1">
                No mail server is configured for this prototype, so the link is shown here and printed to the
                backend console. In a deployment it would be emailed and never returned to the browser.
              </p>
              <Link to={devPath} className="btn-primary btn-sm mt-3">Open the reset link</Link>
            </div>
          ) : (
            <p className="prose-note">Check your inbox for the reset link.</p>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <ErrorState message={error} />}
          <div>
            <label className="field-label" htmlFor="fp-email">Email</label>
            <input
              id="fp-email" type="email" required autoComplete="email" className="input"
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="official@department.gov.in"
            />
          </div>
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'Generating link…' : 'Send reset link'}
          </button>
          <p className="text-2xs leading-relaxed text-ink-muted">
            For your security we return the same message whether or not an account exists, and reset
            requests are rate limited.
          </p>
        </form>
      )}
    </AuthShell>
  );
}
