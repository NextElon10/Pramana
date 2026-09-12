const express = require('express');
const db = require('../db');
const router = express.Router();

const NOT_AVAILABLE = 'Not provided in source data';

/**
 * Constituency reporting. A Lok Sabha member represents a named constituency; a Rajya
 * Sabha member is elected by a State Legislative Assembly and has none, so an empty
 * value there is a fact about the seat rather than a gap in the file. The two cases
 * are reported differently, and neither is ever filled in with a guessed name.
 */
/**
 * The MP-summary extract records a Rajya Sabha member's "constituency" as the literal
 * strings "Sitting Rajya Sabha" or "Nominated Rajya Sabha". Those are placeholders for
 * the absence of a constituency, not names of places, so they are treated as such
 * rather than being displayed as if they were a seat.
 */
const RS_PLACEHOLDER = /^(sitting|nominated)\s+rajya\s+sabha$/i;

function constituencyOf(r) {
  if (r.constituency && !RS_PLACEHOLDER.test(r.constituency.trim())) {
    return { constituency: r.constituency, constituencyStatus: 'provided', constituencyNote: null };
  }
  if (/rajya/i.test(r.house || '') || RS_PLACEHOLDER.test((r.constituency || '').trim())) {
    return {
      constituency: 'Not applicable — Rajya Sabha seat',
      constituencyStatus: 'not-applicable',
      constituencyNote: 'Rajya Sabha members are elected by the State Legislative Assembly and do not represent a parliamentary constituency.',
    };
  }
  return {
    constituency: NOT_AVAILABLE,
    constituencyStatus: 'missing',
    constituencyNote: 'The uploaded dataset does not carry a constituency column for this record. PRAMANA never infers one.',
  };
}

function toPublicRecord(r) {
  return {
    ...constituencyOf(r),
    id: r.id,
    datasetId: r.dataset_id,
    projectId: r.project_id || NOT_AVAILABLE,
    projectName: r.project_name || NOT_AVAILABLE,
    description: r.project_name || NOT_AVAILABLE,
    domain: r.domain || NOT_AVAILABLE,
    state: r.state || NOT_AVAILABLE,
    district: r.district || NOT_AVAILABLE,
    mp: r.mp_name || NOT_AVAILABLE,
    allocation: r.amount,
    financialYear: r.financial_year || NOT_AVAILABLE,
    house: r.house || NOT_AVAILABLE,
    memberType: r.member_type || NOT_AVAILABLE,
    status: r.status || NOT_AVAILABLE,
    // null when the source carries no photograph — the UI falls back to a sector mark.
    imageUrl: r.image_url || null,
  };
}

// GET /api/projects  — public explorer with filters + pagination
router.get('/', (req, res) => {
  const { state, district, constituency, mp, domain, house, year, q, page = 1, pageSize = 25, datasetId } = req.query;
  const where = [];
  const params = {};
  if (state) { where.push('LOWER(state) = LOWER(@state)'); params.state = state; }
  if (district) { where.push('LOWER(district) = LOWER(@district)'); params.district = district; }
  if (constituency) { where.push('LOWER(constituency) = LOWER(@constituency)'); params.constituency = constituency; }
  if (mp) { where.push('LOWER(mp_name) LIKE LOWER(@mp)'); params.mp = `%${mp}%`; }
  if (domain) { where.push('LOWER(domain) = LOWER(@domain)'); params.domain = domain; }
  if (house) { where.push('LOWER(house) LIKE LOWER(@house)'); params.house = `%${house}%`; }
  if (year) { where.push('financial_year = @year'); params.year = year; }
  if (datasetId) { where.push('dataset_id = @datasetId'); params.datasetId = datasetId; }
  if (q) {
    where.push('(LOWER(mp_name) LIKE LOWER(@q) OR LOWER(project_name) LIKE LOWER(@q) OR LOWER(state) LIKE LOWER(@q) OR LOWER(constituency) LIKE LOWER(@q) OR LOWER(project_id) LIKE LOWER(@q))');
    params.q = `%${q}%`;
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) as c FROM records ${whereSql}`).get(params).c;
  const limit = Math.min(parseInt(pageSize, 10) || 25, 200);
  const offset = (parseInt(page, 10) - 1) * limit;
  const rows = db.prepare(`SELECT * FROM records ${whereSql} ORDER BY id LIMIT @limit OFFSET @offset`).all({ ...params, limit, offset });
  res.json({ total, page: parseInt(page, 10), pageSize: limit, results: rows.map(toPublicRecord) });
});

// Public summary for the public landing page — derived only from loaded records.
router.get('/summary', (req, res) => {
  const totals = db.prepare(`
    SELECT COUNT(*) AS records,
           COUNT(DISTINCT state) AS states,
           COUNT(DISTINCT mp_name) AS members,
           SUM(amount) AS totalAllocation
    FROM records
  `).get();
  const datasets = db.prepare("SELECT COUNT(*) AS c FROM datasets WHERE status = 'analyzed'").get().c;
  const houses = db.prepare('SELECT DISTINCT house FROM records WHERE house IS NOT NULL').all().map((r) => r.house);
  // Aggregate screening counts only — no record identifies anyone, and a flag is a
  // signal for review rather than a finding.
  const flagged = db.prepare("SELECT COUNT(*) AS c FROM anomalies WHERE classification != 'Normal'").get().c;
  const normal = db.prepare("SELECT COUNT(*) AS c FROM anomalies WHERE classification = 'Normal'").get().c;
  res.json({
    records: totals.records || 0,
    states: totals.states || 0,
    members: totals.members || 0,
    totalAllocation: totals.totalAllocation || 0,
    datasets,
    houses,
    flagged,
    normal,
  });
});

// Which mapped fields actually carry data. The UI uses this to hide columns that
// would otherwise be a wall of "not available", instead of showing empty structure.
router.get('/field-availability', (req, res) => {
  const fields = {
    projectId: 'project_id',
    projectName: 'project_name',
    domain: 'domain',
    state: 'state',
    district: 'district',
    constituency: 'constituency',
    mp: 'mp_name',
    financialYear: 'financial_year',
    house: 'house',
    memberType: 'member_type',
    status: 'status',
    imageUrl: 'image_url',
    allocation: 'amount',
  };
  const total = db.prepare('SELECT COUNT(*) AS c FROM records').get().c;
  const availability = {};
  for (const [key, column] of Object.entries(fields)) {
    const filled = db.prepare(`SELECT COUNT(*) AS c FROM records WHERE ${column} IS NOT NULL AND ${column} != ''`).get().c;
    availability[key] = { filled, total, ratio: total ? filled / total : 0, present: filled > 0 };
  }
  res.json({ total, availability });
});

router.get('/domains', (req, res) => {
  const rows = db.prepare(`SELECT domain, COUNT(*) as count, SUM(amount) as total, AVG(amount) as avg FROM records WHERE domain IS NOT NULL GROUP BY domain ORDER BY count DESC`).all();
  res.json({ domains: rows });
});

router.get('/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM records WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'NOT_FOUND', message: 'Project record not found.' });
  res.json(toPublicRecord(r));
});

module.exports = router;
