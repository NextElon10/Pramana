import { useEffect, useRef, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { api } from '../../lib/api';
import { Card, CardHead, ErrorState, LoadingState } from '../../components/Shared';

type SuggestedModel = { id: string; label: string };

type Status = {
  configured: boolean;
  engine: 'builtin' | 'model';
  builtinAlwaysAvailable?: boolean;
  provider: 'gemini' | 'openai' | 'nvidia' | 'moonshot' | 'none';
  providerLabel: string;
  suggestedModels: SuggestedModel[];
  source: 'admin' | 'environment' | 'none';
  baseUrl: string;
  model: string;
  key: { masked: string; length: number } | null;
  updatedAt: string | null;
  updatedBy: string | null;
  envKeyPresent: boolean;
};

type Result = { ok: boolean; text: string; detail?: string | null };

export default function AiSettings() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [reveal, setReveal] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [busy, setBusy] = useState<'save' | 'test' | 'clear' | 'upload' | 'engine' | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  // 'configured' means a key is stored; 'connected' is only claimed after a real,
  // successful call to the provider, so the badge never overstates what is known.
  const [verified, setVerified] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setError('');
    api.get('/admin/settings/ai')
      .then((s: Status) => { setStatus(s); setBaseUrl(s.baseUrl); setModel(s.model); })
      .catch((e) => setError(e.message));
  };
  useEffect(load, []);

  const apply = (s: Status, text: string) => {
    setStatus(s); setBaseUrl(s.baseUrl); setModel(s.model);
    setApiKey(''); setReveal(false); setVerified(false);
    setResult({ ok: true, text });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('save'); setResult(null);
    try {
      const res = await api.put('/admin/settings/ai', { apiKey, baseUrl, model });
      apply(res, res.message);
    } catch (err: any) {
      setResult({ ok: false, text: err.message });
    } finally { setBusy(null); }
  };

  const uploadKeyFile = async (file: File) => {
    setBusy('upload'); setResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.upload('/admin/settings/ai/upload', form);
      apply(res, res.message);
    } catch (err: any) {
      setResult({ ok: false, text: err.message });
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const test = async () => {
    setBusy('test'); setResult(null);
    try {
      const res = await api.post('/admin/settings/ai/test');
      setVerified(Boolean(res.ok));
      setResult({ ok: res.ok, text: res.message, detail: res.detail });
    } catch (err: any) {
      setResult({ ok: false, text: err.message });
    } finally { setBusy(null); }
  };

  const setEngine = async (engine: 'builtin' | 'model') => {
    if (status?.engine === engine) return;
    setBusy('engine'); setResult(null);
    try {
      const res = await api.put('/admin/settings/ai/engine', { engine });
      setStatus(res);
      setResult({ ok: true, text: res.message });
    } catch (err: any) {
      setResult({ ok: false, text: err.message });
    } finally { setBusy(null); }
  };

  const clear = async () => {
    setBusy('clear'); setResult(null);
    try {
      const res = await api.delete('/admin/settings/ai');
      apply(res, res.message);
    } catch (err: any) {
      setResult({ ok: false, text: err.message });
    } finally { setBusy(null); }
  };

  if (error) return <AdminLayout title="AI Configuration"><ErrorState message={error} onRetry={load} /></AdminLayout>;
  if (!status) return <AdminLayout title="AI Configuration"><LoadingState label="Loading AI configuration…" /></AdminLayout>;

  return (
    <AdminLayout
      title="AI Configuration"
      description="PRAMANA AI runs on this server with no API key. A provider is optional and only changes how answers are worded."
    >
      {/* Which engine writes the answers. The built-in one is the default and needs
          nothing configured; the provider below is an optional phrasing layer. */}
      <Card className="mb-4">
        <CardHead
          title="Answer engine"
          sub="The built-in engine requires no key, no account and no internet connection"
        />
        <div className="grid gap-3 px-5 py-4 sm:grid-cols-2">
          {([
            {
              id: 'builtin' as const,
              name: 'Built-in data engine',
              tag: 'Recommended · no API',
              body: 'Resolves your question against the loaded records and writes the answer on this server. Nothing leaves the deployment. Every capability — member profiles, comparisons, rankings, screening results, scheme background and the administrator views — is available in this mode.',
            },
            {
              id: 'model' as const,
              name: 'Model phrasing',
              tag: status.configured ? 'Requires the key below' : 'Unavailable — no key saved',
              body: 'The built-in engine still resolves every figure; a connected provider only rewords the result. If the provider is slow or unreachable, the built-in answer is returned instead, so this can never take the assistant offline.',
            },
          ]).map((opt) => {
            const active = status.engine === opt.id;
            const disabled = opt.id === 'model' && !status.configured;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setEngine(opt.id)}
                disabled={disabled || busy !== null}
                className={`rounded-md border p-4 text-left transition-colors ${
                  active
                    ? 'border-navy-600 bg-navy-50'
                    : disabled
                      ? 'cursor-not-allowed border-line bg-surface-raised opacity-60'
                      : 'border-line bg-white hover:border-navy-300'
                }`}
                aria-pressed={active}
              >
                <div className="flex items-center gap-2">
                  <span aria-hidden="true" className={active ? 'text-navy-700' : 'text-ink-faint'}>{active ? '◉' : '○'}</span>
                  <span className="text-[13px] font-semibold text-navy-900">{opt.name}</span>
                </div>
                <div className="mt-0.5 pl-6 text-[10px] uppercase tracking-wide text-ink-faint">{opt.tag}</div>
                <p className="mt-2 pl-6 text-[12px] leading-relaxed text-ink-muted">{opt.body}</p>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHead
            title="PRAMANA AI provider"
            sub="Stored on the server, encrypted at rest, never sent to the browser"
          />

          <div className="border-b border-line px-5 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center gap-2 rounded border px-3 py-1.5 text-[13px] font-medium ${
                  status.configured
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-line-strong bg-surface-raised text-ink-muted'
                }`}
              >
                <span aria-hidden="true">{status.configured ? '✓' : '○'}</span>
                {!status.configured
                  ? 'No model connected — built-in engine in use'
                  : verified
                    ? `${status.providerLabel} connected`
                    : `${status.providerLabel} key saved`}
              </span>
              {status.configured && (
                <>
                  <button onClick={test} className="btn-secondary btn-sm" disabled={busy !== null}>
                    {busy === 'test' ? 'Testing…' : 'Test connection'}
                  </button>
                  {!verified && (
                    <span className="text-2xs text-ink-muted">
                      Run a test to confirm the key reaches {status.providerLabel}.
                    </span>
                  )}
                </>
              )}
            </div>

            {status.configured && (
              <dl className="mt-4 grid gap-2 text-[13px] sm:grid-cols-2">
                <div className="flex gap-2">
                  <dt className="text-ink-muted">Key:</dt>
                  <dd className="font-mono text-[12px] text-ink">{status.key?.masked}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-ink-muted">Provider:</dt>
                  <dd>{status.providerLabel}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-ink-muted">Model:</dt>
                  <dd>{status.model}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-ink-muted">Source:</dt>
                  <dd>{status.source === 'admin' ? 'Saved from this screen' : 'Server environment file'}</dd>
                </div>
                {status.updatedAt && (
                  <div className="flex gap-2">
                    <dt className="text-ink-muted">Updated:</dt>
                    <dd>{status.updatedAt}{status.updatedBy ? ` by ${status.updatedBy}` : ''}</dd>
                  </div>
                )}
              </dl>
            )}

            {result && (
              <div
                role="status"
                className={`mt-4 rounded-md border px-4 py-3 text-[13px] ${
                  result.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-800'
                }`}
              >
                <p>{result.ok ? '✓ ' : ''}{result.text}</p>
                {result.detail && <p className="mt-1 font-mono text-[11px] opacity-80">{result.detail}</p>}
              </div>
            )}
          </div>

          <form onSubmit={save} className="space-y-4 p-5">
            <div>
              <label className="field-label" htmlFor="kimi-key">
                {status.configured ? 'Replace API key' : 'API key'}
              </label>
              <div className="relative">
                <input
                  id="kimi-key"
                  type={reveal ? 'text' : 'password'}
                  className="input pr-20 font-mono text-[13px]"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Paste a Google AI Studio (AIza…), OpenAI (sk-proj-…), NVIDIA (nvapi-…) or Moonshot (sk-…) key"
                />
                <button
                  type="button"
                  onClick={() => setReveal((v) => !v)}
                  aria-pressed={reveal}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-2xs font-medium text-navy-700 hover:bg-navy-50"
                >
                  {reveal ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="mt-1.5 text-2xs leading-relaxed text-ink-muted">
                A leading <code>Bearer</code> is removed automatically. The key is written to the server encrypted
                and is never returned to this page — only the last four characters are ever displayed.
              </p>
            </div>

            <details open={advanced} onToggle={(e) => setAdvanced((e.target as HTMLDetailsElement).open)}>
              <summary className="cursor-pointer text-[13px] font-medium text-navy-700">
                Endpoint and model {advanced ? '' : '(set automatically)'}
              </summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="field-label" htmlFor="kimi-base">API base URL</label>
                  <input id="kimi-base" className="input font-mono text-[12px]" value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)} spellCheck={false} />
                </div>
                <div>
                  <label className="field-label" htmlFor="kimi-model">Model</label>
                  {status.suggestedModels.length > 0 ? (
                    <select
                      id="kimi-model"
                      className="input text-[13px]"
                      value={status.suggestedModels.some((m) => m.id === model) ? model : ''}
                      onChange={(e) => setModel(e.target.value)}
                    >
                      {!status.suggestedModels.some((m) => m.id === model) && (
                        <option value="">{model} (custom)</option>
                      )}
                      {status.suggestedModels.map((m) => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input id="kimi-model" className="input font-mono text-[12px]" value={model}
                      onChange={(e) => setModel(e.target.value)} spellCheck={false} />
                  )}
                </div>
              </div>
              <p className="mt-2 text-2xs text-ink-muted">
                Left as they are, these follow the key you paste. A Google AI Studio key
                (<code>AIza…</code>) uses the Gemini endpoint and defaults to <code>gemini-2.0-flash</code>,
                which is served on Google&rsquo;s free tier. An OpenAI key (<code>sk-proj-…</code>) defaults to
                <code>gpt-4o-mini</code>. A Moonshot key uses the Moonshot endpoint, and an NVIDIA-issued key
                (<code>nvapi-…</code>) reaches Kimi K2 through NVIDIA&rsquo;s OpenAI-compatible endpoint.
                Only inexpensive models are offered: PRAMANA AI sends a compact factual context and asks for a
                few sentences back, so a larger model costs more without changing the figures.
              </p>
            </details>

            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
              <button className="btn-primary" disabled={busy !== null || apiKey.trim().length < 12}>
                {busy === 'save' ? 'Saving…' : 'Save API key'}
              </button>

              <input
                ref={fileRef} id="kimi-file" type="file" accept=".txt,.env,text/plain" className="sr-only"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadKeyFile(f); }}
              />
              <label htmlFor="kimi-file" className="btn-secondary cursor-pointer">
                {busy === 'upload' ? 'Reading…' : 'Upload key file'}
              </label>

              {status.configured && status.source === 'admin' && (
                <button type="button" onClick={clear} className="btn-danger" disabled={busy !== null}>
                  {busy === 'clear' ? 'Removing…' : 'Remove key'}
                </button>
              )}
            </div>
          </form>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHead title="What PRAMANA AI does" sub="The same behaviour with or without a key" />
            <div className="space-y-3 p-5 text-[13px] leading-relaxed text-ink-muted">
              <p>
                Every answer is built from a factual summary of the datasets loaded into PRAMANA — totals,
                distributions, screening results and the record the question is about. The model is instructed to
                use nothing else, to invent no figures, and never to describe a statistical signal as wrongdoing.
              </p>
              <p>
                Naming two members in a question — &ldquo;compare A and B&rdquo; — resolves both against the
                loaded records before any model is called, so the comparison itself is done in SQL, not written
                by the model.
              </p>
              <p>
                With no key configured, a built-in query engine answers the same questions directly from the
                database, comparisons included. PRAMANA AI therefore works with no internet access at all; a key
                only makes the wording more conversational.
              </p>
            </div>
          </Card>

          <Card>
            <CardHead title="How the key is handled" sub="Server-side only" />
            <ul className="space-y-2 p-5 text-[13px] leading-relaxed text-ink-muted">
              <li>Encrypted with AES-256-GCM before being written to the database.</li>
              <li>Sent only from this server to the AI provider, never to any browser.</li>
              <li>Kept out of the audit log, error messages and application logs — the audit entry records that the key changed and the last four characters only.</li>
              <li>Replacing or removing the key takes effect on the next question, with no restart.</li>
            </ul>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
