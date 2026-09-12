/**
 * PRAMANA AI — the portal's data assistant.
 *
 * The assistant answers from this server alone. `utils/answerEngine` reads the
 * loaded MPLADS records, works out what the question refers to, and writes the
 * reply; there is no API key, no provider account and no outbound request in the
 * path. A deployment with no internet connection answers exactly as well as one
 * with it.
 *
 * A language model may optionally be connected by an administrator to rephrase the
 * same facts more fluently, but it is off unless explicitly switched on, and it is
 * given only the context the engine has already resolved. If it fails or is slow,
 * the built-in answer is returned instead — the feature cannot go down because an
 * outside service did.
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const { respond, greeting } = require('../utils/answerEngine');
const { contextToText, buildContext } = require('../utils/dataContext');
const { logAudit } = require('../middleware/auth');
const { getKimiConfig, getEngineMode } = require('../utils/settings');
const { callModel } = require('../utils/aiClient');

const router = express.Router();

/* -------------------------------------------------------------------------- */
/* Conversation memory                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Short-term memory, held in process. It carries the last member, state and measure
 * forward so follow-ups resolve naturally ("and Bihar?", "what about his works?").
 *
 * It is deliberately not persisted: it holds no answer text and nothing of value,
 * it expires in thirty minutes, and a restart simply starts everyone fresh.
 */
const TTL_MS = 30 * 60 * 1000;
const MAX_CONVERSATIONS = 500;
const conversations = new Map();

function sweep() {
  const cutoff = Date.now() - TTL_MS;
  for (const [id, entry] of conversations) {
    if (entry.seen < cutoff) conversations.delete(id);
  }
  // Under sustained load, drop the oldest rather than grow without bound.
  while (conversations.size > MAX_CONVERSATIONS) {
    conversations.delete(conversations.keys().next().value);
  }
}

function newId() {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function loadMemory(id) {
  const entry = id ? conversations.get(id) : null;
  return entry && entry.seen >= Date.now() - TTL_MS ? entry.memory : null;
}

function saveMemory(id, memory) {
  conversations.delete(id); // re-insert so iteration order is least-recently-used
  conversations.set(id, { memory, seen: Date.now() });
  sweep();
}

/* -------------------------------------------------------------------------- */
/* Optional model phrasing                                                     */
/* -------------------------------------------------------------------------- */

const SYSTEM_PROMPT = `You are PRAMANA AI, the data assistant built into PRAMANA — a statistical transparency prototype for Indian MPLADS data. PRAMANA is NOT the official e-SAKSHI portal.

Absolute rules:
1. Answer ONLY from the DATA CONTEXT and the DRAFT ANSWER provided. Never estimate, extrapolate or recall figures from memory. The draft answer was produced from the database; do not contradict its figures.
2. Never state or imply that any person or state has committed fraud, corruption or wrongdoing. A statistical anomaly is a signal for human review, not evidence.
3. Allocation limits vary legitimately with a member's term length, House and date of entry. Say so whenever an amount looks unusually high or low, and whenever two members are compared.
4. "Fund utilisation" means recommended amount as a share of allocation. The share actually paid out is a separate figure. Do not conflate them.
5. Be concise: 3-6 sentences or a short list. Use Indian number formatting (crore/lakh).
6. Never invent MP names, party affiliations, project names, contact details or Government URLs. Party affiliation is not in this dataset.`;

/** True only when an administrator has both saved a key and switched phrasing on. */
function modelPhrasingEnabled() {
  const cfg = getKimiConfig();
  return Boolean(cfg.apiKey) && getEngineMode() === 'model';
}

/* -------------------------------------------------------------------------- */
/* Routes                                                                      */
/* -------------------------------------------------------------------------- */

const askLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 45,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_ATTEMPTS', message: 'Too many questions in a short time. Please wait a moment.' },
});

