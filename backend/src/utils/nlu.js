/**
 * PRAMANA AI's understanding layer — entirely local.
 *
 * There is no model call anywhere in this file. A question is normalised, spell-
 * corrected against a fixed vocabulary, expanded through a synonym table, and then
 * scored against a set of declared intents. Whatever scores highest wins, and the
 * score is reported so the answer engine can ask for clarification instead of
 * guessing when nothing fits well.
 *
 * Design notes:
 *   • Phrases outrank single words. "how are you" must not be pulled apart into a
 *     "how" that looks like a methodology question.
 *   • Fuzzy matching is edit-distance 1 for short words and 2 for long ones, so
 *     "utilisaton", "anomoly" and "rajya sabah" all land correctly.
 *   • Both British and American spellings are accepted throughout, along with the
 *     common Indian-English shorthands (MP, LS, RS, UP, crore, lakh).
 */

/* -------------------------------------------------------------------------- */
/* Text handling                                                               */
/* -------------------------------------------------------------------------- */

function normalise(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
    .replace(/[^a-z0-9'\s%.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function words(text) {
  return normalise(text).split(' ').filter(Boolean);
}

/** Classic Levenshtein, bounded — we only ever care about distances of 1 or 2. */
function editDistance(a, b, limit = 2) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (row[j] < best) best = row[j];
    }
    if (best > limit) return limit + 1;
    prev = row;
  }
  return prev[b.length];
}

function tolerance(word) {
  if (word.length <= 4) return 0;
  if (word.length <= 7) return 1;
  return 2;
}

/** True when `word` is `target`, a plural of it, or a near-miss typo. */
function similar(word, target) {
  if (word === target) return true;
  if (word.length > 4 && target.length > 4) {
    if (word.startsWith(target) || target.startsWith(word)) {
      return Math.abs(word.length - target.length) <= 3;
    }
  }
  return editDistance(word, target, tolerance(target)) <= tolerance(target);
}

/* -------------------------------------------------------------------------- */
/* Vocabulary                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Surface forms mapped to a single canonical token. Everything downstream — intent
 * scoring, metric detection — reads the canonical form, so each concept is written
 * once no matter how many ways a person can spell it.
 */
