/**
 * Performance API — state-level fund utilisation and member comparison.
 *
 * Everything here is aggregated from the loaded records. A field the source dataset
 * does not carry stays null and is reported as absent; nothing is estimated, and no
 * figure is derived from anything other than the columns actually ingested.
 *
 * Utilisation follows the definition used by the source extract: recommended amount
 * as a share of allocation. Expenditure is reported separately as its own ratio,
 * because the two answer different questions — what a member has committed, and what
 * has actually been paid out.
 */
const express = require('express');
const { stringify } = require('csv-stringify/sync');
const db = require('../db');
const { sanitizeForCsv } = require('../utils/clean');

const router = express.Router();

/** Normalises the House filter to a SQL fragment. "both" (or absent) means no filter. */
function houseFilter(raw) {
  const value = String(raw || 'both').toLowerCase();
  if (value.startsWith('lok')) return { sql: "AND house LIKE 'Lok%'", label: 'Lok Sabha' };
  if (value.startsWith('rajya')) return { sql: "AND house LIKE 'Rajya%'", label: 'Rajya Sabha' };
  return { sql: '', label: 'Both Houses' };
}

/** Utilisation band. Thresholds come from the request brief, not from the data. */
function band(pct) {
  if (pct === null || pct === undefined) return 'unknown';
  if (pct >= 80) return 'high';
  if (pct >= 50) return 'medium';
  return 'low';
}

function ratio(part, whole) {
  if (!whole || part === null || part === undefined) return null;
  return (part / whole) * 100;
}

/* -------------------------------------------------------------------------- */
/* States                                                                      */
/* -------------------------------------------------------------------------- */

function stateRows(house) {
  const { sql } = houseFilter(house);
  const rows = db.prepare(`
    SELECT state,
           COUNT(*)                       AS mps,
           SUM(amount)                    AS allocated,
           SUM(expenditure)               AS expenditure,
           SUM(recommended_amount)        AS recommended,
           SUM(works_completed)           AS worksCompleted,
           SUM(works_recommended)         AS worksRecommended,
           COUNT(expenditure)             AS expenditureRows
    FROM records
    WHERE state IS NOT NULL ${sql}
    GROUP BY state
    ORDER BY SUM(amount) DESC
  `).all();

  return rows.map((r, i) => {
    // Utilisation is only meaningful where the dataset actually carries the figures.
    const utilization = r.recommended !== null ? ratio(r.recommended, r.allocated) : null;
    const expenditureShare = r.expenditure !== null ? ratio(r.expenditure, r.allocated) : null;
    const completionRate = r.worksRecommended ? ratio(r.worksCompleted, r.worksRecommended) : null;
    return {
      id: i + 1,
      state: r.state,
      mps: r.mps,
      allocated: r.allocated || 0,
      expenditure: r.expenditure,
      recommended: r.recommended,
      utilization,
      utilizationBand: band(utilization),
      expenditureShare,
      worksCompleted: r.worksCompleted,
      worksRecommended: r.worksRecommended,
      completionRate,
      hasPerformanceData: r.expenditure !== null || r.recommended !== null,
    };
  });
}

/** GET /api/performance/states?house=&band=&q= */
router.get('/states', (req, res) => {
  const { label } = houseFilter(req.query.house);
  let rows = stateRows(req.query.house);

  const q = String(req.query.q || '').trim().toLowerCase();
  if (q) rows = rows.filter((r) => r.state.toLowerCase().includes(q));

  const wanted = String(req.query.band || 'all').toLowerCase();
  if (['high', 'medium', 'low'].includes(wanted)) rows = rows.filter((r) => r.utilizationBand === wanted);

  const totals = rows.reduce((a, r) => ({
    mps: a.mps + r.mps,
    allocated: a.allocated + (r.allocated || 0),
    expenditure: a.expenditure + (r.expenditure || 0),
    recommended: a.recommended + (r.recommended || 0),
    worksCompleted: a.worksCompleted + (r.worksCompleted || 0),
    worksRecommended: a.worksRecommended + (r.worksRecommended || 0),
  }), { mps: 0, allocated: 0, expenditure: 0, recommended: 0, worksCompleted: 0, worksRecommended: 0 });

  res.json({
    house: label,
    states: rows,
    totals: {
      ...totals,
      utilization: ratio(totals.recommended, totals.allocated),
      expenditureShare: ratio(totals.expenditure, totals.allocated),
      completionRate: ratio(totals.worksCompleted, totals.worksRecommended),
    },
    // Bands are a presentation device applied to a real ratio, stated openly.
    bandDefinition: { high: '≥ 80%', medium: '50–79%', low: '< 50%', basis: 'recommended amount as a share of allocation' },
  });
});

