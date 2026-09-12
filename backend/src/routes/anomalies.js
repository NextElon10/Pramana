const express = require('express');
const { stringify } = require('csv-stringify/sync');
const db = require('../db');
const { verify: verifyCaptcha } = require('../utils/captcha');
const { requireAuth } = require('../middleware/auth');
const { sanitizeForCsv } = require('../utils/clean');
const router = express.Router();

function buildFilters(query) {
  const where = ["a.classification IS NOT NULL"];
  const params = {};
  if (query.classification) { where.push('a.classification = @classification'); params.classification = query.classification; }
  if (query.reviewStatus) { where.push('a.review_status = @reviewStatus'); params.reviewStatus = query.reviewStatus; }
  if (query.state) { where.push('LOWER(r.state) = LOWER(@state)'); params.state = query.state; }
  if (query.datasetId) { where.push('a.dataset_id = @datasetId'); params.datasetId = query.datasetId; }
  if (query.minMethodCount) { where.push('a.method_count >= @minMethodCount'); params.minMethodCount = query.minMethodCount; }
  if (query.q) {
    where.push('(LOWER(r.mp_name) LIKE LOWER(@q) OR LOWER(r.project_name) LIKE LOWER(@q) OR LOWER(r.state) LIKE LOWER(@q) OR LOWER(r.project_id) LIKE LOWER(@q))');
    params.q = `%${query.q}%`;
  }
  return { whereSql: `WHERE ${where.join(' AND ')}`, params };
}

router.get('/', requireAuth, (req, res) => {
  const { whereSql, params } = buildFilters(req.query);
  const sort = ['anomaly_score', 'method_count', 'amount', 'percentile_rank'].includes(req.query.sort) ? req.query.sort : 'anomaly_score';
  const dir = req.query.dir === 'asc' ? 'ASC' : 'DESC';
  const limit = Math.min(parseInt(req.query.pageSize, 10) || 25, 500);
  const offset = ((parseInt(req.query.page, 10) || 1) - 1) * limit;

  const baseQuery = `
    FROM anomalies a JOIN records r ON a.record_id = r.id ${whereSql}
  `;
  const total = db.prepare(`SELECT COUNT(*) c ${baseQuery}`).get(params).c;
  const orderCol = sort === 'amount' ? 'r.amount' : `a.${sort}`;
  const rows = db.prepare(`SELECT a.*, r.state, r.district, r.constituency, r.mp_name, r.project_name, r.project_id, r.domain, r.amount, r.financial_year, r.house, r.member_type
    ${baseQuery} ORDER BY ${orderCol} ${dir} LIMIT @limit OFFSET @offset`).all({ ...params, limit, offset });

  res.json({ total, page: parseInt(req.query.page, 10) || 1, pageSize: limit, results: rows });
});

router.get('/export.csv', requireAuth, (req, res) => {
  // Bulk export is the most attractive endpoint to script, so it carries the same
  // verification as sign-in. The token is single-use and issued by /api/auth/captcha.
  const { ok } = verifyCaptcha(req.query.captchaId, req.query.captchaAnswer);
  if (!ok) {
    return res.status(400).json({
      error: 'CAPTCHA_FAILED',
      message: 'Bulk export requires verification. Answer the question shown and try the download again.',
    });
  }
  const { whereSql, params } = buildFilters(req.query);
  const rows = db.prepare(`SELECT a.record_id, r.state, r.district, r.constituency, r.house, r.mp_name, r.project_name, r.project_id, r.domain, r.amount,
      a.classification, a.method_count, a.anomaly_score, a.z_score, a.mod_z_score, a.percentile_rank, a.review_status, a.explanation
      FROM anomalies a JOIN records r ON a.record_id = r.id ${whereSql} ORDER BY a.anomaly_score DESC`).all(params);
  const sanitized = rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, sanitizeForCsv(v)])));
  const csv = stringify(sanitized, { header: true });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="pramana-anomaly-export.csv"');
  res.send(csv);
});

router.get('/:recordId', requireAuth, (req, res) => {
  const anomaly = db.prepare('SELECT * FROM anomalies WHERE record_id = ?').get(req.params.recordId);
  const record = db.prepare('SELECT * FROM records WHERE id = ?').get(req.params.recordId);
  if (!record) return res.status(404).json({ error: 'NOT_FOUND' });
  const dataset = db.prepare('SELECT * FROM datasets WHERE id = ?').get(record.dataset_id);
  const summary = dataset && dataset.stats_json ? JSON.parse(dataset.stats_json) : null;
  const crossSignals = db.prepare(`
    SELECT cm.*, r2.mp_name as matchedMp, r2.project_name as matchedProject, d2.name as matchedDataset
    FROM cross_matches cm JOIN records r2 ON (cm.record_a = r2.id OR cm.record_b = r2.id) AND r2.id != ?
    JOIN datasets d2 ON d2.id = r2.dataset_id
    WHERE cm.record_a = ? OR cm.record_b = ?
  `).all(record.id, record.id, record.id);
  res.json({ record, anomaly, distributionSummary: summary, crossDatasetSignals: crossSignals, rawData: JSON.parse(record.raw_json) });
});

module.exports = router;
