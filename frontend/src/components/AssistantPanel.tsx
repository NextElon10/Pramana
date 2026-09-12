import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useI18n } from '../i18n';
import { useHouse } from '../context/HouseContext';

type Member = { id: number; name: string; state: string | null; house: string | null };
type Grounding = {
  records: number;
  members: Member[];
  states?: string[];
  isComparison: boolean;
  compareUrl: string | null;
};
type Action = { label: string; url: string };
type Turn = {
  role: 'user' | 'assistant';
  text: string;
  engine?: string;
  note?: string;
  grounding?: Grounding;
  actions?: Action[];
  suggestions?: string[];
};

type Status = {
  mode: string;
  engine?: string;
  offline?: boolean;
  role?: string;
  note?: string;
  phrasing?: { providerLabel: string; model: string } | null;
  suggestions?: string[];
};

const FALLBACK_SUGGESTIONS = [
  'Give me an overview of the data',
  'Top 5 states by allocation',
  'Which members have the lowest fund utilisation?',
  'How does the anomaly screening work?',
];

/**
 * Renders the light markup the answer engine emits: **bold** runs and bullet lines.
 * Deliberately not a Markdown library — the engine produces exactly these two things,
 * and parsing only what is produced keeps untrusted text from ever reaching innerHTML.
 */
function AnswerText({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => {
        const bullet = /^\s*[•\-]\s+/.test(line);
        const body = bullet ? line.replace(/^\s*[•\-]\s+/, '') : line;
        const parts = body.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
        return (
          <span key={i} className={bullet ? 'flex gap-1.5 pl-1' : 'block'}>
            {bullet && <span aria-hidden="true" className="text-ink-faint">•</span>}
            <span>
              {parts.map((part, j) => (part.startsWith('**') && part.endsWith('**')
                ? <strong key={j} className="font-semibold text-navy-900">{part.slice(2, -2)}</strong>
                : <span key={j}>{part}</span>))}
            </span>
          </span>
        );
      })}
    </>
  );
}

/**
 * PRAMANA AI — the portal's data assistant.
 *
 * The assistant runs entirely on the PRAMANA server: it resolves the question
 * against the loaded MPLADS records and writes the answer from them. No external
 * service is contacted, so the panel works on a machine with no internet at all.
 *
 * The conversation is stateful. Each reply carries a conversation id back to the
 * server, which remembers the last member, state and measure — so "and Bihar?" or
 * "why was it flagged?" continue the thread rather than starting over.
 */
