/**
 * Every database read PRAMANA AI is allowed to make.
 *
 * The assistant never writes SQL of its own and never reaches into `db` directly.
 * It asks this module for a shape — a ranking, a state profile, a review queue —
 * and this module decides how that is fetched. Two consequences matter:
 *
 *   • Column names are whitelisted here, so a question can never steer a query.
 *   • The engine can be unit-tested against a stub repository, because every fact
 *     it uses enters through this one surface.
 */
const db = require('../db');

/* -------------------------------------------------------------------------- */
/* Metric whitelist                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The measurable columns, each with how it aggregates across a group of members.
 * `sum` totals (money, counts); `ratio` is recomputed from its parts, because the
 * average of percentages is not the percentage of the totals.
 */
const METRICS = {
  allocation: {
    column: 'amount', label: 'allocated limit', kind: 'money', group: 'sum',
  },
  recommended: {
    column: 'recommended_amount', label: 'amount recommended', kind: 'money', group: 'sum',
  },
  expenditure: {
    column: 'expenditure', label: 'amount actually paid out', kind: 'money', group: 'sum',
  },
  unpaid: {
    column: 'balance_unpaid', label: 'unpaid balance', kind: 'money', group: 'sum',
  },
  utilisation: {
    column: 'utilization',
    label: 'fund utilisation',
    kind: 'percent',
    group: 'ratio',
    numerator: 'recommended_amount',
    denominator: 'amount',
  },
  completion: {
    column: 'completion_rate',
    label: 'works completion rate',
    kind: 'percent',
    group: 'ratio',
    numerator: 'works_completed',
    denominator: 'works_recommended',
  },
  worksCompleted: {
    column: 'works_completed', label: 'works completed', kind: 'count', group: 'sum',
  },
  worksRecommended: {
    column: 'works_recommended', label: 'works recommended', kind: 'count', group: 'sum',
  },
  transactions: {
    column: 'transactions', label: 'transactions', kind: 'count', group: 'sum',
  },
};

function metric(name) {
  return METRICS[name] || METRICS.allocation;
}

/* -------------------------------------------------------------------------- */
/* Filters                                                                     */
/* -------------------------------------------------------------------------- */

function houseClause(house, alias = '') {
  const col = alias ? `${alias}.house` : 'house';
  const v = String(house || 'both').toLowerCase();
  if (v.startsWith('lok')) return `AND ${col} LIKE 'Lok%'`;
  if (v.startsWith('rajya')) return `AND ${col} LIKE 'Rajya%'`;
  return '';
}

const dir = (d) => (String(d).toLowerCase() === 'asc' ? 'ASC' : 'DESC');
const cap = (n, max = 25) => Math.max(1, Math.min(Number(n) || 5, max));

/* -------------------------------------------------------------------------- */
/* Portfolio-level reads                                                       */
/* -------------------------------------------------------------------------- */

function totals(house = 'both') {
  const hc = houseClause(house);
  const row = db.prepare(`
    SELECT COUNT(*) AS records,
           COUNT(DISTINCT state) AS states,
           COUNT(DISTINCT mp_name) AS members,
           COUNT(DISTINCT constituency) AS constituencies,
           SUM(amount) AS allocated,
           AVG(amount) AS avgAllocation,
           SUM(recommended_amount) AS recommended,
           SUM(expenditure) AS expenditure,
           SUM(balance_unpaid) AS unpaid,
           SUM(works_completed) AS worksCompleted,
           SUM(works_recommended) AS worksRecommended,
           SUM(transactions) AS transactions
    FROM records WHERE 1 = 1 ${hc}
  `).get() || {};
  return {
    records: row.records || 0,
    states: row.states || 0,
    members: row.members || 0,
    constituencies: row.constituencies || 0,
    allocated: row.allocated || 0,
    avgAllocation: row.avgAllocation || 0,
    recommended: row.recommended,
    expenditure: row.expenditure,
    unpaid: row.unpaid,
    worksCompleted: row.worksCompleted,
    worksRecommended: row.worksRecommended,
    transactions: row.transactions,
  };
}

