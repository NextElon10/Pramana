const express = require('express');
const db = require('../db');
const { requireRole, logAudit } = require('../middleware/auth');
const router = express.Router();

const VALID_STATUSES = ['Unreviewed', 'Under Review', 'Reviewed - No Issue', 'Escalated'];

router.patch('/:recordId', requireRole('admin', 'superadmin'), (req, res) => {
  const { status, notes } = req.body || {};
  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'INVALID_INPUT', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
  }
  const anomaly = db.prepare('SELECT * FROM anomalies WHERE record_id = ?').get(req.params.recordId);
  if (!anomaly) return res.status(404).json({ error: 'NOT_FOUND' });
  db.prepare('UPDATE anomalies SET review_status = COALESCE(?, review_status), reviewer = ?, review_notes = COALESCE(?, review_notes), reviewed_at = CURRENT_TIMESTAMP WHERE record_id = ?')
    .run(status || null, req.user.email, notes || null, req.params.recordId);
  logAudit('REVIEW_UPDATE', req, { recordId: req.params.recordId, status, notes });
  const updated = db.prepare('SELECT * FROM anomalies WHERE record_id = ?').get(req.params.recordId);
  res.json(updated);
});

module.exports = router;
