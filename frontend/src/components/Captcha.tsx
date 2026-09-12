import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

export type CaptchaState = { id: string; answer: string };

/**
 * Arithmetic verification, checked on the server.
 *
 * The component never knows the correct answer — it renders the question the server
 * issued and hands back what the person typed. `onChange` gives the parent form the
 * id/answer pair to submit, and `refresh` is exposed so a failed submit can swap in
 * the fresh challenge the server returns with the error.
 */
export default function Captcha({ value, onChange, tone = 'light', challenge }: {
  value: CaptchaState;
  onChange: (v: CaptchaState) => void;
  tone?: 'light' | 'dark';
  /** A replacement challenge handed back by a failed request. */
  challenge?: { id: string; question: string } | null;
}) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const c = await api.get('/auth/captcha');
      setQuestion(c.question);
      onChange({ id: c.id, answer: '' });
    } catch {
      setQuestion('');
    } finally {
      setLoading(false);
    }
  }, [onChange]);

  useEffect(() => { load(); /* once on mount */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A failed submit returns a new challenge; adopt it rather than making the user reload.
  useEffect(() => {
    if (challenge?.id) {
      setQuestion(challenge.question);
      onChange({ id: challenge.id, answer: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge?.id]);

  const dark = tone === 'dark';

  return (
    <div>
      <label className={`field-label ${dark ? 'text-white/50' : ''}`} htmlFor="captcha-answer">
        Verification
      </label>
      <div className="flex items-center gap-2">
        <span
          className={`select-none whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold tabular-nums ${
            dark ? 'bg-navy-950 text-white/90 ring-1 ring-navy-600' : 'bg-slate-100 text-slate-800 ring-1 ring-slate-200'
          }`}
          aria-hidden="true"
        >
          {loading ? '…' : question || 'unavailable'}
        </span>
        <input
          id="captcha-answer"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          required
          value={value.answer}
          onChange={(e) => onChange({ ...value, answer: e.target.value })}
          aria-label={question ? `${question} Enter the answer.` : 'Verification answer'}
          placeholder="Answer"
          className={
            dark
              ? 'w-28 rounded border border-navy-600 bg-navy-950 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-saffron-500 focus:outline-none focus:ring-2 focus:ring-saffron-500/25'
              : 'w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-900/10'
          }
        />
        <button
          type="button"
          onClick={load}
          className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
            dark ? 'text-white/55 hover:bg-white/10 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          New question
        </button>
      </div>
      <p className={`mt-1.5 text-2xs ${dark ? 'text-white/40' : 'text-slate-500'}`}>
        Checked on the server. The answer is never sent to your browser.
      </p>
    </div>
  );
}
