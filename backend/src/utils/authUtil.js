const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME_DEV_ONLY_INSECURE_SECRET';
const SESSION_TTL_HOURS = parseInt(process.env.SESSION_TTL_HOURS || '12', 10);
const isProd = process.env.NODE_ENV === 'production';

function createSession(user, userAgent) {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (id, user_id, expires_at, user_agent) VALUES (?,?,?,?)').run(
    sessionId, user.id, expiresAt, userAgent || ''
  );
  const token = jwt.sign({ sid: sessionId, uid: user.id, role: user.role, email: user.email }, JWT_SECRET, {
    expiresIn: `${SESSION_TTL_HOURS}h`,
  });
  return token;
}

function verifyToken(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const session = db.prepare('SELECT * FROM sessions WHERE id = ? AND revoked = 0').get(payload.sid);
    if (!session) return null;
    if (new Date(session.expires_at) < new Date()) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: SESSION_TTL_HOURS * 3600 * 1000,
    path: '/',
  };
}

const COOKIE_NAME = 'pramana_session';

module.exports = { createSession, verifyToken, cookieOptions, COOKIE_NAME };