const SYNONYMS = {
  utilisation: ['utilization', 'utilisation', 'utilised', 'utilized', 'usage', 'uptake', 'spendrate'],
  allocation: ['allocation', 'allocated', 'allocations', 'entitlement', 'limit', 'sanctioned', 'quota'],
  expenditure: ['expenditure', 'spent', 'spend', 'spending', 'disbursed', 'disbursement', 'paid', 'payout', 'payouts', 'released'],
  recommended: ['recommended', 'recommendation', 'recommendations', 'proposed', 'sanction'],
  works: ['works', 'work', 'projects', 'project', 'schemes'],
  completed: ['completed', 'completion', 'finished', 'done', 'delivered'],
  pending: ['pending', 'outstanding', 'incomplete', 'unfinished', 'backlog', 'remaining'],
  anomaly: ['anomaly', 'anomalies', 'anomalous', 'outlier', 'outliers', 'irregular', 'irregularity', 'irregularities', 'suspicious', 'unusual', 'abnormal', 'flag', 'flagged', 'flags', 'redflag', 'fraud', 'fraudulent', 'corruption', 'scam', 'misuse', 'risk'],
  compare: ['compare', 'comparison', 'compared', 'versus', 'vs', 'against', 'difference', 'differences', 'differ', 'sidebyside', 'benchmark'],
  member: ['mp', 'mps', 'member', 'members', 'parliamentarian', 'parliamentarians', 'legislator', 'representative'],
  state: ['state', 'states', 'ut', 'uts', 'province', 'region', 'statewise'],
  district: ['district', 'districts', 'constituency', 'constituencies'],
  total: ['total', 'totals', 'sum', 'overall', 'aggregate', 'combined', 'cumulative'],
  top: ['top', 'highest', 'largest', 'biggest', 'maximum', 'max', 'best', 'leading', 'greatest', 'most'],
  bottom: ['bottom', 'lowest', 'smallest', 'least', 'worst', 'minimum', 'min', 'poorest', 'weakest'],
  average: ['average', 'mean', 'typical', 'median'],
  method: ['method', 'methods', 'methodology', 'screening', 'screened', 'screen', 'detection', 'detect', 'flagging', 'technique', 'algorithm', 'formula', 'calculation', 'calculated', 'computed', 'iqr', 'zscore', 'percentile', 'statistic', 'statistical', 'threshold', 'thresholds'],
  dataset: ['dataset', 'datasets', 'data', 'file', 'files', 'upload', 'uploaded', 'uploading', 'ingest', 'ingested', 'source', 'sources'],
  review: ['review', 'reviewed', 'reviewing', 'unreviewed', 'verify', 'verification', 'queue', 'triage', 'investigate', 'investigation'],
  audit: ['audit', 'auditlog', 'trail', 'activity', 'history', 'logs'],
  report: ['report', 'reports', 'pdf', 'export', 'exports', 'download', 'downloads', 'csv'],
  explain: ['explain', 'explanation', 'why', 'reason', 'reasons', 'because', 'cause', 'meaning', 'means', 'define', 'definition', 'understand'],
  help: ['help', 'guide', 'assist', 'assistance', 'support', 'howto', 'tutorial', 'instructions'],
  greeting: ['hi', 'hello', 'hey', 'namaste', 'namaskar', 'greetings', 'yo', 'hii', 'helo', 'hlo', 'morning', 'afternoon', 'evening'],
  thanks: ['thanks', 'thank', 'thankyou', 'thx', 'ty', 'appreciated', 'grateful', 'dhanyavaad', 'shukriya'],
  bye: ['bye', 'goodbye', 'cya', 'later', 'exit', 'quit', 'close', 'alvida'],
  mplads: ['mplads', 'mplad', 'scheme'],
  security: ['security', 'lockout', 'lockouts', 'login', 'logins', 'signin', 'breach', 'attempts', 'sessions', 'password', 'captcha'],
  user: ['user', 'users', 'account', 'accounts', 'admin', 'admins', 'administrator', 'administrators', 'role', 'roles'],
  navigate: ['where', 'find', 'navigate', 'page', 'screen', 'menu', 'tab', 'link', 'open', 'go'],
  count: ['many', 'count', 'number', 'how'],
};

const CANONICAL = new Map();
Object.entries(SYNONYMS).forEach(([canon, forms]) => {
  forms.forEach((form) => CANONICAL.set(form, canon));
  CANONICAL.set(canon, canon);
});

const VOCAB = [...new Set([...CANONICAL.keys()])];

/** Maps one surface word to its canonical form, correcting a typo if needed. */
function canonicalise(word) {
  const stripped = word.replace(/[^a-z0-9]/g, '');
  if (!stripped) return null;
  if (CANONICAL.has(stripped)) return CANONICAL.get(stripped);
  if (stripped.length < 4) return stripped;
  let best = null;
  let bestDistance = Infinity;
  for (const candidate of VOCAB) {
    const allowed = tolerance(candidate);
    if (!allowed) continue;
    const d = editDistance(stripped, candidate, allowed);
    if (d <= allowed && d < bestDistance) { bestDistance = d; best = candidate; }
  }
  return best ? CANONICAL.get(best) : stripped;
}

/* -------------------------------------------------------------------------- */
/* Intents                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * An intent declares:
 *   phrases — multi-word regexes, scored heavily because they are unambiguous
 *   any     — canonical tokens; each match adds its weight
 *   all     — every listed token must be present for the intent to score at all
 *   admin   — only offered to a signed-in administrator
 */
