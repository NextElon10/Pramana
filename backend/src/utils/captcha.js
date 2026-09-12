/**
 * Arithmetic captcha, verified on the server.
 *
 * The point of a captcha is that the client cannot decide whether it passed. So the
 * answer never leaves this process: the browser receives an opaque id and a question,
 * and the server checks the reply against what it stored.
 *
 * Challenges are single-use and expire, so a solved id cannot be replayed to script a
 * burst of login attempts. This is a proportionate control for a prototype and is not
 * a substitute for a hardened provider (hCaptcha, Turnstile) in a real deployment —
 * the README says so rather than overstating it.
 */
const crypto = require('crypto');

const TTL_MS = 5 * 60 * 1000;
const MAX_OUTSTANDING = 5000;

/** id -> { answer, expiresAt, attempts } */
const challenges = new Map();

function sweep() {
  const now = Date.now();
  for (const [id, c] of challenges) {
    if (c.expiresAt < now) challenges.delete(id);
  }
  // Hard ceiling so a flood of issue() calls cannot grow memory without bound.
  if (challenges.size > MAX_OUTSTANDING) {
    const excess = challenges.size - MAX_OUTSTANDING;
    let i = 0;
    for (const id of challenges.keys()) {
      challenges.delete(id);
      if (++i >= excess) break;
    }
  }
}

const int = (min, max) => min + crypto.randomInt(max - min + 1);

function issue() {
  sweep();
  const a = int(2, 9);
  const b = int(2, 9);
  // Addition and multiplication only: subtraction invites negative answers, and
  // anything harder punishes the human rather than the script.
  const useTimes = crypto.randomInt(2) === 1;
  const answer = useTimes ? a * b : a + b;
  const id = crypto.randomBytes(16).toString('hex');

  challenges.set(id, { answer, expiresAt: Date.now() + TTL_MS, attempts: 0 });
  return {
    id,
    question: `What is ${a} ${useTimes ? '×' : '+'} ${b}?`,
    expiresInSeconds: Math.round(TTL_MS / 1000),
  };
}

/**
 * Verifies and consumes a challenge. Returns { ok, reason }.
 * A challenge is destroyed on success, on expiry, and after three wrong answers.
 */
function verify(id, submitted) {
  sweep();
  if (!id) return { ok: false, reason: 'MISSING' };

  const challenge = challenges.get(String(id));
  if (!challenge) return { ok: false, reason: 'EXPIRED' };

  if (challenge.expiresAt < Date.now()) {
    challenges.delete(String(id));
    return { ok: false, reason: 'EXPIRED' };
  }

  const value = Number(String(submitted ?? '').trim());
  if (!Number.isFinite(value) || value !== challenge.answer) {
    challenge.attempts += 1;
    if (challenge.attempts >= 3) challenges.delete(String(id));
    return { ok: false, reason: 'WRONG' };
  }

  challenges.delete(String(id));
  return { ok: true };
}

/** Express guard. Rejects before any credential work happens. */
function requireCaptcha(req, res, next) {
  const { ok, reason } = verify(req.body?.captchaId, req.body?.captchaAnswer);
  if (ok) return next();
  const message = reason === 'EXPIRED'
    ? 'That verification expired. A new question has been issued — please answer it and try again.'
    : reason === 'MISSING'
      ? 'Please answer the verification question.'
      : 'That answer was not correct. Please try the new question.';
  return res.status(400).json({ error: 'CAPTCHA_FAILED', message, captcha: issue() });
}

module.exports = { issue, verify, requireCaptcha };
