// Semantic field detection for uploaded MPLADS-style datasets.
// Never invents data — only maps existing columns to known semantic roles.

const FIELD_PATTERNS = {
  state: [/^state$/i, /state\/ut/i],
  district: [/^district$/i],
  // Different published MPLADS extracts label the constituency column differently.
  // Every pattern below reads an existing column — none of them invent a value.
  constituency: [
    /constituenc/i,          // Constituency, Constituency Name, Parliamentary Constituency…
    /^pc[\s._-]*name$/i,     // PC Name, pc_name, PC.Name
    /^pc$/i,
    /^p\.?c\.?$/i,
    /\bparliamentary\s*(seat|area)\b/i,
    /\b(lok\s*sabha|ls)\s*(seat|constituency)\b/i,
    /^seat(\s*name)?$/i,
    /^area\s*represented$/i,
  ],
  mp: [/hon'?ble members? of parliament/i, /^mp$/i, /^member$/i, /member of parliament/i],
  project_id: [/project\s*id/i, /work\s*id/i],
  project_name: [/^project$/i, /project name/i, /project title/i, /description/i, /work\s*name/i],
  domain: [/domain/i, /category/i, /sector/i],
  amount: [/allocated\s*amount/i, /^amount$/i, /^allocation$/i, /sanctioned amount/i],
  expenditure: [/total\s*expenditure/i, /expenditure/i, /amount released/i, /amount spent/i],
  // Performance columns carried by MPLADS summary extracts.
  recommended_amount: [/amount\s*recommended/i, /recommended\s*amount/i],
  utilization: [/utilization\s*%/i, /utilisation\s*%/i, /^utilization$/i, /^utilisation$/i],
  works_completed: [/completed\s*works/i, /works\s*completed/i],
  works_recommended: [/recommended\s*works/i, /works\s*recommended/i],
  completion_rate: [/completion\s*rate/i],
  balance_unpaid: [/balance not yet paid/i, /unpaid\s*balance/i],
  transactions: [/transaction\s*count/i, /^transactions$/i],
  financial_year: [/financial year/i, /^year$/i, /fy/i],
  // "House" means Lok Sabha / Rajya Sabha. An "Elected/Nominated" column describes
  // how a member entered the House, which is a different fact — it is mapped to
  // member_type so House filtering stays correct.
  house: [/^house$/i, /lok\s*sabha|rajya\s*sabha/i],
  member_type: [/elected\s*\/\s*nominated/i, /member\s*type/i, /^type$/i],
  status: [/completion status/i, /^status$/i],
  // A dataset may carry a photograph of the work. It is read when present and never
  // substituted for when it is absent.
  image: [/image\s*url/i, /^image$/i, /photo\s*url/i, /^photo$/i, /thumbnail/i, /^picture$/i],
  agency: [/agency/i, /contractor/i, /implementing/i],
  date: [/^date$/i, /sanction date/i],
};

function detectSchema(columns) {
  const mapping = {};
  const confidence = {};
  for (const col of columns) {
    for (const [field, patterns] of Object.entries(FIELD_PATTERNS)) {
      if (mapping[field]) continue; // first strong match wins
      for (const pattern of patterns) {
        if (pattern.test(col.trim())) {
          mapping[field] = col;
          confidence[field] = 0.95;
          break;
        }
      }
    }
  }
  // Low-confidence fallback. These use word boundaries rather than a bare substring
  // test: "mp" as a substring also occurs inside "Implementing Agency", "Completion"
  // and "Sample", which previously let an unrelated column be read as the member name.
  const taken = new Set(Object.values(mapping));
  for (const col of columns) {
    if (taken.has(col)) continue;
    const lower = col.toLowerCase();
    if (!mapping.state && /\bstate\b/.test(lower)) { mapping.state = col; confidence.state = 0.6; taken.add(col); continue; }
    if (!mapping.mp && /\b(mp|mps|member|members)\b/.test(lower)) { mapping.mp = col; confidence.mp = 0.6; taken.add(col); continue; }
    if (!mapping.constituency && /\b(constituency|pc|seat)\b/.test(lower)) { mapping.constituency = col; confidence.constituency = 0.6; taken.add(col); continue; }
    if (!mapping.amount && /\b(rs|inr|₹)\b/.test(lower)) { mapping.amount = col; confidence.amount = 0.5; taken.add(col); continue; }
  }
  return { mapping, confidence };
}

/**
 * Last-resort per-row recovery. When a semantic field was not mapped from the header
 * row, this looks through the row's own keys for one that matches that field's
 * patterns and returns the value stored under it. It only ever returns a value the
 * source file actually contains — it never derives or guesses one.
 */
function recoverFromRow(row, field) {
  const patterns = FIELD_PATTERNS[field];
  if (!patterns || !row) return null;
  for (const key of Object.keys(row)) {
    const name = String(key).trim();
    if (patterns.some((p) => p.test(name))) {
      const value = row[key];
      if (value !== null && value !== undefined && String(value).trim() !== '') return value;
    }
  }
  return null;
}

module.exports = { detectSchema, recoverFromRow, FIELD_PATTERNS };
