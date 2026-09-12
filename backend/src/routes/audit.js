const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware/auth');
const router = express.Router();

router.get('/', requireRole('admin', 'superadmin'), (req, res) => {
  const limit = Math.min(parseInt(req.query.pageSize, 10) || 50, 500);
  const offset = ((parseInt(req.query.page, 10) || 1) - 1) * limit;
  const total = db.prepare('SELECT COUNT(*) c FROM audit_log').get().c;
  const rows = db.prepare('SELECT * FROM audit_log ORDER BY ts DESC LIMIT ? OFFSET ?').all(limit, offset);
  res.json({ total, results: rows });
});

module.exports = router;
