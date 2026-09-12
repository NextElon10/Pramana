const db = require('../db');
const { normalizeName } = require('./clean');

/**
 * Ground truth for PRAMANA AI.
 *
 * Every answer the assistant gives — whether written by a language model or by the
 * built-in engine — is assembled from this module and nothing else. The model is given
 * this context and told it may not use anything outside it, so a question the data
 * cannot answer produces "the loaded data does not contain that" rather than a
 * plausible invention.
 *
 * The expensive part is entity resolution: turning "compare Atul Garg and Mahesh
 * Sharma" into two specific rows. That runs here, in SQL, before any model is called.
 */

/* -------------------------------------------------------------------------- */
/* Name resolution                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Words that appear in questions rather than in names. Without this list a query like
 * "compare the two members from Bihar" matches members whose names contain those
 * letters, and the assistant answers about the wrong people.
 */
const STOPWORDS = new Set([
  'compare', 'comparison', 'versus', 'vs', 'and', 'with', 'between', 'against', 'both',
  'who', 'what', 'which', 'where', 'when', 'whom', 'whose', 'how', 'why', 'show', 'tell',
  'give', 'list', 'find', 'explain', 'describe', 'summarise', 'summarize', 'analyse',
  'analyze', 'their', 'them', 'they', 'that', 'this', 'these', 'those', 'have', 'has',
  'had', 'been', 'was', 'were', 'are', 'the', 'for', 'from', 'into', 'about', 'than',
  'then', 'does', 'did', 'not', 'any', 'all', 'more', 'most', 'much', 'many', 'each',
  'member', 'members', 'mp', 'mps', 'sabha', 'lok', 'rajya', 'house', 'houses',
  'constituency', 'constituencies', 'seat', 'state', 'states', 'district', 'utilisation',
  'utilization', 'allocation', 'allocated', 'allocations', 'amount', 'amounts', 'spent',
  'expenditure', 'fund', 'funds', 'money', 'crore', 'lakh', 'rupees', 'works', 'work',
  'completed', 'recommended', 'pending', 'performance', 'record', 'records', 'data',
  'dataset', 'datasets', 'anomaly', 'anomalies', 'flagged', 'unusual', 'score', 'rate',
  'total', 'average', 'median', 'highest', 'lowest', 'largest', 'smallest', 'best',
  'worst', 'better', 'worse', 'top', 'bottom', 'per', 'out', 'his', 'her', 'him', 'she',
  'shri', 'smt', 'dr', 'prof', 'adv', 'kumari', 'capt', 'shree', 'sri', 'hon', 'ble',
  'people', 'person', 'someone', 'somebody', 'please', 'could', 'would', 'should',
]);

