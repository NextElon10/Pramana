const express = require('express');
const db = require('../db');
const { median: medianFn } = require('../utils/stats');
const router = express.Router();

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT state,
      COUNT(*) as projectCount,
      SUM(amount) as totalAllocation,
      AVG(amount) as avgAllocation
    FROM records WHERE state IS NOT NULL GROUP BY state ORDER BY totalAllocation DESC
  `).all();

  const anomalyCounts = db.prepare(`
    SELECT r.state as state, COUNT(*) as anomalyCount
    FROM anomalies a JOIN records r ON a.record_id = r.id
    WHERE a.classification != 'Normal' AND r.state IS NOT NULL
    GROUP BY r.state
  `).all();
  const anomalyMap = Object.fromEntries(anomalyCounts.map((a) => [a.state, a.anomalyCount]));

  const enriched = rows.map((s) => {
    const amounts = db.prepare('SELECT amount FROM records WHERE state = ? AND amount IS NOT NULL').all(s.state).map(r => r.amount);
    const anomalyCount = anomalyMap[s.state] || 0;
    return {
      state: s.state,
      projectCount: s.projectCount,
      totalAllocation: s.totalAllocation || 0,
      avgAllocation: s.avgAllocation || 0,
      medianAllocation: medianFn(amounts),
      anomalyCount,
      anomalyRate: s.projectCount ? anomalyCount / s.projectCount : 0,
    };
  });
  res.json({ states: enriched });
});

router.get('/:name', (req, res) => {
  const s = db.prepare('SELECT state, COUNT(*) as projectCount, SUM(amount) as totalAllocation, AVG(amount) as avgAllocation FROM records WHERE LOWER(state) = LOWER(?)').get(req.params.name);
  if (!s || !s.projectCount) return res.status(404).json({ error: 'NOT_FOUND', message: 'No records found for this state in the current dataset.' });
  const domains = db.prepare('SELECT domain, COUNT(*) as count FROM records WHERE LOWER(state) = LOWER(?) AND domain IS NOT NULL GROUP BY domain').all(req.params.name);
  res.json({ ...s, domains });
});

module.exports = router;
