const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { logAudit } = require('../middleware/auth');

const router = express.Router();

const TOKEN_TTL_MINUTES = 30;
const isProd = process.env.NODE_ENV === 'production';

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_ATTEMPTS', message: 'Too many reset requests. Please try again later.' },
});

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * POST /api/password/forgot  { email, portal: 'public' | 'admin' }
 *
 * Always responds with the same success payload so the endpoint cannot be used to
 * discover which email addresses have accounts.
 *
 * PRAMANA has no mail server configured. In a deployment this token would be emailed;
 * here the reset link is printed to the server console, and (outside production) also
 * returned in the response so the flow is demonstrable end to end. That is a deliberate,
 * documented development affordance — never enable it in production.
 */
router.post('/forgot', resetLimiter, (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim();
  const generic = {
    message: 'If an account exists for that email address, a password reset link has been generated.',
  };

  if (!email) {
    return res.status(400).json({ error: 'INVALID_INPUT', message: 'Please enter your email address.' });
  }

  // Recovery exists for official/administrator accounts only — the public portal has
  // no accounts to recover. A non-administrator address gets the same generic reply.
  const user = db.prepare('SELECT id, email, role FROM users WHERE email = ?').get(email);
  if (!user || !['admin', 'superadmin'].includes(user.role)) {
    db.prepare('INSERT INTO security_events (event_type, email, ip, detail) VALUES (?,?,?,?)')
      .run('password_reset_requested_unknown', email, req.ip, 'no matching account');
    return res.json(generic);
  }

  // Invalidate any outstanding tokens for this user, then issue exactly one.
  db.prepare("UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL").run(user.id);

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60000).toISOString();
  db.prepare('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?,?,?)')
    .run(user.id, hashToken(token), expiresAt);

  db.prepare('INSERT INTO security_events (event_type, email, ip, detail) VALUES (?,?,?,?)')
    .run('password_reset_requested', email, req.ip, `token valid ${TOKEN_TTL_MINUTES} min`);
  logAudit('PASSWORD_RESET_REQUESTED', req, { email });

  const resetPath = `/reset-password?token=${token}`;
  console.log('');
  console.log('  ── PRAMANA password reset requested ─────────────────────────────');
  console.log(`     Account : ${user.email} (${user.role})`);
  console.log(`     Link    : http://localhost:5173${resetPath}`);
  console.log(`     Expires : ${TOKEN_TTL_MINUTES} minutes`);
  console.log('     (No mail server is configured; a deployment would email this link.)');
  console.log('  ─────────────────────────────────────────────────────────────────');

  // Outside production the link is returned so the flow can be completed in one sitting.
  return res.json(isProd ? generic : { ...generic, devResetPath: resetPath });
});

/** GET /api/password/verify?token=… — checks a token before showing the reset form. */
router.get('/verify', (req, res) => {
  const token = String(req.query.token || '');
  if (!token) return res.status(400).json({ error: 'INVALID_TOKEN', message: 'No reset token supplied.' });

  const row = db.prepare('SELECT * FROM password_resets WHERE token_hash = ?').get(hashToken(token));
  if (!row || row.used_at || new Date(row.expires_at) < new Date()) {
    return res.status(400).json({ error: 'INVALID_TOKEN', message: 'This reset link is invalid or has expired. Please request a new one.' });
  }
  const user = db.prepare('SELECT email, role FROM users WHERE id = ?').get(row.user_id);
  res.json({ valid: true, email: user.email, role: user.role });
});

/** POST /api/password/reset  { token, password } */
router.post('/reset', resetLimiter, (req, res) => {
  const token = String(req.body?.token || '');
  const password = String(req.body?.password || '');

  if (password.length < 8) {
    return res.status(400).json({ error: 'INVALID_INPUT', message: 'Your new password must be at least 8 characters.' });
  }

  const row = db.prepare('SELECT * FROM password_resets WHERE token_hash = ?').get(hashToken(token));
  if (!row || row.used_at || new Date(row.expires_at) < new Date()) {
    return res.status(400).json({ error: 'INVALID_TOKEN', message: 'This reset link is invalid or has expired. Please request a new one.' });
  }

  const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(row.user_id);
  if (!user) return res.status(400).json({ error: 'INVALID_TOKEN', message: 'This reset link is no longer valid.' });

  const apply = db.transaction(() => {
    db.prepare('UPDATE users SET password_hash = ?, failed_attempts = 0, locked_until = NULL WHERE id = ?')
      .run(bcrypt.hashSync(password, 12), user.id);
    db.prepare('UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE id = ?').run(row.id);
    // Signing in again is required everywhere after a password change.
    db.prepare('UPDATE sessions SET revoked = 1 WHERE user_id = ?').run(user.id);
  });
  apply();

  db.prepare('INSERT INTO security_events (event_type, email, ip, detail) VALUES (?,?,?,?)')
    .run('password_reset_completed', user.email, req.ip, 'all sessions revoked');
  logAudit('PASSWORD_RESET_COMPLETED', req, { email: user.email });

  res.json({ message: 'Your password has been changed. You can now sign in.' });
});

module.exports = router;