const INTENTS = [
  // --- conversation ---------------------------------------------------------
  {
    id: 'greeting',
    phrases: [/^(hi|hii+|hey+|hello+|helo|hlo|yo|namaste|namaskar|good (morning|afternoon|evening|day))\b/],
    any: ['greeting'], weight: 6, short: true,
  },
  {
    id: 'howAreYou',
    phrases: [/how (are|r) (you|u)\b/, /how'?s it going/, /what'?s up\b/, /how do you do\b/, /you (ok|okay|good|alright)\b/],
    weight: 10,
  },
  { id: 'thanks', phrases: [/\b(thanks|thank you|thankyou|thx|ty|much appreciated|great work|well done|nice work|good job|perfect|awesome|brilliant)\b/], any: ['thanks'], weight: 8 },
  { id: 'farewell', phrases: [/\b(bye|goodbye|see you|see ya|good ?night|that'?s all|that is all|i'?m done|nothing else)\b/], any: ['bye'], weight: 8 },
  {
    id: 'identity',
    phrases: [/who (are|r) (you|u)\b/, /what (are|r) (you|u)\b/, /your name\b/, /are you (a )?(human|bot|robot|real|chatgpt|gpt|ai|gemini|claude)\b/, /what is pramana ai\b/, /tell me about yourself/],
    weight: 10,
  },
  {
    id: 'capabilities',
    phrases: [/what can (you|u) (do|help)/, /how can (you|u) help/, /what (do|can) (you|u) know/, /what (should|can) i ask/, /^help\b/, /^menu$/, /options\b/, /your (features|capabilities)/],
    any: ['help'], weight: 8,
  },
  {
    id: 'aboutPramana',
    phrases: [/what is pramana\b/, /about (this )?(portal|site|website|platform|project|tool)/, /who (built|made|created|developed)/, /is (this|it) (the )?(an )?official/, /government (portal|site|website|system)/, /e-?sakshi/, /who runs this/],
    weight: 9,
  },
  {
    id: 'usesAi',
    phrases: [/do you use (an? )?(api|internet|model|llm|chatgpt|gpt|gemini|openai)/, /are you offline/, /without (an? )?api/, /is this (an? )?(real )?ai/, /how do you (work|answer)/, /where do (you|your answers) (get|come)/],
    weight: 9,
  },
  {
    id: 'privacy',
    phrases: [/\b(privacy|cookie|cookies|personal data|store my|track me|gdpr|data protection)\b/],
    weight: 8,
  },
  {
    id: 'accusation',
    phrases: [/\b(is|was|are) .{0,40}\b(corrupt|guilty|criminal|thief|stealing|stole|cheating|cheated)\b/, /\bwho (is|are) the most corrupt\b/, /prove (fraud|corruption)/, /\bname and shame\b/],
    weight: 12,
  },

  // --- knowledge ------------------------------------------------------------
  {
    id: 'aboutMplads',
    phrases: [/what is mplads?\b/, /what is the mplad scheme/, /explain mplads?\b/, /mplads? (scheme|rules|guidelines|limit|eligib)/, /how much (does|do|is) (an? |each )?(mp|member|mps)\b/, /(annual |yearly )?entitlement\b/, /who administers/, /what works are eligible/, /eligible works/],
    any: ['mplads'], weight: 7,
  },
  {
    id: 'methodology',
    phrases: [/how (does|do) (the )?[a-z ]{0,24}(screening|detection|analysis|flagging|anomal\w*|method\w*) work/, /how (are|is) .{0,30}(flagged|detected|screened)\b/, /how (is|are) .{0,25}(calculated|computed|detected|flagged)/, /what is (an? )?(iqr|z-?score|modified z|percentile)/, /what makes (a|an) (record|row) anomalous/],
    any: ['method'], weight: 6,
  },
  {
    id: 'glossary',
    phrases: [/what (does|do) .{0,30}mean\b/, /what is (fund )?utilisation/, /what is (fund )?utilization/, /difference between recommended and (spent|expenditure|paid)/, /what is (an? )?(anomaly|outlier|classification)/, /define \w+/],
    weight: 6,
  },
  {
    id: 'navigation',
    phrases: [/where (is|are) (the |a )?\w+/, /where (can|do) i (find|see|view|get|download)/, /how (do|can) i (find|see|view|open|use|switch|change|download|export)/, /which page/, /take me to/, /show me the (map|compare|projects|states) page/],
    any: ['navigate'], weight: 5,
  },
  { id: 'language', phrases: [/\b(hindi|language|translate|bhasha|भाषा|regional language)\b/], weight: 7 },

  // --- data -----------------------------------------------------------------
  {
    id: 'overview',
    phrases: [/\b(overview|summary|summarise|summarize|snapshot|big picture|overall (position|picture|status))\b/, /how much (money|funds?) (in total|overall)/, /what data do you have/],
    any: ['total'], weight: 4,
  },
  { id: 'datasets', phrases: [/what (datasets?|data|files?) (are |is )?(loaded|uploaded|available)/, /list (the )?datasets/, /data sources?\b/], any: ['dataset'], weight: 5 },
  { id: 'memberProfile', phrases: [/tell me about\b/, /who is\b/, /profile of\b/, /details? (of|for|on)\b/], weight: 3, needsMember: true },
  { id: 'comparison', any: ['compare'], weight: 7 },
  { id: 'ranking', phrases: [/top \d+/, /bottom \d+/, /best performing/, /worst performing/, /rank(ing|ed)?\b/, /leader ?board/, /which (state|states|mp|mps|member|members) (has|have|had)/], any: ['top', 'bottom'], weight: 5 },
  { id: 'stateProfile', weight: 4, needsState: true },
  { id: 'anomalies', any: ['anomaly'], weight: 6 },
  { id: 'domains', phrases: [/\b(sector|sectors|domain|domains|category|categories|type of work)\b/], weight: 6 },
  { id: 'financialYear', phrases: [/\b(financial year|fiscal year|fy|year ?wise|yearly|per year|by year|20\d\d-\d\d)\b/], weight: 6 },
  // "What is the average allocation?" asks for a central figure, not a ranking.
  { id: 'average', phrases: [/\b(average|mean|typical|median)\b/], weight: 6 },
  { id: 'houseSplit', phrases: [/\b(lok sabha (vs|versus|and|compared) rajya sabha|rajya sabha (vs|versus|and|compared) lok sabha|both houses|by house|house ?wise|which house)\b/], weight: 8 },
  { id: 'count', phrases: [/how many\b/, /number of\b/, /count of\b/], weight: 5 },

  // --- administrator --------------------------------------------------------
  { id: 'adminUpload', phrases: [/how (do|can) i (upload|import|add|ingest|load)/, /upload (a )?(file|dataset|csv|xlsx|excel)/, /supported (formats?|columns?)/, /column mapping/, /schema/], admin: true, weight: 7 },
  { id: 'adminAnalysis', phrases: [/(run|start|trigger|re-?run) (the )?(analysis|screening|detection)/, /analyse (the )?dataset/, /analyze (the )?dataset/], admin: true, weight: 8 },
  { id: 'adminReview', phrases: [/(review|investigation) (queue|workflow|process)/, /what (should|do) i review (first|next)/, /pending reviews?/, /unreviewed/, /confirm or dismiss/], any: ['review'], admin: true, weight: 6 },
  { id: 'adminReports', phrases: [/generate (a )?report/, /export (the )?(data|findings|report)/, /pdf report/], any: ['report'], admin: true, weight: 6 },
  { id: 'adminAudit', phrases: [/audit (log|trail|history)/, /who (did|changed|uploaded|deleted)/, /recent (activity|actions|changes)/], any: ['audit'], admin: true, weight: 7 },
  { id: 'adminSecurity', phrases: [/security (events?|log|status|posture)/, /failed logins?/, /locked (out )?accounts?/, /active sessions/, /brute force/], any: ['security'], admin: true, weight: 6 },
  { id: 'adminUsers', phrases: [/how many (users|admins?|accounts|administrators|admin accounts|people)/, /(add|create|remove|delete) (a )?(user|admin|account)/, /user roles?/, /reset (a )?password/], any: ['user'], admin: true, weight: 6 },
  { id: 'adminAiConfig', phrases: [/ai (configuration|config|settings|key)/, /api key/, /\b(gemini|openai|kimi|moonshot|nvidia|model|llm|provider) key\b/, /(do i |will i )?need (an? )?(api |gemini |openai )?key/, /connect (a )?model/, /which (model|provider)/], admin: true, weight: 7 },
];