export default function AssistantPanel({ variant = 'public' }: { variant?: 'public' | 'admin' }) {
  const { t } = useI18n();
  const { house, label } = useHouse();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Status and the opening message are fetched once, the first time the panel opens.
  useEffect(() => {
    if (!open || status) return;
    api.get('/assistant/status')
      .then(setStatus)
      .catch(() => setStatus({ mode: 'local', engine: 'PRAMANA built-in data engine', offline: true }));
    api.get(`/assistant/greeting?house=${encodeURIComponent(house)}`)
      .then((res) => {
        setConversationId(res.conversationId);
        setTurns([{ role: 'assistant', text: res.answer, suggestions: res.suggestions, engine: res.engine }]);
      })
      .catch(() => { /* the panel still works; the first question opens the thread */ });
  }, [open, status, house]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [turns, busy]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    if (open) {
      document.addEventListener('keydown', onKey);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const ask = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    // Chips are one-shot: once used, they stop competing with the reply below them.
    setTurns((prev) => [...prev.map((turn) => ({ ...turn, suggestions: undefined })), { role: 'user', text: q }]);
    setQuestion('');
    setBusy(true);
    try {
      // The House lens travels with the question, so the assistant answers from the
      // same slice of data the reader is looking at.
      const res = await api.post('/assistant/ask', { question: q, house, conversationId });
      if (res.conversationId) setConversationId(res.conversationId);
      setTurns((prev) => [...prev, {
        role: 'assistant',
        text: res.answer,
        engine: res.engine,
        note: res.note,
        grounding: res.grounding,
        actions: res.actions,
        suggestions: res.suggestions,
      }]);
    } catch (e: any) {
      setTurns((prev) => [...prev, { role: 'assistant', text: e.message || 'PRAMANA AI is unavailable right now.' }]);
    } finally {
      setBusy(false);
    }
  };

  const restart = async () => {
    try { if (conversationId) await api.post('/assistant/reset', { conversationId }); } catch { /* best effort */ }
    setConversationId(null);
    setTurns([]);
    setStatus(null); // re-fetches status and a fresh opening message
  };

  const openingChips = status?.suggestions?.length ? status.suggestions : FALLBACK_SUGGESTIONS;
  const lastChips = turns.length ? turns[turns.length - 1].suggestions : undefined;
  const chips = turns.length ? (lastChips || []) : openingChips;
  const engineLine = status?.phrasing
    ? `${status.phrasing.providerLabel} · ${status.phrasing.model}`
    : 'Built-in engine · runs on this server, no API';

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          // Lifts clear of the cookie notice while that is on screen; --consent-inset is
          // 0px once it is dismissed, so the button returns to its normal position.
          style={{ bottom: 'calc(1.25rem + var(--consent-inset, 0px))' }}
          className="fixed right-5 z-40 flex items-center gap-2 rounded-full border border-navy-700 bg-navy-900 px-4 py-2.5 text-[13px] font-medium text-white shadow-raised transition-[bottom,transform] hover:bg-navy-800 active:scale-[0.98]"
          aria-label="Open PRAMANA AI"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M10 2.5 11.6 7 16 8.6 11.6 10.2 10 14.7 8.4 10.2 4 8.6 8.4 7 10 2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M15.4 13.4 16 15l1.6.6L16 16.2l-.6 1.6-.6-1.6-1.6-.6 1.6-.6.6-1.6Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          </svg>
          PRAMANA AI
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="PRAMANA AI">
          <div className="absolute inset-0 bg-navy-950/40 animate-fade-in" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-panel animate-slide-in">
            <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 text-base">
                  PRAMANA AI
                  <span className="rounded-full border border-line bg-surface-raised px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink-muted">
                    {status?.role && status.role !== 'public' ? 'Admin' : 'Grounded'}
                  </span>
                </h2>
                <p className="mt-0.5 text-2xs text-ink-muted">
                  {engineLine}
                  {' · '}{label}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                {turns.length > 1 && (
                  <button onClick={restart} className="btn-secondary btn-sm" title="Start a new conversation">New</button>
                )}
                <button onClick={() => setOpen(false)} className="btn-secondary btn-sm">{t('action.close')}</button>
              </div>
            </header>

            <div ref={logRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {turns.length === 0 && !busy && (
                <p className="prose-note">
                  Ask about the loaded MPLADS data — a state, a member, fund utilisation, the
                  screening methods, or a side-by-side comparison of two members. Every figure
                  is read from the ingested records on this server.
                </p>
              )}

              {turns.map((turn, i) => (
                <div key={i} className={turn.role === 'user' ? 'flex justify-end' : ''}>
                  <div
                    className={
                      turn.role === 'user'
                        ? 'max-w-[85%] rounded-lg rounded-br-sm bg-navy-800 px-3.5 py-2 text-[13px] text-white'
                        : 'max-w-full rounded-lg rounded-bl-sm border border-line bg-surface-raised px-3.5 py-2.5 text-[13px] leading-relaxed text-ink'
                    }
                  >
                    {turn.role === 'assistant'
                      ? <div className="space-y-0.5"><AnswerText text={turn.text} /></div>
                      : <span className="whitespace-pre-line">{turn.text}</span>}

                    {/* Where the answer points next — the matching screen in the portal. */}
                    {turn.role === 'assistant' && turn.actions?.length ? (
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {turn.actions.map((a) => (
                          <Link
                            key={a.url}
                            to={a.url}
                            onClick={() => setOpen(false)}
                            className="rounded-md border border-navy-200 bg-white px-2.5 py-1 text-[11px] font-medium text-navy-800 transition-colors hover:border-navy-400 hover:bg-navy-50"
                          >
                            {a.label} →
                          </Link>
                        ))}
                      </div>
                    ) : null}

                    {/* Which rows the answer was built from — the reader can open them. */}
                    {turn.role === 'assistant' && turn.grounding?.members?.length ? (
                      <div className="mt-2.5 border-t border-line pt-2">
                        <p className="text-[10px] uppercase tracking-wide text-ink-faint">Resolved from records</p>
                        <ul className="mt-1 space-y-0.5">
                          {turn.grounding.members.map((m) => (
                            <li key={m.id} className="text-[11px] text-ink-muted">
                              {m.name}
                              {m.state ? ` — ${m.state}` : ''}
                              {m.house ? ` (${m.house})` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {turn.role === 'assistant' && turn.engine && (
                      <span className="mt-2 block text-[10px] uppercase tracking-wide text-ink-faint">
                        {turn.engine}
                        {turn.grounding ? ` · ${turn.grounding.records.toLocaleString('en-IN')} records in scope` : ''}
                      </span>
                    )}
                    {turn.note && <span className="mt-1 block text-[10px] text-ink-faint">{turn.note}</span>}
                  </div>
                </div>
              ))}

              {/* Follow-ups offered by the answer itself, so the conversation can continue
                  without the reader having to guess what else is answerable. */}
              {!busy && chips.length > 0 && (
                <div className="space-y-2">
                  {chips.map((sug) => (
                    <button
                      key={sug}
                      onClick={() => ask(sug)}
                      className="block w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-left text-[13px] text-navy-800 transition-colors hover:border-navy-300 hover:bg-navy-50"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              )}

              {busy && (
                <div className="flex items-center gap-2 text-[13px] text-ink-muted">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-navy-600 border-t-transparent" />
                  Reading the loaded records…
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); ask(question); }}
              className="border-t border-line p-4"
            >
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  className="input"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={variant === 'admin' ? 'e.g. what should I review first?' : 'e.g. compare Atul Garg and Mahesh Sharma'}
                  aria-label={t('assistant.placeholder')}
                  maxLength={500}
                />
                <button className="btn-primary" disabled={busy || !question.trim()}>{t('assistant.ask')}</button>
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-ink-faint">
                PRAMANA AI reports statistics only. It cannot and will not judge whether any allocation
                is improper — that requires human review. Party affiliation is not in this dataset.
              </p>
            </form>
          </aside>
        </div>
      )}
    </>
  );
}
