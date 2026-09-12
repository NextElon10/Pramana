const { verifyToken, COOKIE_NAME } = require('../utils/authUtil');
const db = require('../db');

function attachUser(req, res, next) {
  const token = req.cookies ? req.cookies[COOKIE_NAME] : null;
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      req.user = { id: payload.uid, role: payload.role, email: payload.email, sid: payload.sid };
    }
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Session expired or not signed in.' });
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Session expired or not signed in.' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Administrator access required.' });
    }
    next();
  };
}

function logAudit(action, req, extra) {
  try {
    db.prepare('INSERT INTO audit_log (actor_email, actor_role, action, dataset_id, metadata_json, ip) VALUES (?,?,?,?,?,?)').run(
      req.user ? req.user.email : (extra && extra.email) || null,
      req.user ? req.user.role : 'anonymous',
      action,
      (extra && extra.datasetId) || null,
      extra ? JSON.stringify(extra) : null,
      req.ip
    );
  } catch (e) { /* best-effort */ }
}

module.exports = { attachUser, requireAuth, requireRole, logAudit };
