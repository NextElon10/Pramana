const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireRole, requireAuth, logAudit } = require('../middleware/auth');
const router = express.Router();

router.get('/dashboard', requireRole('admin', 'superadmin'), (req, res) => {
  const user = db.prepare('SELECT id, email, role, last_login_at FROM users WHERE id = ?').get(req.user.id);
  const activeSessions = db.prepare("SELECT id, created_at, expires_at, user_agent FROM sessions WHERE user_id = ? AND revoked = 0 AND expires_at > CURRENT_TIMESTAMP").all(req.user.id);
  const recentEvents = db.prepare('SELECT * FROM security_events ORDER BY ts DESC LIMIT 25').all();
  const failedAttempts = db.prepare("SELECT COUNT(*) c FROM security_events WHERE event_type = 'login_failed' AND ts > datetime('now','-1 day')").get().c;
  res.json({ user, activeSessions, recentEvents, failedAttempts, mfaStatus: 'Not implemented in this prototype' });
});

router.post('/sessions/:id/terminate', requireAuth, (req, res) => {
  db.prepare('UPDATE sessions SET revoked = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  logAudit('SESSION_TERMINATED', req, { sessionId: req.params.id });
  res.json({ message: 'Session terminated.' });
});

router.post('/sessions/logout-others', requireAuth, (req, res) => {
  db.prepare('UPDATE sessions SET revoked = 1 WHERE user_id = ? AND id != ?').run(req.user.id, req.user.sid);
  logAudit('LOGOUT_OTHERS', req);
  res.json({ message: 'Other sessions signed out.' });
});

router.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'INVALID_INPUT', message: 'New password must be at least 8 characters.' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(currentPassword || '', user.password_hash)) {
    return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Current password is incorrect.' });
  }
  const hash = bcrypt.hashSync(newPassword, 12);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
  logAudit('PASSWORD_CHANGED', req);
  res.json({ message: 'Password updated.' });
});

module.exports = router;