/** GET /api/performance/states.csv — the same table an official is looking at. */
router.get('/states.csv', (req, res) => {
  const { label } = houseFilter(req.query.house);
  const rows = stateRows(req.query.house).map((r) => ({
    'State / UT': r.state,
    House: label,
    MPs: r.mps,
    'Total allocated (INR)': r.allocated,
    'Total expenditure (INR)': r.expenditure ?? 'not in dataset',
    'Amount recommended (INR)': r.recommended ?? 'not in dataset',
    'Fund utilisation (%)': r.utilization === null ? 'not in dataset' : r.utilization.toFixed(2),
    'Expenditure share (%)': r.expenditureShare === null ? 'not in dataset' : r.expenditureShare.toFixed(2),
    'Works completed': r.worksCompleted ?? 'not in dataset',
    'Works recommended': r.worksRecommended ?? 'not in dataset',
  }));
  const sanitized = rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, sanitizeForCsv(v)])));
  const csv = stringify(sanitized, { header: true });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="pramana-state-utilisation-${label.replace(/\s+/g, '-').toLowerCase()}.csv"`);
  res.send(csv);
});

/* -------------------------------------------------------------------------- */
/* Members and comparison                                                      */
/* -------------------------------------------------------------------------- */

function memberRow(r) {
  const utilization = r.utilization !== null && r.utilization !== undefined
    ? r.utilization
    : ratio(r.recommended_amount, r.amount);
  const inProgress = r.works_recommended !== null && r.works_completed !== null
    ? Math.max(0, r.works_recommended - r.works_completed)
    : null;
  return {
    id: r.id,
    mp: r.mp_name,
    state: r.state,
    house: r.house,
    // A Rajya Sabha member has no constituency; the extract stores a placeholder there.
    constituency: r.constituency && !/^(sitting|nominated)\s+rajya\s+sabha$/i.test(r.constituency.trim())
      ? r.constituency
      : null,
    allocated: r.amount,
    expenditure: r.expenditure,
    recommended: r.recommended_amount,
    utilization,
    utilizationBand: band(utilization),
    expenditureShare: ratio(r.expenditure, r.amount),
    worksCompleted: r.works_completed,
    worksRecommended: r.works_recommended,
    worksInProgress: inProgress,
    completionRate: r.completion_rate,
    balanceUnpaid: r.balance_unpaid,
    transactions: r.transactions,
  };
}

/** GET /api/performance/members?house=&q=&limit= — the comparison picker's options. */
router.get('/members', (req, res) => {
  const { sql, label } = houseFilter(req.query.house);
  const q = String(req.query.q || '').trim();
  const limit = Math.min(parseInt(req.query.limit, 10) || 400, 1000);

  const where = [`mp_name IS NOT NULL ${sql}`];
  const params = {};
  if (q) {
    where.push('(LOWER(mp_name) LIKE LOWER(@q) OR LOWER(state) LIKE LOWER(@q) OR LOWER(constituency) LIKE LOWER(@q))');
    params.q = `%${q}%`;
  }
  const rows = db.prepare(`
    SELECT * FROM records WHERE ${where.join(' AND ')} ORDER BY mp_name LIMIT @limit
  `).all({ ...params, limit });

  res.json({ house: label, total: rows.length, members: rows.map(memberRow) });
});

/** GET /api/performance/compare?ids=1,2,3,4 — up to four members side by side. */
router.get('/compare', (req, res) => {
  const ids = String(req.query.ids || '')
    .split(',')
    .map((v) => parseInt(v, 10))
    .filter((v) => Number.isInteger(v))
    .slice(0, 4);

  if (!ids.length) return res.json({ members: [], notes: [] });

  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(`SELECT * FROM records WHERE id IN (${placeholders})`).all(...ids);
  // Preserve the order the caller asked for.
  const byId = new Map(rows.map((r) => [r.id, r]));
  const members = ids.map((id) => byId.get(id)).filter(Boolean).map(memberRow);

  // Fields a comparison of this kind would normally show but this data cannot supply.
  const notes = [];
  if (members.length) {
    notes.push('Party affiliation is not present in the MPLADS extract, so it is not shown.');
    if (members.some((m) => m.expenditure === null)) {
      notes.push('One or more selected records come from a dataset without expenditure figures.');
    }
  }
  res.json({ members, notes });
});

/* -------------------------------------------------------------------------- */
/* House-aware headline summary                                                */
/* -------------------------------------------------------------------------- */

/** GET /api/performance/summary?house= */
router.get('/summary', (req, res) => {
  const { sql, label } = houseFilter(req.query.house);
  const t = db.prepare(`
    SELECT COUNT(*)                AS members,
           COUNT(DISTINCT state)   AS states,
           SUM(amount)             AS allocated,
           SUM(expenditure)        AS expenditure,
           SUM(recommended_amount) AS recommended,
           SUM(works_completed)    AS worksCompleted,
           SUM(works_recommended)  AS worksRecommended
    FROM records WHERE 1 = 1 ${sql}
  `).get();

  const flagged = db.prepare(`
    SELECT COUNT(*) AS c FROM anomalies a JOIN records r ON a.record_id = r.id
    WHERE a.classification != 'Normal' ${sql.replace(/house/g, 'r.house')}
  `).get().c;
  const normal = db.prepare(`
    SELECT COUNT(*) AS c FROM anomalies a JOIN records r ON a.record_id = r.id
    WHERE a.classification = 'Normal' ${sql.replace(/house/g, 'r.house')}
  `).get().c;

  res.json({
    house: label,
    members: t.members || 0,
    states: t.states || 0,
    allocated: t.allocated || 0,
    expenditure: t.expenditure,
    recommended: t.recommended,
    utilization: ratio(t.recommended, t.allocated),
    expenditureShare: ratio(t.expenditure, t.allocated),
    worksCompleted: t.worksCompleted,
    worksRecommended: t.worksRecommended,
    completionRate: ratio(t.worksCompleted, t.worksRecommended),
    flagged,
    normal,
  });
});

module.exports = router;