/** Splits a question into plausible name fragments. */
function nameTokens(question) {
  return String(question)
    .replace(/[^A-Za-z\s.]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim().toLowerCase().replace(/\.$/, ''))
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

/**
 * Splits on comparison connectives so each side can be resolved independently.
 * "compare A and B" -> ["compare a", "b"], which stops a single greedy match from
 * swallowing both names.
 */
function comparisonSides(question) {
  return String(question)
    .split(/\s+(?:vs\.?|versus|against|compared to|and|with|&|,)\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** All members, cached per process — 774 rows, so this is cheap and avoids N queries. */
let memberIndex = null;
let memberIndexStamp = 0;

function loadMemberIndex() {
  const stamp = db.prepare('SELECT COUNT(*) AS c, MAX(id) AS m FROM records').get();
  const key = `${stamp.c}:${stamp.m}`;
  if (memberIndex && memberIndexStamp === key) return memberIndex;

  const rows = db.prepare(`
    SELECT r.id, r.mp_name, r.state, r.constituency, r.house, r.amount, r.expenditure,
           r.recommended_amount, r.utilization, r.works_completed, r.works_recommended,
           r.completion_rate, r.balance_unpaid, r.transactions,
           a.classification, a.method_count, a.percentile_rank, a.anomaly_score, a.explanation
    FROM records r LEFT JOIN anomalies a ON a.record_id = r.id
    WHERE r.mp_name IS NOT NULL
  `).all();

  memberIndex = rows.map((r) => ({
    ...r,
    // Titles and bracketed term ranges are stripped so "Dr. Alka Singh (2026-32)"
    // matches a question that just says "Alka Singh".
    normalized: normalizeName(r.mp_name),
    tokens: new Set(normalizeName(r.mp_name).split(' ').filter((w) => w.length >= 3)),
  }));
  memberIndexStamp = key;
  return memberIndex;
}

/**
 * Scores one member against a fragment of the question. Whole-name containment beats
 * token overlap, and a single shared token is only accepted when it is a distinctive
 * one — otherwise "Singh" alone would resolve to dozens of different people.
 */
function scoreMember(member, fragmentTokens, fragmentNormalized) {
  if (!fragmentTokens.length) return 0;

  if (fragmentNormalized.length >= 6 && member.normalized.includes(fragmentNormalized)) return 100;

  let hits = 0;
  for (const token of fragmentTokens) {
    if (member.tokens.has(token)) hits += 2;
    else if ([...member.tokens].some((t) => t.startsWith(token) || token.startsWith(t))) hits += 1;
  }
  if (!hits) return 0;

  // Two or more matching name parts is a confident match; one is only a lead.
  const strongHits = fragmentTokens.filter((t) => member.tokens.has(t)).length;
  return strongHits >= 2 ? 60 + hits : hits;
}

/**
 * Resolves up to `limit` distinct members named anywhere in the question.
 * Returns them in the order they appear, which is the order a comparison should read.
 */
function resolveMembers(question, limit = 4) {
  const index = loadMemberIndex();
  const sides = comparisonSides(question);
  const picked = [];
  const seen = new Set();

  for (const side of sides) {
    const tokens = nameTokens(side);
    if (!tokens.length) continue;
    const normalized = tokens.join(' ');

    let best = null;
    let bestScore = 0;
    for (const member of index) {
      if (seen.has(member.id)) continue;
      const score = scoreMember(member, tokens, normalized);
      if (score > bestScore) { bestScore = score; best = member; }
    }
    // 60 is the two-strong-token threshold; below it the match is a guess, not a name.
    if (best && bestScore >= 60) {
      picked.push(best);
      seen.add(best.id);
      if (picked.length >= limit) break;
    }
  }

  // A single name with no connective still resolves through the whole question.
  if (!picked.length) {
    const tokens = nameTokens(question);
    if (tokens.length) {
      const normalized = tokens.join(' ');
      let best = null;
      let bestScore = 0;
      for (const member of index) {
        const score = scoreMember(member, tokens, normalized);
        if (score > bestScore) { bestScore = score; best = member; }
      }
      if (best && bestScore >= 60) picked.push(best);
    }
  }

  return picked;
}

/** True when the question is asking for a side-by-side reading. */
function wantsComparison(question) {
  return /\b(compare|comparison|versus|vs\.?|against|better|worse|difference|differ|side by side|who did|which of)\b/i
    .test(String(question));
}

/* -------------------------------------------------------------------------- */
/* Shaping                                                                     */
/* -------------------------------------------------------------------------- */

const pct = (part, whole) => (whole ? (part / whole) * 100 : null);

function shapeMember(m) {
  const utilization = m.utilization !== null && m.utilization !== undefined
    ? m.utilization
    : pct(m.recommended_amount, m.amount);
  return {
    id: m.id,
    name: m.mp_name,
    state: m.state,
    house: m.house,
    // A Rajya Sabha member has no constituency; the extract stores a placeholder.
    constituency: m.constituency && !/^(sitting|nominated)\s+rajya\s+sabha$/i.test(String(m.constituency).trim())
      ? m.constituency
      : null,
    allocated: m.amount,
    recommended: m.recommended_amount,
    spent: m.expenditure,
    utilization,
    expenditureShare: pct(m.expenditure, m.amount),
    worksCompleted: m.works_completed,
    worksRecommended: m.works_recommended,
    worksOutstanding: m.works_recommended !== null && m.works_completed !== null
      ? Math.max(0, m.works_recommended - m.works_completed)
      : null,
    completionRate: m.completion_rate,
    balanceUnpaid: m.balance_unpaid,
    transactions: m.transactions,
    classification: m.classification,
    methodCount: m.method_count,
    percentileRank: m.percentile_rank,
    explanation: m.explanation,
  };
}

/** House filter, so the assistant honours the lens the reader is browsing under. */
function houseClause(house) {
  const v = String(house || 'both').toLowerCase();
  if (v.startsWith('lok')) return "AND house LIKE 'Lok%'";
  if (v.startsWith('rajya')) return "AND house LIKE 'Rajya%'";
  return '';
}

function buildContext(question = '', house = 'both') {
  const hc = houseClause(house);
  const hcR = hc.replace(/\bhouse\b/g, 'r.house');

  const totals = db.prepare(`
    SELECT COUNT(*) AS records, COUNT(DISTINCT state) AS states, COUNT(DISTINCT mp_name) AS members,
           SUM(amount) AS totalAllocation, AVG(amount) AS avgAllocation,
           SUM(expenditure) AS totalExpenditure, SUM(recommended_amount) AS totalRecommended,
           SUM(works_completed) AS worksCompleted, SUM(works_recommended) AS worksRecommended
    FROM records WHERE 1 = 1 ${hc}
  `).get();

  const datasets = db.prepare('SELECT name, house, row_count, status FROM datasets ORDER BY id').all();

  const byClass = db.prepare(`
    SELECT a.classification, COUNT(*) AS c FROM anomalies a JOIN records r ON a.record_id = r.id
    WHERE 1 = 1 ${hcR} GROUP BY a.classification ORDER BY c DESC
  `).all();

  const topStates = db.prepare(`
    SELECT state, COUNT(*) AS records, SUM(amount) AS total, SUM(expenditure) AS spent,
           SUM(recommended_amount) AS recommended, SUM(works_completed) AS worksCompleted,
           SUM(works_recommended) AS worksRecommended
    FROM records WHERE state IS NOT NULL ${hc}
    GROUP BY state ORDER BY total DESC LIMIT 10
  `).all();

  const domains = db.prepare(`
    SELECT domain, COUNT(*) AS records, SUM(amount) AS total
    FROM records WHERE domain IS NOT NULL ${hc} GROUP BY domain ORDER BY total DESC LIMIT 12
  `).all();

  const topAllocations = db.prepare(`
    SELECT mp_name, state, constituency, house, amount
    FROM records WHERE amount IS NOT NULL ${hc} ORDER BY amount DESC LIMIT 10
  `).all();

  const topUtilisation = db.prepare(`
    SELECT mp_name, state, house, utilization, works_completed, works_recommended
    FROM records WHERE utilization IS NOT NULL ${hc} ORDER BY utilization DESC, works_completed DESC LIMIT 5
  `).all();

  const lowUtilisation = db.prepare(`
    SELECT mp_name, state, house, utilization, works_completed, works_recommended
    FROM records WHERE utilization IS NOT NULL ${hc} ORDER BY utilization ASC LIMIT 5
  `).all();

  // Named states in the question get their own figures.
  const q = String(question).toLowerCase();
  const matchedStates = db.prepare('SELECT DISTINCT state FROM records WHERE state IS NOT NULL').all()
    .map((r) => r.state)
    .filter((s) => q.includes(s.toLowerCase()))
    .slice(0, 3);

  const stateDetail = matchedStates.map((state) => db.prepare(`
    SELECT state, COUNT(*) AS records, SUM(amount) AS total, AVG(amount) AS avg,
           MIN(amount) AS min, MAX(amount) AS max, SUM(expenditure) AS spent,
           SUM(recommended_amount) AS recommended, SUM(works_completed) AS worksCompleted,
           SUM(works_recommended) AS worksRecommended
    FROM records WHERE state = ? ${hc} GROUP BY state
  `).get(state)).filter(Boolean);

  // The heart of it: which specific members is this question about?
  const members = resolveMembers(question).map(shapeMember);

  const flaggedTotal = db.prepare(`
    SELECT COUNT(*) AS c FROM anomalies a JOIN records r ON a.record_id = r.id
    WHERE a.classification != 'Normal' ${hcR}
  `).get().c;
  const unreviewed = db.prepare(`
    SELECT COUNT(*) AS c FROM anomalies a JOIN records r ON a.record_id = r.id
    WHERE a.classification != 'Normal' AND a.review_status = 'Unreviewed' ${hcR}
  `).get().c;

  return {
    house,
    totals: {
      records: totals.records || 0,
      states: totals.states || 0,
      members: totals.members || 0,
      totalAllocation: totals.totalAllocation || 0,
      avgAllocation: totals.avgAllocation || 0,
      totalExpenditure: totals.totalExpenditure,
      totalRecommended: totals.totalRecommended,
      worksCompleted: totals.worksCompleted,
      worksRecommended: totals.worksRecommended,
      utilization: pct(totals.totalRecommended, totals.totalAllocation),
      expenditureShare: pct(totals.totalExpenditure, totals.totalAllocation),
    },
    datasets,
    classification: byClass,
    flaggedTotal,
    unreviewed,
    topStates,
    domains,
    topAllocations,
    topUtilisation,
    lowUtilisation,
    stateDetail,
    members,
    isComparison: wantsComparison(question) || members.length >= 2,
  };
}

function inr(v) {
  if (v === null || v === undefined) return 'not recorded';
  const n = Number(v);
  if (!Number.isFinite(n)) return 'not recorded';
  if (Math.abs(n) >= 1e7) return `Rs ${(n / 1e7).toFixed(2)} crore`;
  if (Math.abs(n) >= 1e5) return `Rs ${(n / 1e5).toFixed(2)} lakh`;
  return `Rs ${Math.round(n).toLocaleString('en-IN')}`;
}

const num = (v) => (v === null || v === undefined ? 'not recorded' : Number(v).toLocaleString('en-IN'));
const pctText = (v) => (v === null || v === undefined ? 'not recorded' : `${Number(v).toFixed(1)}%`);

/** One member rendered as prompt text. */
function memberLine(m) {
  return [
    `${m.name} — ${m.constituency || 'no constituency (Rajya Sabha seat)'}, ${m.state}, ${m.house || 'house not recorded'}`,
    `  allocated ${inr(m.allocated)}; recommended ${inr(m.recommended)}; actually spent ${inr(m.spent)}`,
    `  fund utilisation ${pctText(m.utilization)} (recommended against allocation); share actually paid ${pctText(m.expenditureShare)}`,
    `  works recommended ${num(m.worksRecommended)}; completed ${num(m.worksCompleted)}; outstanding ${num(m.worksOutstanding)}; completion rate ${pctText(m.completionRate)}`,
    `  screening result ${m.classification || 'not analysed'}${m.methodCount ? ` (${m.methodCount} of 4 methods agree)` : ''}`,
  ].join('\n');
}

/** Renders the context as compact text for a language model prompt. */
function contextToText(ctx) {
  const lines = [];
  const lens = ctx.house && ctx.house !== 'both'
    ? `The reader is currently filtered to ${ctx.house === 'lok' ? 'Lok Sabha' : 'Rajya Sabha'} only.`
    : 'The reader is viewing both Houses.';
  lines.push(lens);
  lines.push(`Loaded: ${ctx.totals.records} records, ${ctx.totals.members} members, ${ctx.totals.states} states/UTs.`);
  lines.push(`Allocated ${inr(ctx.totals.totalAllocation)}; recommended ${inr(ctx.totals.totalRecommended)}; actually spent ${inr(ctx.totals.totalExpenditure)}.`);
  lines.push(`Overall fund utilisation ${pctText(ctx.totals.utilization)}; share actually paid ${pctText(ctx.totals.expenditureShare)}.`);
  lines.push(`Works: ${num(ctx.totals.worksCompleted)} completed of ${num(ctx.totals.worksRecommended)} recommended.`);
  lines.push(`Datasets: ${ctx.datasets.map((d) => `${d.name} (${d.house || 'house not set'}, ${d.row_count} rows)`).join('; ') || 'none'}.`);
  lines.push(`Screening: ${ctx.classification.map((c) => `${c.classification}=${c.c}`).join(', ') || 'none'}. Flagged ${ctx.flaggedTotal}, of which unreviewed ${ctx.unreviewed}.`);
  lines.push(`Top states by allocation: ${ctx.topStates.map((s) => `${s.state} ${inr(s.total)} (${s.records} members, ${num(s.worksCompleted)} works done)`).join('; ')}.`);
  lines.push(`Highest utilisation members: ${ctx.topUtilisation.map((m) => `${m.mp_name} (${m.state}) ${pctText(m.utilization)}`).join('; ')}.`);
  lines.push(`Lowest utilisation members: ${ctx.lowUtilisation.map((m) => `${m.mp_name} (${m.state}) ${pctText(m.utilization)}`).join('; ')}.`);
  lines.push(`Largest individual allocations: ${ctx.topAllocations.map((r) => `${r.mp_name} (${r.state}) ${inr(r.amount)}`).join('; ')}.`);

  if (!ctx.domains.length) lines.push('No domain/sector column exists in the loaded datasets.');
  if (ctx.stateDetail.length) {
    lines.push(`State detail: ${ctx.stateDetail.map((s) => `${s.state}: ${s.records} members, allocated ${inr(s.total)}, spent ${inr(s.spent)}, works ${num(s.worksCompleted)}/${num(s.worksRecommended)}`).join('; ')}.`);
  }

  if (ctx.members.length) {
    lines.push('');
    lines.push(ctx.members.length > 1
      ? `MEMBERS NAMED IN THE QUESTION (${ctx.members.length}) — compare only these, using only these figures:`
      : 'MEMBER NAMED IN THE QUESTION:');
    ctx.members.forEach((m) => lines.push(memberLine(m)));
  } else {
    lines.push('No specific member was identified in the question.');
  }

  lines.push('');
  lines.push('Party affiliation, project photographs and work-level coordinates are NOT in this data. Say so if asked.');
  return lines.join('\n');
}

module.exports = {
  buildContext,
  contextToText,
  resolveMembers,
  wantsComparison,
  shapeMember,
  inr,
  pctText,
  num,
};