/* -------------------------------------------------------------------------- */
/* Extraction                                                                  */
/* -------------------------------------------------------------------------- */

const METRIC_PATTERNS = [
  ['utilisation', /\b(utilis|utiliz|usage|uptake)/],
  ['completion', /\b(completion rate|completion ratio|rate of completion)\b/],
  ['worksCompleted', /\b(works? (completed|done|finished)|completed works?)\b/],
  ['worksRecommended', /\b(works? recommended|recommended works?|works? proposed)\b/],
  ['expenditure', /\b(expenditure|spent|spend|spending|paid|payout|disburs|released)\b/],
  ['recommended', /\b(recommended (amount|funds?)|amount recommended|sanctioned amount)\b/],
  ['unpaid', /\b(unpaid|balance|outstanding (amount|money|funds?)|pending payment)\b/],
  ['transactions', /\b(transactions?|payments? count)\b/],
  ['allocation', /\b(allocat|entitlement|limit|quota)\b/],
];

function detectMetric(text) {
  for (const [name, pattern] of METRIC_PATTERNS) {
    if (pattern.test(text)) return name;
  }
  return null;
}

function detectDirection(text) {
  if (/\b(lowest|worst|least|bottom|smallest|minimum|min|poorest|weakest|underspend|unspent|behind|laggard)\b/.test(text)) return 'asc';
  if (/\b(highest|top|best|largest|biggest|most|maximum|max|leading|greatest)\b/.test(text)) return 'desc';
  return null;
}