function houseSplit() {
  return db.prepare(`
    SELECT house,
           COUNT(*) AS records,
           COUNT(DISTINCT mp_name) AS members,
           SUM(amount) AS allocated,
           SUM(recommended_amount) AS recommended,
           SUM(expenditure) AS expenditure,
           SUM(works_completed) AS worksCompleted,
           SUM(works_recommended) AS worksRecommended
    FROM records WHERE house IS NOT NULL
    GROUP BY house ORDER BY allocated DESC
  `).all();
}

function datasets() {
  return db.prepare(`
    SELECT id, name, house, row_count, column_count, status, is_demo, uploaded_at, analyzed_at
    FROM datasets ORDER BY id
  `).all();
}

function financialYears(house = 'both') {
  return db.prepare(`
    SELECT financial_year AS year, COUNT(*) AS records, SUM(amount) AS allocated,
           SUM(expenditure) AS expenditure
    FROM records WHERE financial_year IS NOT NULL ${houseClause(house)}
    GROUP BY financial_year ORDER BY financial_year DESC LIMIT 12
  `).all();
}

function domains(house = 'both', limit = 10) {
  return db.prepare(`
    SELECT domain, COUNT(*) AS records, SUM(amount) AS allocated
    FROM records WHERE domain IS NOT NULL AND TRIM(domain) != '' ${houseClause(house)}
    GROUP BY domain ORDER BY allocated DESC LIMIT ${cap(limit, 20)}
  `).all();
}

/* -------------------------------------------------------------------------- */
/* Rankings                                                                    */
/* -------------------------------------------------------------------------- */

/** Individual members ordered by one measurable column. */
function memberRanking({
  metric: metricName = 'allocation', direction = 'desc', limit = 5, house = 'both', state = null,
} = {}) {
  const m = metric(metricName);
  const stmt = db.prepare(`
    SELECT r.id, r.mp_name, r.state, r.constituency, r.house,
           r.amount, r.recommended_amount, r.expenditure, r.utilization,
           r.works_completed, r.works_recommended, r.completion_rate,
           r.${m.column} AS value
    FROM records r
    WHERE r.${m.column} IS NOT NULL AND r.mp_name IS NOT NULL
      ${houseClause(house, 'r')} ${state ? 'AND r.state = @state' : ''}
    ORDER BY value ${dir(direction)}, r.mp_name ASC
    LIMIT ${cap(limit)}
  `);
  // Bound parameters are passed only when the statement actually declares one.
  const rows = state ? stmt.all({ state }) : stmt.all();
  return { metric: m, metricKey: metricName in METRICS ? metricName : 'allocation', rows };
}

/** States ordered by one measurable column, aggregated correctly for its kind. */
function stateRanking({
  metric: metricName = 'allocation', direction = 'desc', limit = 5, house = 'both',
} = {}) {
  const m = metric(metricName);
  const value = m.group === 'ratio'
    ? `CASE WHEN SUM(${m.denominator}) > 0 THEN SUM(${m.numerator}) * 100.0 / SUM(${m.denominator}) END`
    : `SUM(${m.column})`;
  const rows = db.prepare(`
    SELECT state, COUNT(*) AS records, COUNT(DISTINCT mp_name) AS members,
           SUM(amount) AS allocated, SUM(expenditure) AS expenditure,
           SUM(works_completed) AS worksCompleted, SUM(works_recommended) AS worksRecommended,
           ${value} AS value
    FROM records WHERE state IS NOT NULL ${houseClause(house)}
    GROUP BY state HAVING value IS NOT NULL
    ORDER BY value ${dir(direction)}, state ASC LIMIT ${cap(limit)}
  `).all();
  return { metric: m, metricKey: metricName in METRICS ? metricName : 'allocation', rows };
}

/* -------------------------------------------------------------------------- */
/* Places                                                                      */
/* -------------------------------------------------------------------------- */

function stateNames() {
  return db.prepare('SELECT DISTINCT state FROM records WHERE state IS NOT NULL ORDER BY state')
    .all().map((r) => r.state);
}

