const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { median: medianFn, percentile } = require('../utils/stats');
const router = express.Router();

// KPI overview
router.get('/kpis', requireAuth, (req, res) => {
  const total = db.prepare('SELECT COUNT(*) c FROM records').get().c;
  const byClass = db.prepare(`SELECT classification, COUNT(*) c FROM anomalies GROUP BY classification`).all();
  const classMap = Object.fromEntries(byClass.map((r) => [r.classification, r.c]));
  const requiresReview = db.prepare(`SELECT COUNT(*) c FROM anomalies WHERE review_status = 'Unreviewed' AND classification != 'Normal'`).get().c;
  const normalCount = total - byClass.filter(b => b.classification !== 'Normal').reduce((s, b) => s + b.c, 0);
  res.json({
    totalRecords: total,
    normal: normalCount,
    slightlyUnusual: classMap['Slightly Unusual'] || 0,
    unusual: classMap['Unusual'] || 0,
    highlyUnusual: classMap['Highly Unusual'] || 0,
    extreme: classMap['Extreme Statistical Anomaly'] || 0,
    requiresReview,
  });
});

router.get('/risk-distribution', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT classification, COUNT(*) c FROM anomalies GROUP BY classification`).all();
  res.json({ distribution: rows });
});

router.get('/charts/allocation-distribution', requireAuth, (req, res) => {
  const amounts = db.prepare('SELECT amount FROM records WHERE amount IS NOT NULL').all().map(r => r.amount);
  const buckets = 20;
  if (!amounts.length) return res.json({ buckets: [] });
  const min = Math.min(...amounts), max = Math.max(...amounts);
  const width = (max - min) / buckets || 1;
  const hist = Array.from({ length: buckets }, (_, i) => ({ rangeStart: min + i * width, rangeEnd: min + (i + 1) * width, count: 0 }));
  amounts.forEach((a) => {
    let idx = Math.floor((a - min) / width);
    if (idx >= buckets) idx = buckets - 1;
    if (idx < 0) idx = 0;
    hist[idx].count++;
  });
  res.json({ buckets: hist, min, max });
});

router.get('/charts/top-allocations', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT id, mp_name, state, project_name, amount FROM records WHERE amount IS NOT NULL ORDER BY amount DESC LIMIT 20`).all();
  res.json({ top: rows });
});

router.get('/charts/state-totals', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT state, SUM(amount) total, AVG(amount) avg, COUNT(*) count FROM records WHERE state IS NOT NULL GROUP BY state ORDER BY total DESC`).all();
  res.json({ states: rows });
});

router.get('/charts/domain-allocation', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT domain, SUM(amount) total, COUNT(*) count FROM records WHERE domain IS NOT NULL GROUP BY domain ORDER BY total DESC`).all();
  res.json({ domains: rows });
});

router.get('/charts/method-contribution', requireAuth, (req, res) => {
  const flags = ['iqr_flag', 'z_flag', 'modz_flag', 'pct99_flag'];
  const labels = { iqr_flag: 'IQR', z_flag: 'Z-score', modz_flag: 'Modified Z-score', pct99_flag: '99th Percentile' };
  const rows = flags.map((f) => ({ method: labels[f], count: db.prepare(`SELECT COUNT(*) c FROM anomalies WHERE ${f} = 1`).get().c }));
  res.json({ methods: rows });
});

router.get('/charts/time-trend', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT financial_year as year, SUM(amount) total, COUNT(*) count FROM records WHERE financial_year IS NOT NULL GROUP BY financial_year ORDER BY financial_year`).all();
  if (!rows.length) return res.json({ trend: [], available: false });
  res.json({ trend: rows, available: true });
});

// MP analytics + peer comparison
router.get('/mps', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT mp_name, state, house, COUNT(*) projectCount, SUM(amount) total, AVG(amount) avg
    FROM records WHERE mp_name IS NOT NULL GROUP BY mp_name, state ORDER BY total DESC LIMIT 500
  `).all();
  res.json({ mps: rows });
});

router.get('/mps/:name/profile', requireAuth, (req, res) => {
  const projects = db.prepare('SELECT * FROM records WHERE LOWER(mp_name) = LOWER(?)').all(req.params.name);
  if (!projects.length) return res.status(404).json({ error: 'NOT_FOUND', message: 'MP not found in current datasets.' });
  const amounts = projects.map(p => p.amount).filter(a => a !== null);
  const state = projects[0].state;
  const house = projects[0].house;

  const peerRows = db.prepare('SELECT amount FROM records WHERE state = ? AND amount IS NOT NULL').all(state).map(r => r.amount);
  const nationalRows = db.prepare('SELECT amount FROM records WHERE amount IS NOT NULL').all().map(r => r.amount);
  const total = amounts.reduce((a, b) => a + b, 0);

  const anomalyRows = db.prepare(`
    SELECT a.* FROM anomalies a JOIN records r ON a.record_id = r.id WHERE LOWER(r.mp_name) = LOWER(?)
  `).all(req.params.name);
  const anomalyCount = anomalyRows.filter(a => a.classification !== 'Normal').length;

  res.json({
    mp: projects[0].mp_name,
    state,
    house,
    constituency: projects[0].constituency,
    projectCount: projects.length,
    totalAllocation: total,
    avgAllocation: amounts.length ? total / amounts.length : 0,
    medianAllocation: medianFn(amounts),
    peerComparison: {
      stateMedian: medianFn(peerRows),
      nationalMedian: medianFn(nationalRows),
      percentileNational: nationalRows.length ? (nationalRows.filter(v => v < (total / (amounts.length || 1))).length / nationalRows.length) * 100 : 0,
    },
    anomalySignals: {
      count: anomalyCount,
      records: anomalyRows,
    },
    projects,
    disclaimer: 'Statistical deviation does not indicate wrongdoing. All signals require human review.',
  });
});

module.exports = router;