function detectLimit(text) {
  const m = text.match(/\b(?:top|bottom|first|last|show me|list)\s+(\d{1,2})\b/) || text.match(/\b(\d{1,2})\s+(?:top|highest|lowest|best|worst|states?|members?|mps?)\b/);
  if (m) return Math.max(1, Math.min(Number(m[1]), 20));
  return null;
}

function detectHouse(text) {
  if (/\blok\s*sabha\b|\bls\b|\blower house\b/.test(text)) return 'lok';
  if (/\brajya\s*sabha\b|\brs\b|\bupper house\b|\bcouncil of states\b/.test(text)) return 'rajya';
  if (/\bboth houses\b|\ball members\b/.test(text)) return 'both';
  return null;
}

/** Short forms people actually type for states and union territories. */
const STATE_ALIASES = {
  up: 'Uttar Pradesh',
  mp: null, // deliberately not mapped: "MP" overwhelmingly means Member of Parliament here
  tn: 'Tamil Nadu',
  ap: 'Andhra Pradesh',
  wb: 'West Bengal',
  hp: 'Himachal Pradesh',
  jk: 'Jammu and Kashmir',
  uk: 'Uttarakhand',
  ncr: 'Delhi',
  'new delhi': 'Delhi',
  bombay: 'Maharashtra',
  orissa: 'Odisha',
  pondicherry: 'Puducherry',
  bangalore: 'Karnataka',
};

/**
 * Finds state names in a question, tolerating spelling drift ("Karnatka",
 * "Tamilnadu") and the aliases above. Longest match wins so "Andhra Pradesh"
 * is not shortened to "Andhra".
 */
