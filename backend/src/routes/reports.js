const express = require('express');
const { stringify } = require('csv-stringify/sync');
const db = require('../db');
const { requireRole, logAudit } = require('../middleware/auth');
const { buildReportPdf } = require('../utils/pdfReport');
const router = express.Router();

function buildReport(datasetId) {
  const dataset = db.prepare('SELECT * FROM datasets WHERE id = ?').get(datasetId);
  if (!dataset) return null;
  const summary = dataset.stats_json ? JSON.parse(dataset.stats_json) : null;
  const riskDist = db.prepare('SELECT classification, COUNT(*) c FROM anomalies WHERE dataset_id = ? GROUP BY classification').all(datasetId);
  const topFlagged = db.prepare(`
    SELECT r.mp_name, r.state, r.project_name, r.amount, a.classification, a.anomaly_score, a.explanation
    FROM anomalies a JOIN records r ON a.record_id = r.id
    WHERE a.dataset_id = ? ORDER BY a.anomaly_score DESC, r.amount DESC LIMIT 25
  `).all(datasetId);
  const excluded = db.prepare('SELECT COUNT(*) c FROM records WHERE dataset_id = ? AND amount IS NULL').get(datasetId).c;
  return {
    datasetName: dataset.name,
    source: dataset.source,
    generatedAt: new Date().toISOString(),
    recordsAnalysed: dataset.row_count,
    recordsExcluded: excluded,
    dataQuality: { missingAmount: excluded },
    methodology: 'Descriptive statistics (mean, median, IQR), Z-score (|Z|>3), Modified Z-score (|M|>3.5), and 95th/99th percentile screening. Convergence of 2+ independent methods raises classification. See PRAMANA About page for full methodology.',
    statistics: summary,
    riskDistribution: riskDist,
    topFlaggedRecords: topFlagged,
    interpretation: 'This is a statistical screening summary. Flagged records represent statistical outliers relative to the analysed distribution and require human review; they are not findings of fraud or wrongdoing.',
    disclaimer: 'PRAMANA is a statistical transparency and analytical prototype and is not the official e-SAKSHI portal. Statistical anomalies do not constitute evidence of wrongdoing.',
  };
}

router.get('/:datasetId/json', requireRole('admin', 'superadmin'), (req, res) => {
  const report = buildReport(req.params.datasetId);
  if (!report) return res.status(404).json({ error: 'NOT_FOUND' });
  db.prepare('INSERT INTO reports (dataset_id, generated_by, format, content_json) VALUES (?,?,?,?)').run(req.params.datasetId, req.user.id, 'json', JSON.stringify(report));
  logAudit('REPORT_GENERATED', req, { datasetId: req.params.datasetId, format: 'json' });
  res.json(report);
});

router.get('/:datasetId/csv', requireRole('admin', 'superadmin'), (req, res) => {
  const report = buildReport(req.params.datasetId);
  if (!report) return res.status(404).json({ error: 'NOT_FOUND' });
  const rows = report.topFlaggedRecords;
  const csv = stringify(rows, { header: true });
  logAudit('REPORT_GENERATED', req, { datasetId: req.params.datasetId, format: 'csv' });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="pramana-report-${req.params.datasetId}.csv"`);
  res.send(csv);
});

router.get('/:datasetId/pdf', requireRole('admin', 'superadmin'), (req, res) => {
  const report = buildReport(req.params.datasetId);
  if (!report) return res.status(404).json({ error: 'NOT_FOUND', message: 'Dataset not found.' });
  const safeName = String(report.datasetName).replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60).toLowerCase();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="pramana-report-${safeName || req.params.datasetId}.pdf"`);
  logAudit('REPORT_GENERATED', req, { datasetId: Number(req.params.datasetId), format: 'pdf' });
  try {
    buildReportPdf(report, res);
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ error: 'SERVER_ERROR', message: 'The PDF could not be generated.' });
  }
});

module.exports = router;