function stateProfile(state, house = 'both') {
  const row = db.prepare(`
    SELECT state, COUNT(*) AS records, COUNT(DISTINCT mp_name) AS members,
           COUNT(DISTINCT constituency) AS constituencies,
           SUM(amount) AS allocated, AVG(amount) AS avgAllocation,
           MIN(amount) AS minAllocation, MAX(amount) AS maxAllocation,
           SUM(recommended_amount) AS recommended, SUM(expenditure) AS expenditure,
           SUM(balance_unpaid) AS unpaid,
           SUM(works_completed) AS worksCompleted, SUM(works_recommended) AS worksRecommended
    FROM records WHERE state = @state ${houseClause(house)} GROUP BY state
  `).get({ state });
  if (!row) return null;

  const flagged = db.prepare(`
    SELECT COUNT(*) AS c FROM anomalies a JOIN records r ON a.record_id = r.id
    WHERE r.state = @state AND a.classification != 'Normal' ${houseClause(house, 'r')}
  `).get({ state });

  const rank = db.prepare(`
    SELECT COUNT(*) + 1 AS rank FROM (
      SELECT state, SUM(amount) AS total FROM records WHERE state IS NOT NULL ${houseClause(house)}
      GROUP BY state
    ) WHERE total > (SELECT SUM(amount) FROM records WHERE state = @state ${houseClause(house)})
  `).get({ state });

  return { ...row, flagged: flagged ? flagged.c : 0, allocationRank: rank ? rank.rank : null };
}

function districtsIn(state, limit = 8) {
  return db.prepare(`
    SELECT district, COUNT(*) AS records, SUM(amount) AS allocated
    FROM records WHERE state = @state AND district IS NOT NULL AND TRIM(district) != ''
    GROUP BY district ORDER BY allocated DESC LIMIT ${cap(limit, 15)}
  `).all({ state });
}

function membersIn(state, house = 'both', limit = 10) {
  return db.prepare(`
    SELECT id, mp_name, constituency, house, amount, utilization, works_completed, works_recommended
    FROM records WHERE state = @state AND mp_name IS NOT NULL ${houseClause(house)}
    ORDER BY amount DESC LIMIT ${cap(limit, 30)}
  `).all({ state });
}

/* -------------------------------------------------------------------------- */
/* Screening and review                                                        */
/* -------------------------------------------------------------------------- */

function anomalySummary(house = 'both') {
  const hc = houseClause(house, 'r');
  const byClass = db.prepare(`
    SELECT a.classification, COUNT(*) AS count FROM anomalies a JOIN records r ON a.record_id = r.id
    WHERE 1 = 1 ${hc} GROUP BY a.classification ORDER BY count DESC
  `).all();
  const byMethod = db.prepare(`
    SELECT SUM(a.iqr_flag) AS iqr, SUM(a.z_flag) AS z, SUM(a.modz_flag) AS modz,
           SUM(a.pct95_flag) AS pct95, SUM(a.pct99_flag) AS pct99,
           SUM(a.cross_dataset_flag) AS crossDataset
    FROM anomalies a JOIN records r ON a.record_id = r.id WHERE 1 = 1 ${hc}
  `).get() || {};
  const counts = db.prepare(`
    SELECT COUNT(*) AS analysed,
           SUM(CASE WHEN a.classification != 'Normal' THEN 1 ELSE 0 END) AS flagged,
           SUM(CASE WHEN a.classification != 'Normal' AND a.review_status = 'Unreviewed' THEN 1 ELSE 0 END) AS unreviewed,
           SUM(CASE WHEN a.review_status = 'Confirmed' THEN 1 ELSE 0 END) AS confirmed,
           SUM(CASE WHEN a.review_status = 'Dismissed' THEN 1 ELSE 0 END) AS dismissed
    FROM anomalies a JOIN records r ON a.record_id = r.id WHERE 1 = 1 ${hc}
  `).get() || {};
  return {
    byClass,
    byMethod,
    analysed: counts.analysed || 0,
    flagged: counts.flagged || 0,
    unreviewed: counts.unreviewed || 0,
    confirmed: counts.confirmed || 0,
    dismissed: counts.dismissed || 0,
  };
}