function detectStates(text, knownStates, limit = 3) {
  const clean = normalise(text);
  const found = [];

  for (const [alias, state] of Object.entries(STATE_ALIASES)) {
    if (state && new RegExp(`\\b${alias}\\b`).test(clean) && knownStates.includes(state)) {
      found.push(state);
    }
  }

  const sorted = [...knownStates].sort((a, b) => b.length - a.length);
  for (const state of sorted) {
    if (found.includes(state)) continue;
    const key = normalise(state);
    if (clean.includes(key) || clean.includes(key.replace(/\s/g, ''))) {
      found.push(state);
      continue;
    }
    // Fuzzy: compare the state name against every window of the same word length.
    const stateWords = key.split(' ');
    const textWords = clean.split(' ');
    for (let i = 0; i + stateWords.length <= textWords.length; i += 1) {
      const window = textWords.slice(i, i + stateWords.length).join(' ');
      if (window.length >= 4 && editDistance(window, key, 2) <= 2) { found.push(state); break; }
    }
  }

  return [...new Set(found)].slice(0, limit);
}

const FOLLOW_UP = /^(and|what about|how about|ok(ay)? (and|what about)|also|then|why|more|tell me more|go on|elaborate|expand|continue|details?)\b/;
const PRONOUN = /\b(he|him|his|she|her|hers|they|them|their|it|its|that|those|this one|the same)\b/;

/* -------------------------------------------------------------------------- */
/* Scoring                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Returns the ranked intent candidates for a question.
 * `context` carries what the question itself cannot say: whether a member or state
 * was resolved from the data, and whether the asker is an administrator.
 */
function classify(question, context = {}) {
  const clean = normalise(question);
  const tokens = words(question).map(canonicalise).filter(Boolean);
  const tokenSet = new Set(tokens);
  const scores = [];

  for (const intent of INTENTS) {
    if (intent.admin && !context.isAdmin) continue;
    if (intent.needsMember && !context.hasMember) continue;
    if (intent.needsState && !context.hasState) continue;
    if (intent.short && clean.split(' ').length > 5) continue;

    let score = 0;
    if (intent.all && !intent.all.every((t) => tokenSet.has(t))) continue;

    (intent.phrases || []).forEach((pattern) => { if (pattern.test(clean)) score += (intent.weight || 5) * 2; });
    (intent.any || []).forEach((token) => { if (tokenSet.has(token)) score += intent.weight || 5; });
    if (intent.all) score += (intent.weight || 5) * intent.all.length;

    if (score > 0) scores.push({ id: intent.id, score });
  }

  scores.sort((a, b) => b.score - a.score);
  return scores;
}

function analyse(question, { knownStates = [], isAdmin = false, hasMember = false } = {}) {
  const clean = normalise(question);
  const states = detectStates(question, knownStates);
  const candidates = classify(question, { isAdmin, hasMember, hasState: states.length > 0 });

  return {
    clean,
    tokens: words(question).map(canonicalise).filter(Boolean),
    candidates,
    intent: candidates.length ? candidates[0].id : null,
    confidence: candidates.length ? candidates[0].score : 0,
    states,
    metric: detectMetric(clean),
    direction: detectDirection(clean),
    limit: detectLimit(clean),
    house: detectHouse(clean),
    isFollowUp: FOLLOW_UP.test(clean),
    hasPronoun: PRONOUN.test(clean),
    isQuestion: /\?$|^(what|who|which|where|when|why|how|is|are|do|does|can|could|should|list|show|tell|give|compare|find)\b/.test(clean),
    wordCount: clean ? clean.split(' ').length : 0,
  };
}

module.exports = {
  analyse,
  classify,
  normalise,
  words,
  canonicalise,
  editDistance,
  similar,
  detectStates,
  detectMetric,
  detectDirection,
  detectLimit,
  detectHouse,
  INTENTS,
  SYNONYMS,
};