router.get('/status', (req, res) => {
  const isAdmin = Boolean(req.user);
  const phrasing = modelPhrasingEnabled();
  const cfg = phrasing ? getKimiConfig() : null;

  res.json({
    name: 'PRAMANA AI',
    mode: 'local',
    engine: 'PRAMANA built-in data engine',
    offline: true,
    configured: true,
    requiresApiKey: false,
    role: isAdmin ? req.user.role : 'public',
    phrasing: phrasing ? { provider: cfg.provider, providerLabel: cfg.providerLabel, model: cfg.model } : null,
    note: phrasing
      ? `Answers are resolved from the loaded records by the built-in engine, then rephrased by ${cfg.providerLabel}. Figures come from the database either way.`
      : 'Answers are read directly from the loaded MPLADS records by the built-in engine. No external service is contacted and no API key is required.',
    capabilities: [
      'Member profiles and side-by-side comparison',
      'State and union-territory profiles, rankings and comparison',
      'Rankings on allocation, utilisation, expenditure, works and completion',
      'Anomaly screening results and what each method measures',
      'MPLAD Scheme background and portal navigation',
      ...(isAdmin ? ['Review queue, datasets, reports, audit trail and security status'] : []),
    ],
    suggestions: isAdmin
      ? [
        'What should I review first?',
        'Summarise the loaded datasets',
        'Show recent audit activity',
        'Which members have the lowest fund utilisation?',
      ]
      : [
        'Give me an overview of the data',
        'Top 5 states by allocation',
        'Which members have the lowest fund utilisation?',
        'How does the anomaly screening work?',
      ],
  });
});

/** The opening message, so the panel starts a conversation rather than a blank box. */
router.get('/greeting', (req, res) => {
  const house = String(req.query.house || 'both');
  const isAdmin = Boolean(req.user);
  const result = greeting({ house, isAdmin });
  const conversationId = newId();
  saveMemory(conversationId, result.memory);
  res.json({
    conversationId,
    answer: result.answer,
    suggestions: result.suggestions,
    engine: 'PRAMANA built-in data engine',
  });
});

router.post('/ask', askLimiter, async (req, res) => {
  const question = String(req.body?.question || '').trim();
  if (!question) {
    return res.status(400).json({ error: 'INVALID_INPUT', message: 'Please enter a question.' });
  }
  if (question.length > 500) {
    return res.status(400).json({ error: 'INVALID_INPUT', message: 'Please keep questions under 500 characters.' });
  }

  const house = String(req.body?.house || req.query?.house || 'both');
  // The role comes from the verified session cookie, never from the request body —
  // asking "as an admin" does not make anyone one.
  const isAdmin = Boolean(req.user);

  const conversationId = String(req.body?.conversationId || '').slice(0, 64) || newId();
  const memory = loadMemory(conversationId);

  const result = respond(question, { house, isAdmin, memory });
  saveMemory(conversationId, result.memory);

  logAudit('ASSISTANT_QUERY', req, {
    question: question.slice(0, 200),
    intent: result.intent,
    resolved: result.grounding.members.length,
  });

  const payload = {
    conversationId,
    answer: result.answer,
    intent: result.intent,
    source: 'local',
    engine: 'PRAMANA built-in data engine',
    grounded: true,
    grounding: result.grounding,
    suggestions: result.suggestions,
    actions: result.actions,
  };

  if (!modelPhrasingEnabled()) return res.json(payload);

  // Optional: hand the resolved facts and the built-in answer to a model for
  // phrasing only. Any failure returns the built-in answer unchanged.
  const cfg = getKimiConfig();
  try {
    const ctx = buildContext(question, house);
    const { text, model } = await callModel(cfg, {
      system: SYSTEM_PROMPT,
      user: `DATA CONTEXT (the only facts you may use):\n${contextToText(ctx)}\n\nDRAFT ANSWER from the built-in engine (figures are authoritative):\n${result.answer}\n\nQUESTION: ${question}`,
    });
    return res.json({ ...payload, answer: text, source: cfg.provider, engine: `${cfg.providerLabel} · ${model}` });
  } catch (err) {
    return res.json({
      ...payload,
      note: `${cfg.providerLabel} was unreachable (${err.message}) — answered by the built-in engine instead.`,
    });
  }
});

/** Clears the short-term memory for one conversation. */
router.post('/reset', (req, res) => {
  const id = String(req.body?.conversationId || '');
  if (id) conversations.delete(id);
  res.json({ ok: true, conversationId: newId() });
});

module.exports = router;
