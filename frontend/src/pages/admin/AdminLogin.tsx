import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { AuthShell } from '../../components/AuthShell';
import PasswordInput from '../../components/PasswordInput';
import Captcha, { type CaptchaState } from '../../components/Captcha';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [captcha, setCaptcha] = useState<CaptchaState>({ id: '', answer: '' });
  // A rejected attempt returns a fresh challenge, which the field adopts in place.
  const [newChallenge, setNewChallenge] = useState<{ id: string; question: string } | null>(null);
  const { refresh } = useAuth();
  const nav = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await api.post('/auth/admin/login', {
        email, password, captchaId: captcha.id, captchaAnswer: captcha.answer,
      });
      await refresh();
      nav('/admin/dashboard');
    } catch (err: any) {
      setError(err.message || 'Sign-in failed.');
      if (err.body?.captcha) setNewChallenge(err.body.captcha);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      tone="dark"
      title="Secure administrator access"
      subtitle="Authorised personnel only."
      note="Sessions use secure, HTTP-only cookies. Login attempts are rate limited, repeated failures lock the account, and every administrative action is written to the audit log."
      footer={
        <>
          Not an administrator?{' '}
          <Link to="/" className="text-white/75 underline underline-offset-2">
            Browse the public portal — no account needed
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-[13px] text-red-200" role="alert">
            {error}
          </div>
        )}

        <div>
          <label className="field-label text-white/50" htmlFor="aemail">Email</label>
          <input
            id="aemail" type="email" required autoComplete="username" value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-navy-600 bg-navy-950 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-saffron-500 focus:outline-none focus:ring-2 focus:ring-saffron-500/25"
          />
        </div>

        <PasswordInput
          id="apassword"
          tone="dark"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          required
        />

        <Captcha value={captcha} onChange={setCaptcha} tone="dark" challenge={newChallenge} />

        <button type="submit" disabled={loading} className="btn-accent w-full">
          {loading ? 'Verifying…' : 'Log in'}
        </button>

        <div className="text-center text-[12px]">
          <Link to="/forgot-password" className="text-white/50 underline underline-offset-2 hover:text-white/80">
            Forgot password?
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}
