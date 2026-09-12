const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../db');
const { requireAuth, requireRole, logAudit } = require('../middleware/auth');
const { previewDataset, ingestDataset } = require('../utils/ingest');
const { runStatisticalAnalysis, runCrossDatasetMatching } = require('../utils/analysisEngine');

const router = express.Router();

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXT = ['.csv', '.xlsx'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      const err = new Error('Only .csv and .xlsx files are supported.');
      err.code = 'UNSUPPORTED_FILE';
      return cb(err);
    }
    cb(null, true);
  },
});

/** Wrap multer so its errors become typed JSON instead of a 500. */
function handleUpload(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'UPLOAD_FAILED', message: 'File exceeds the 25 MB limit.' });
    }
    if (err.code === 'UNSUPPORTED_FILE') {
      return res.status(400).json({ error: 'UNSUPPORTED_FILE', message: err.message });
    }
    return res.status(400).json({ error: 'UPLOAD_FAILED', message: 'The file could not be read.' });
  });
}

function enrich(d) {
  return {
    ...d,
    stats: d.stats_json ? JSON.parse(d.stats_json) : null,
    columns: JSON.parse(d.columns_json || '[]'),
    schemaMap: JSON.parse(d.schema_map_json || '{}'),
  };
}

// PREVIEW (admin only) — nothing is persisted.
router.post('/preview', requireRole('admin', 'superadmin'), handleUpload, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'INVALID_FILE', message: 'No file was provided.' });
  try {
    res.json(await previewDataset(req.file.buffer, req.file.originalname));
  } catch (e) {
    const code = e.code === 'UNSUPPORTED_FILE' ? 'UNSUPPORTED_FILE'
      : e.code === 'INVALID_FILE' ? 'INVALID_FILE' : 'SCHEMA_DETECTION_FAILED';
    res.status(400).json({ error: code, message: e.message });
  }
});

// UPLOAD + CONFIRM (admin only) — persists and runs the full analysis.
router.post('/upload', requireRole('admin', 'superadmin'), handleUpload, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'INVALID_FILE', message: 'No file was provided.' });
  try {
    let schemaOverride = null;
    if (req.body.schemaOverride) {
      try { schemaOverride = JSON.parse(req.body.schemaOverride); }
      catch { return res.status(400).json({ error: 'INVALID_INPUT', message: 'schemaOverride must be valid JSON.' }); }
    }
    const result = await ingestDataset({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      name: (req.body.name || req.file.originalname).slice(0, 200),
      source: (req.body.source || 'Administrator upload').slice(0, 200),
      house: req.body.house || null,
      uploadedBy: req.user.id,
      schemaOverride,
    });
    logAudit('DATASET_UPLOAD', req, { datasetId: result.datasetId, filename: req.file.originalname, rows: result.rows });
    res.status(201).json(result);
  } catch (e) {
    const code = ['UNSUPPORTED_FILE', 'INVALID_FILE'].includes(e.code) ? e.code : 'ANALYSIS_FAILED';
    res.status(400).json({ error: code, message: e.message });
  }
});

router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM datasets ORDER BY uploaded_at DESC, id DESC').all().map(enrich);
  res.json({
    datasets: rows,
    count: rows.length,
    crossDatasetActive: rows.filter((d) => d.status === 'analyzed').length >= 2,
  });
});

router.get('/:id', requireAuth, (req, res) => {
  const d = db.prepare('SELECT * FROM datasets WHERE id = ?').get(req.params.id);
  if (!d) return res.status(404).json({ error: 'NOT_FOUND', message: 'Dataset not found.' });
  res.json(enrich(d));
});

router.post('/:id/reanalyze', requireRole('admin', 'superadmin'), (req, res) => {
  const d = db.prepare('SELECT * FROM datasets WHERE id = ?').get(req.params.id);
  if (!d) return res.status(404).json({ error: 'NOT_FOUND', message: 'Dataset not found.' });
  try {
    const summary = runStatisticalAnalysis(d.id);
    runCrossDatasetMatching();
    logAudit('DATASET_REANALYZE', req, { datasetId: d.id });
    res.json({ summary });
  } catch (e) {
    res.status(500).json({ error: 'ANALYSIS_FAILED', message: 'The dataset could not be re-analysed.' });
  }
});

router.delete('/:id', requireRole('superadmin'), (req, res) => {
  const d = db.prepare('SELECT * FROM datasets WHERE id = ?').get(req.params.id);
  if (!d) return res.status(404).json({ error: 'NOT_FOUND', message: 'Dataset not found.' });
  db.prepare('DELETE FROM datasets WHERE id = ?').run(req.params.id);
  runCrossDatasetMatching();
  logAudit('DATASET_DELETE', req, { datasetId: Number(req.params.id), name: d.name });
  res.json({ message: 'Dataset deleted.' });
});

router.get('/:id/duplicates', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM records WHERE dataset_id = ? AND is_duplicate = 1').all(req.params.id);
  res.json({ duplicates: rows, count: rows.length });
});

module.exports = router;
