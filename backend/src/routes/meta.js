const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// Multi-dataset overview: relationship status, matches, independent analysis.
router.get('/overview', requireAuth, (req, res) => {
  const datasets = db.prepare('SELECT id, name, status, row_count, is_demo FROM datasets').all();
  const matches = db.prepare('SELECT dataset_a, dataset_b, COUNT(*) c FROM cross_matches GROUP BY dataset_a, dataset_b').all();
  const pairs = [];
  for (let i = 0; i < datasets.length; i++) {
    for (let j = i + 1; j < datasets.length; j++) {
      const a = datasets[i], b = datasets[j];
      const m = matches.find(x => (x.dataset_a === a.id && x.dataset_b === b.id));
      let relationship = 'NO COMPATIBLE RELATIONSHIP FOUND';
      if (m && m.c > 0) {
        const minSize = Math.min(a.row_count, b.row_count) || 1;
        relationship = m.c / minSize > 0.5 ? 'CONNECTED' : 'PARTIALLY CONNECTED';
      }
      pairs.push({ datasetA: a.name, datasetB: b.name, matches: m ? m.c : 0, relationship });
    }
  }
  const duplicateSignals = db.prepare('SELECT COUNT(*) c FROM records WHERE is_duplicate = 1').get().c;
  res.json({
    datasetsConnected: pairs.filter(p => p.relationship !== 'NO COMPATIBLE RELATIONSHIP FOUND').length,
    datasetsIndependent: pairs.filter(p => p.relationship === 'NO COMPATIBLE RELATIONSHIP FOUND').length,
    totalDatasets: datasets.length,
    crossDatasetActive: datasets.filter(d => d.status === 'analyzed').length >= 2,
    entitiesMatched: matches.reduce((s, m) => s + m.c, 0),
    duplicateSignals,
    relationships: pairs,
  });
});

// Relationship graph nodes/edges (simplified, derived from current data — no invented entities).
router.get('/graph', requireAuth, (req, res) => {
  const datasets = db.prepare('SELECT id, name FROM datasets').all();
  const nodes = [];
  const edges = [];
  datasets.forEach(d => {
    nodes.push({ id: `dataset-${d.id}`, type: 'Dataset', label: d.name });
    const states = db.prepare('SELECT DISTINCT state FROM records WHERE dataset_id = ? AND state IS NOT NULL LIMIT 40').all(d.id);
    states.forEach(s => {
      const nodeId = `state-${s.state}`;
      if (!nodes.find(n => n.id === nodeId)) nodes.push({ id: nodeId, type: 'State', label: s.state });
      edges.push({ source: `dataset-${d.id}`, target: nodeId, type: 'CONTAINS' });
    });
  });
  res.json({ nodes, edges });
});

module.exports = router;
