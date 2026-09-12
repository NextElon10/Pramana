const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { createSession, cookieOptions, COOKIE_NAME } = require('../utils/authUtil');
const { attachUser, requireAuth, logAudit } = require('../middleware/auth');
const { issue: issueCaptcha, requireCaptcha } = require('../utils/captcha');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_ATTEMPTS', message: 'Too many login attempts. Please try again later.' },
});

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

function recordSecurityEvent(type, email, req, detail) {
  db.prepare('INSERT INTO security_events (event_type, email, ip, detail) VALUES (?,?,?,?)').run(type, email, req.ip, detail || null);
}

function doLogin({ email, password, req, res }) {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').toLowerCase().trim());
  // PRAMANA has no public account system: the only sign-in is the official/administrator
  // portal, and any account that is not an administrator is refused here.
  if (!user || !['admin', 'superadmin'].includes(user.role)) {
    recordSecurityEvent('login_failed', email, req, 'unknown user or wrong portal');
    return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' });
  }
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    recordSecurityEvent('login_blocked_locked', email, req, 'account locked');
    return res.status(423).json({ error: 'ACCOUNT_LOCKED', message: `Account temporarily locked. Try again after ${new Date(user.locked_until).toLocaleTimeString()}.` });
  }
  const ok = bcrypt.compareSync(password || '', user.password_hash);
  if (!ok) {
    const attempts = (user.failed_attempts || 0) + 1;
    let lockedUntil = null;
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60000).toISOString();
    }
    db.prepare('UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?').run(attempts, lockedUntil, user.id);
    recordSecurityEvent('login_failed', email, req, `bad password (attempt ${attempts})`);
    return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' });
  }
  db.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
  const token = createSession(user, req.headers['user-agent']);
  res.cookie(COOKIE_NAME, token, cookieOptions());
  recordSecurityEvent('login_success', email, req, user.role);
  db.prepare('INSERT INTO audit_log (actor_email, actor_role, action, ip) VALUES (?,?,?,?)').run(user.email, user.role, 'LOGIN_SUCCESS', req.ip);
  return res.json({ user: { id: user.id, email: user.email, role: user.role, name: user.name } });
}

// --- OFFICIAL / ADMINISTRATOR AUTH ---
// The public portal requires no account, so there is no public registration or
// public sign-in endpoint. Both paths below serve the administrator portal.

/** A fresh verification question for the sign-in form. */
router.get('/captcha', (req, res) => res.json(issueCaptcha()));

// The captcha guard runs before the rate limiter's counter is spent and before any
// password comparison, so scripted attempts are turned away at the door.
router.post('/admin/login', requireCaptcha, loginLimiter, (req, res) => doLogin({ ...req.body, req, res }));
router.post('/login', requireCaptcha, loginLimiter, (req, res) => doLogin({ ...req.body, req, res }));

router.post('/logout', attachUser, (req, res) => {
  if (req.user) {
    db.prepare('UPDATE sessions SET revoked = 1 WHERE id = ?').run(req.user.sid);
    logAudit('LOGOUT', req);
  }
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ message: 'Signed out.' });
});

router.get('/me', attachUser, (req, res) => {
  if (!req.user) return res.json({ user: null });
  const user = db.prepare('SELECT id, email, role, name, last_login_at FROM users WHERE id = ?').get(req.user.id);
  res.json({ user });
});

module.exports = router;