function topAnomalies({ house = 'both', limit = 5, state = null } = {}) {
  const stmt = db.prepare(`
    SELECT r.id, r.mp_name, r.state, r.house, r.amount,
           a.classification, a.method_count, a.anomaly_score, a.percentile_rank,
           a.explanation, a.review_status
    FROM anomalies a JOIN records r ON a.record_id = r.id
    WHERE a.classification != 'Normal' ${houseClause(house, 'r')} ${state ? 'AND r.state = @state' : ''}
    ORDER BY a.anomaly_score DESC, a.method_count DESC, r.amount DESC
    LIMIT ${cap(limit)}
  `);
  return state ? stmt.all({ state }) : stmt.all();
}

function reviewQueue({ house = 'both', limit = 5 } = {}) {
  return db.prepare(`
    SELECT r.id, r.mp_name, r.state, a.classification, a.method_count, a.anomaly_score
    FROM anomalies a JOIN records r ON a.record_id = r.id
    WHERE a.classification != 'Normal' AND a.review_status = 'Unreviewed' ${houseClause(house, 'r')}
    ORDER BY a.anomaly_score DESC, a.method_count DESC LIMIT ${cap(limit)}
  `).all();
}

function anomalyForRecord(recordId) {
  return db.prepare(`
    SELECT a.*, r.mp_name, r.state, r.house, r.amount
    FROM anomalies a JOIN records r ON a.record_id = r.id WHERE a.record_id = ?
  `).get(recordId) || null;
}

/* -------------------------------------------------------------------------- */
/* Administrative reads (only ever called for a signed-in administrator)       */
/* -------------------------------------------------------------------------- */

function auditSummary(limit = 5) {
  const recent = db.prepare(`
    SELECT ts, actor_email, actor_role, action FROM audit_log ORDER BY id DESC LIMIT ${cap(limit, 15)}
  `).all();
  const byAction = db.prepare(`
    SELECT action, COUNT(*) AS count FROM audit_log GROUP BY action ORDER BY count DESC LIMIT 6
  `).all();
  const total = db.prepare('SELECT COUNT(*) AS c FROM audit_log').get();
  return { recent, byAction, total: total ? total.c : 0 };
}

function securitySummary(limit = 5) {
  const recent = db.prepare(`
    SELECT ts, event_type, email, ip FROM security_events ORDER BY id DESC LIMIT ${cap(limit, 15)}
  `).all();
  const byType = db.prepare(`
    SELECT event_type, COUNT(*) AS count FROM security_events GROUP BY event_type ORDER BY count DESC LIMIT 6
  `).all();
  const lockedOut = db.prepare(
    "SELECT COUNT(*) AS c FROM users WHERE locked_until IS NOT NULL AND locked_until > datetime('now')",
  ).get();
  const activeSessions = db.prepare(
    "SELECT COUNT(*) AS c FROM sessions WHERE revoked = 0 AND expires_at > datetime('now')",
  ).get();
  return {
    recent,
    byType,
    lockedOut: lockedOut ? lockedOut.c : 0,
    activeSessions: activeSessions ? activeSessions.c : 0,
  };
}

function userSummary() {
  const rows = db.prepare('SELECT role, COUNT(*) AS count FROM users GROUP BY role').all();
  const recent = db.prepare(
    'SELECT email, role, last_login_at FROM users ORDER BY last_login_at DESC LIMIT 3',
  ).all();
  return { byRole: rows, recent };
}

function reportSummary() {
  const total = db.prepare('SELECT COUNT(*) AS c FROM reports').get();
  const last = db.prepare(`
    SELECT rp.generated_at, rp.format, d.name AS dataset
    FROM reports rp LEFT JOIN datasets d ON d.id = rp.dataset_id
    ORDER BY rp.id DESC LIMIT 1
  `).get();
  return { total: total ? total.c : 0, last: last || null };
}

module.exports = {
  METRICS,
  metric,
  totals,
  houseSplit,
  datasets,
  financialYears,
  domains,
  memberRanking,
  stateRanking,
  stateNames,
  stateProfile,
  districtsIn,
  membersIn,
  anomalySummary,
  topAnomalies,
  reviewQueue,
  anomalyForRecord,
  auditSummary,
  securitySummary,
  userSummary,
  reportSummary,
};
