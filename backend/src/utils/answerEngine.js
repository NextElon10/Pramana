/**
 * PRAMANA AI — the answer engine.
 *
 * This is the whole assistant. It takes a question, works out what was asked
 * (utils/nlu), fetches the facts it needs (utils/assistantRepo), and writes the
 * reply itself. There is no model, no API key and no outbound request anywhere in
 * this path: the same code answers whether or not the machine has a network.
 *
 * Three properties are load-bearing:
 *
 *   • Every figure is fetched, never generated. The engine cannot hallucinate a
 *     number because it has no mechanism for producing one.
 *   • It is conversational. A short-term memory carries the last member, state and
 *     measure forward, so "and Bihar?" or "what about his works?" resolve the way a
 *     person means them.
 *   • It is role-aware. Administrative facts — the review queue, the audit trail,
 *     security events — are fetched only when the caller is a signed-in
 *     administrator, and the route proves that, not the question.
 *
 * Dependencies are injected through `__setDeps` so the engine can be exercised
 * against a stub repository in tests without a database.
 */

const nlu = require('./nlu');
const K = require('./assistantKnowledge');

/* -------------------------------------------------------------------------- */
/* Injectable dependencies                                                     */
/* -------------------------------------------------------------------------- */

let deps = null;

function D() {
  if (!deps) {
    // Required lazily so a test can substitute stubs before the database loads.
    // eslint-disable-next-line global-require
    const repo = require('./assistantRepo');
    // eslint-disable-next-line global-require
    const { resolveMembers, shapeMember } = require('./dataContext');
    deps = { repo, resolveMembers, shapeMember };
  }
  return deps;
}

function __setDeps(next) { deps = next; }

/* -------------------------------------------------------------------------- */
/* Formatting                                                                  */
/* -------------------------------------------------------------------------- */

function inr(v) {
  if (v === null || v === undefined) return 'not recorded';
  const n = Number(v);
  if (!Number.isFinite(n)) return 'not recorded';
  if (Math.abs(n) >= 1e7) return `Rs ${(n / 1e7).toFixed(2)} crore`;
  if (Math.abs(n) >= 1e5) return `Rs ${(n / 1e5).toFixed(2)} lakh`;
  return `Rs ${Math.round(n).toLocaleString('en-IN')}`;
}

const num = (v) => (v === null || v === undefined || Number.isNaN(Number(v))
  ? 'not recorded'
  : Number(v).toLocaleString('en-IN'));

const pct = (v) => (v === null || v === undefined || Number.isNaN(Number(v))
  ? 'not recorded'
  : `${Number(v).toFixed(1)}%`);

/** Formats a value the way its metric should read. */
function metricValue(metric, value) {
  if (value === null || value === undefined) return 'not recorded';
  if (metric.kind === 'money') return inr(value);
  if (metric.kind === 'percent') return pct(value);
  return num(value);
}

const share = (part, whole) => (whole ? (Number(part) / Number(whole)) * 100 : null);
const lines = (...parts) => parts.filter(Boolean).join('\n');
const paras = (...parts) => parts.filter(Boolean).join('\n\n');
const houseLabel = (h) => (h === 'lok' ? 'Lok Sabha' : h === 'rajya' ? 'Rajya Sabha' : 'both Houses');

const CAVEAT = 'Statistical deviation is not evidence of wrongdoing — allocation limits vary legitimately with a member\'s term length, House and date of entry.';

/* -------------------------------------------------------------------------- */
/* Small helpers over the resolved context                                     */
/* -------------------------------------------------------------------------- */

function memberBlock(m) {
  const where = [m.constituency, m.state].filter(Boolean).join(', ');
  return lines(
    `${m.name} — ${where || 'state not recorded'}${m.house ? ` (${m.house})` : ''}`,
    `  • Allocated ${inr(m.allocated)} · recommended ${inr(m.recommended)} · paid out ${inr(m.spent)}`,
    `  • Fund utilisation ${pct(m.utilization)} · share actually paid ${pct(m.expenditureShare)}`,
    `  • Works ${num(m.worksCompleted)} completed of ${num(m.worksRecommended)} recommended${m.worksOutstanding ? ` (${num(m.worksOutstanding)} outstanding)` : ''}`,
    `  • Screening: ${m.classification || 'not analysed'}${m.methodCount ? ` — ${m.methodCount} of 4 methods agree` : ''}`,
  );
}

function rankingList(rows, metric, label) {
  return rows.map((r, i) => {
    const name = label === 'state' ? r.state : r.mp_name;
    const where = label === 'state' ? `${num(r.members)} members` : (r.state || 'state not recorded');
    return `${i + 1}. ${name} — ${metricValue(metric, r.value)} (${where})`;
  }).join('\n');
}

/* -------------------------------------------------------------------------- */
/* Intent handlers                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Each handler receives the same bundle and returns { text, suggestions?, actions? }.
 * `s` is the shared state for this turn: parsed question, resolved entities,
 * repository, memory and role.
 */
const handlers = {

  /* ---- conversation ------------------------------------------------------ */

  greeting(s) {
    const t = s.repo.totals(s.house);
    const opener = s.memory.turnCount > 1 ? 'Still here.' : (s.isAdmin ? 'Good to see you.' : 'Hello.');
    const body = s.isAdmin
      ? `I'm PRAMANA AI. Across ${houseLabel(s.house)} there are ${num(t.records)} records loaded, and ${num(s.repo.anomalySummary(s.house).unreviewed)} flagged records are still waiting on a human review.`
      : `I'm PRAMANA AI, the data assistant for this portal. I can read the ${num(t.records)} MPLADS records loaded here — ${num(t.members)} members across ${num(t.states)} states and union territories, ${inr(t.allocated)} allocated in total.`;
    return {
      text: paras(`${opener} ${body}`, 'Ask me about a member, a state, fund utilisation, or how the screening works.'),
      suggestions: s.isAdmin
        ? ['What should I review first?', 'Summarise the loaded datasets', 'Show recent audit activity']
        : ['Give me an overview of the data', 'Which states have the highest allocation?', 'How does the anomaly screening work?'],
    };
  },

  howAreYou() {
    return {
      text: 'Running normally, thank you — all four screening methods available and the loaded records ready to query. More usefully: I answer entirely from this server, so I am as fast as the database and never held up by an outside service. What would you like to look at?',
      suggestions: ['What can you do?', 'Give me an overview of the data', 'Which members have the lowest fund utilisation?'],
    };
  },

  thanks(s) {
    return {
      text: `Glad it helped.${s.memory.lastSubject ? ` I still have ${s.memory.lastSubject} in mind if you want to go further with it.` : ''} Anything else you'd like to pull out of the data?`,
      suggestions: s.suggestionsFor('followUp'),
    };
  },

  farewell() {
    return {
      text: 'Goodbye — the portal stays open if you want to come back to it. Every figure I gave you is also on the States, Projects and Compare screens, so you can check any of it against the underlying rows.',
      suggestions: [],
    };
  },

  identity(s) {
    return {
      text: paras(K.IDENTITY.who, `Right now I'm reading ${num(s.repo.totals(s.house).records)} records under ${houseLabel(s.house)}.`),
      suggestions: ['Do you use an external API?', 'What can you do?', 'What is PRAMANA?'],
    };
  },

  aboutPramana() {
    return {
      text: paras(K.IDENTITY.about, 'It is built for scrutiny rather than judgement: it shows what stands out statistically and leaves the conclusion to a human reviewer.'),
      suggestions: ['How does the anomaly screening work?', 'What is MPLADS?', 'What data is loaded?'],
    };
  },

  usesAi() {
    return { text: K.IDENTITY.offline, suggestions: ['How does the anomaly screening work?', 'What can you do?', 'What data is loaded?'] };
  },

  privacy() {
    return { text: K.IDENTITY.privacy, suggestions: ['What is PRAMANA?', 'What data is loaded?'] };
  },

  accusation(s) {
    const extra = s.members.length === 1
      ? paras('Here is what the data actually holds for that member:', memberBlock(s.members[0]))
      : null;
    return { text: paras(K.IDENTITY.refusal, extra), suggestions: ['How does the anomaly screening work?', 'Show the most-flagged records', 'What does a flag actually mean?'] };
  },

  capabilities(s) {
    const publicSkills = lines(
      'Here is what I can do, all of it read from the loaded records:',
      '',
      '**Members** — a profile for any member by name, or a side-by-side comparison of up to four ("compare Atul Garg and Mahesh Sharma").',
      '**States** — totals, averages and works for any state or union territory, and rankings across all of them.',
      '**Rankings** — highest or lowest on allocation, utilisation, expenditure, works completed or completion rate, for members or states.',
      '**Screening** — how many records were flagged, by which methods, which stand out most, and what each method actually measures.',
      '**The scheme** — how MPLADS works, what the entitlement is, what the terms in these tables mean.',
      '**The portal** — where to find the map, the compare tool, the projects list and the downloads.',
    );
    const adminSkills = lines(
      '',
      'And because you are signed in as an administrator:',
      '**Review queue** — what is still unreviewed and which records to take first.',
      '**Datasets** — what is loaded, what is analysed, how to upload and map a new file.',
      '**Audit and security** — recent activity, failed sign-ins, locked accounts, active sessions.',
      '**Reports** — how to generate and re-download the PDF screening report.',
    );
    return {
      text: lines(publicSkills, s.isAdmin ? adminSkills : ''),
      suggestions: s.isAdmin
        ? ['What should I review first?', 'How do I upload a dataset?', 'Show security events']
        : ['Give me an overview of the data', 'Top 5 states by allocation', 'What is MPLADS?'],
    };
  },

  /* ---- knowledge --------------------------------------------------------- */

  aboutMplads(s) {
    const q = s.parsed.clean;
    if (/\b(entitle|how much|limit|crore|allowance|per year|annual)\b/.test(q)) {
      return { text: paras(K.SCHEME.entitlement, K.BACKGROUND_NOTE), suggestions: ['How does allocation vary between members?', 'Show the largest allocations in the data'] };
    }
    if (/\b(eligib|allowed|permitted|can (an? )?mp|rules|guideline|excluded)\b/.test(q)) {
      return { text: paras(K.SCHEME.eligibility, K.BACKGROUND_NOTE), suggestions: ['What is MPLADS?', 'Which domains appear in the data?'] };
    }
    if (/\b(who|ministry|mospi|administer|manage|run)\b/.test(q)) {
      return { text: paras(K.SCHEME.who, K.BACKGROUND_NOTE), suggestions: ['What is PRAMANA?', 'What is MPLADS?'] };
    }
    return { text: paras(K.SCHEME.what, K.BACKGROUND_NOTE), suggestions: ['What is the annual entitlement?', 'What works are eligible?', 'What data is loaded here?'] };
  },

  methodology(s) {
    const q = s.parsed.clean;
    if (/\biqr\b|interquartile|quartile/.test(q)) return { text: K.METHODOLOGY.iqr, suggestions: ['What is the modified Z-score?', 'What does a classification mean?'] };
    if (/modified z|mad\b|median absolute/.test(q)) return { text: K.METHODOLOGY.modz, suggestions: ['What is the Z-score?', 'How are records classified?'] };
    if (/z-?\s?score|standard deviation/.test(q)) return { text: K.METHODOLOGY.zscore, suggestions: ['What is the modified Z-score?', 'What is the IQR rule?'] };
    if (/percentile/.test(q)) return { text: K.METHODOLOGY.percentile, suggestions: ['What is the IQR rule?', 'How are records classified?'] };
    if (/classif|categor|severity|level/.test(q)) return { text: K.METHODOLOGY.classification, suggestions: ['How many records were flagged?', 'What are the limits of this screening?'] };
    if (/cross[- ]?dataset|two datasets|across datasets/.test(q)) return { text: K.METHODOLOGY.crossDataset, suggestions: ['What datasets are loaded?'] };
    if (/\b(limit|weakness|wrong|cannot|can'?t|false positive|reliable|accurate|trust)\b/.test(q)) return { text: K.METHODOLOGY.limits, suggestions: ['How does the screening work?', 'What does a flag actually mean?'] };
    return {
      text: K.METHODOLOGY.overview,
      suggestions: ['What is the modified Z-score?', 'What are the limits of this screening?', 'How many records were flagged?'],
    };
  },

  glossary(s) {
    const q = s.parsed.clean;
    if (/classif|normal\b|moderate\b|severity/.test(q)) return { text: K.METHODOLOGY.classification, suggestions: ['How does the screening work?', 'Show the most-flagged records'] };
    const pick = [
      [/utilis|utiliz/, 'utilisation'],
      [/expenditure|spent|paid out|disburs/, 'expenditure'],
      [/recommend/, 'recommended'],
      [/allocat|entitlement/, 'allocation'],
      [/unpaid|balance/, 'unpaid'],
      [/completion|works? rate/, 'completion'],
      [/anomal|outlier|flag/, 'anomaly'],
      [/lok|rajya|house/, 'house'],
      [/constituenc/, 'constituency'],
    ].find(([re]) => re.test(q));
    if (pick) {
      return { text: K.GLOSSARY[pick[1]], suggestions: ['What is the difference between recommended and spent?', 'How does the screening work?'] };
    }
    return {
      text: lines(
        'The measures in this data, briefly:',
        '',
        `• **Allocated limit** — ${K.GLOSSARY.allocation}`,
        `• **Recommended** — ${K.GLOSSARY.recommended}`,
        `• **Expenditure** — ${K.GLOSSARY.expenditure}`,
        `• **Fund utilisation** — ${K.GLOSSARY.utilisation}`,
      ),
      suggestions: ['What is fund utilisation?', 'What does a flag mean?', 'Give me an overview of the data'],
    };
  },

  navigation(s) {
    const q = s.parsed.clean;
    const map = [
      [/map|state|india/, K.NAVIGATION.states, '/states'],
      [/compar/, K.NAVIGATION.compare, '/compare'],
      [/project|work|record|list/, K.NAVIGATION.projects, '/projects'],
      [/house|lok|rajya|filter/, K.NAVIGATION.house, null],
      [/language|hindi|translat/, K.NAVIGATION.language, null],
      [/download|export|csv|pdf|report/, K.NAVIGATION.download, null],
      [/admin|sign ?in|log ?in|dashboard/, K.NAVIGATION.admin, '/admin'],
    ].find(([re]) => re.test(q));
    if (map) {
      return { text: map[1], actions: map[2] ? [{ label: 'Open it', url: map[2] }] : [], suggestions: ['What can you do?', 'Give me an overview of the data'] };
    }
    return {
      text: lines(
        'The portal has four public views:',
        `• **States** — ${K.NAVIGATION.states}`,
        `• **Projects** — ${K.NAVIGATION.projects}`,
        `• **Compare** — ${K.NAVIGATION.compare}`,
        `• **About** — what PRAMANA is and how it screens the data.`,
        '',
        K.NAVIGATION.house,
      ),
      suggestions: ['Open the states map', 'Compare two members', 'What can you do?'],
    };
  },

  language() {
    return {
      text: paras(K.NAVIGATION.language, 'I read questions in English. If a question comes in another language I will usually still catch the names and measures in it, but the reply will be in English.'),
      suggestions: ['What can you do?', 'Give me an overview of the data'],
    };
  },

  /* ---- data -------------------------------------------------------------- */

  overview(s) {
    const t = s.repo.totals(s.house);
    const anomalies = s.repo.anomalySummary(s.house);
    const top = s.repo.stateRanking({ metric: 'allocation', limit: 3, house: s.house });
    return {
      text: paras(
        `Across ${houseLabel(s.house)}, the loaded data covers ${num(t.records)} records — ${num(t.members)} members in ${num(t.states)} states and union territories.`,
        lines(
          `• Allocated ${inr(t.allocated)}, averaging ${inr(t.avgAllocation)} per record`,
          `• Recommended ${inr(t.recommended)} — fund utilisation ${pct(share(t.recommended, t.allocated))}`,
          `• Actually paid out ${inr(t.expenditure)} (${pct(share(t.expenditure, t.allocated))} of the allocated limit)`,
          `• Works ${num(t.worksCompleted)} completed of ${num(t.worksRecommended)} recommended`,
          `• Screening: ${num(anomalies.flagged)} of ${num(anomalies.analysed)} analysed records carry at least one signal`,
        ),
        `Largest state totals: ${top.rows.map((r) => `${r.state} (${inr(r.value)})`).join(', ')}.`,
      ),
      suggestions: ['Top 5 states by allocation', 'Which members have the lowest fund utilisation?', 'How many records were flagged?'],
    };
  },

  datasets(s) {
    const rows = s.repo.datasets();
    if (!rows.length) {
      return {
        text: 'No datasets are loaded yet. An administrator uploads a CSV or XLSX from Admin → Datasets, and analysis becomes available once the file has been ingested and mapped.',
        suggestions: s.isAdmin ? ['How do I upload a dataset?'] : ['What is PRAMANA?'],
      };
    }
    const list = rows.map((d) => `• **${d.name}** — ${num(d.row_count)} records${d.house ? `, ${d.house}` : ''}, status ${d.status}${d.is_demo ? ' (demonstration data)' : ''}`).join('\n');
    return {
      text: paras(`${rows.length} dataset${rows.length === 1 ? '' : 's'} loaded:`, list,
        rows.filter((d) => d.status === 'analyzed' || d.analyzed_at).length >= 2
          ? 'Two or more analysed datasets are present, so cross-dataset matching is active alongside the four statistical methods.'
          : null),
      suggestions: s.isAdmin ? ['How do I upload a dataset?', 'What should I review first?'] : ['Give me an overview of the data', 'How does the screening work?'],
    };
  },

  financialYear(s) {
    const rows = s.repo.financialYears(s.house);
    if (!rows.length) {
      return {
        text: 'The loaded datasets do not carry a financial-year column, so I cannot break the figures down by year. The totals I hold are cumulative across whatever period the extract covers.',
        suggestions: ['Give me an overview of the data', 'Top 5 states by allocation'],
      };
    }
    return {
      text: paras('By financial year in the loaded data:',
        rows.map((r) => `• ${r.year} — ${inr(r.allocated)} allocated across ${num(r.records)} records`).join('\n')),
      suggestions: ['Give me an overview of the data', 'Top 5 states by allocation'],
    };
  },

  domains(s) {
    const rows = s.repo.domains(s.house, s.parsed.limit || 8);
    if (!rows.length) {
      return {
        text: 'The datasets loaded here do not include a domain or sector column, so sector-level analysis is not available. If a dataset carrying that field is uploaded, domain breakdowns switch on automatically — nothing needs configuring.',
        suggestions: ['What data is loaded?', 'Give me an overview of the data'],
      };
    }
    return {
      text: paras('Domains present in the loaded data, by total allocation:',
        rows.map((r) => `• ${r.domain} — ${inr(r.allocated)} across ${num(r.records)} records`).join('\n')),
      suggestions: ['Top 5 states by allocation', 'How many records were flagged?'],
    };
  },

  houseSplit(s) {
    const rows = s.repo.houseSplit();
    if (!rows.length) return handlers.overview(s);
    const body = rows.map((r) => lines(
      `**${r.house}** — ${num(r.members)} members, ${num(r.records)} records`,
      `  • Allocated ${inr(r.allocated)} · recommended ${inr(r.recommended)} · paid out ${inr(r.expenditure)}`,
      `  • Fund utilisation ${pct(share(r.recommended, r.allocated))} · works ${num(r.worksCompleted)} of ${num(r.worksRecommended)} completed`,
    )).join('\n\n');
    return {
      text: paras('Side by side, the two Houses in the loaded data:', body,
        'The two are not directly comparable: the Houses differ in membership size, term structure and how a member\'s area is defined, so totals differ for reasons that have nothing to do with performance.'),
      suggestions: ['Top 5 states by allocation', 'Which members have the lowest fund utilisation?'],
    };
  },

  count(s) {
    const q = s.parsed.clean;
    const t = s.repo.totals(s.house);
    if (s.states.length) return handlers.stateProfile(s);
    if (/\bstates?\b|\buts?\b/.test(q)) return { text: `The loaded data covers ${num(t.states)} states and union territories under ${houseLabel(s.house)}.`, suggestions: ['Top 5 states by allocation'] };
    if (/\bdatasets?\b|\bfiles?\b/.test(q)) return handlers.datasets(s);
    if (/\bflag|anomal|outlier/.test(q)) return handlers.anomalies(s);
    if (/\bworks?\b|\bprojects?\b/.test(q)) {
      return {
        text: `Works in the loaded data under ${houseLabel(s.house)}: ${num(t.worksCompleted)} completed of ${num(t.worksRecommended)} recommended — a completion rate of ${pct(share(t.worksCompleted, t.worksRecommended))}.`,
        suggestions: ['Which members have the most works completed?', 'Top 5 states by allocation'],
      };
    }
    return {
      text: `Under ${houseLabel(s.house)} the data holds ${num(t.records)} records covering ${num(t.members)} members across ${num(t.states)} states and union territories, with ${inr(t.allocated)} allocated in total.`,
      suggestions: ['Give me an overview of the data', 'Top 5 states by allocation'],
    };
  },

  average(s) {
    const state = s.states[0] || null;
    const p = state ? s.repo.stateProfile(state, s.house) : null;
    if (state && p) {
      return {
        text: paras(
          `In ${state}, the average allocated limit is ${inr(p.avgAllocation)} across ${num(p.records)} records, ranging from ${inr(p.minAllocation)} to ${inr(p.maxAllocation)}.`,
          `Averaged over the whole state: fund utilisation ${pct(share(p.recommended, p.allocated))}, works completion ${pct(share(p.worksCompleted, p.worksRecommended))}.`,
          'An average across members hides term length: a member who entered the House recently pulls it down without that meaning anything about performance.',
        ),
        suggestions: [`Tell me about ${state}`, 'Top 5 states by allocation'],
      };
    }
    const t = s.repo.totals(s.house);
    return {
      text: paras(
        `Across ${houseLabel(s.house)}, the average allocated limit is ${inr(t.avgAllocation)} per record over ${num(t.records)} records.`,
        lines(
          `• Average recommended ${inr(t.recommended / (t.records || 1))} per record`,
          `• Average paid out ${inr(t.expenditure / (t.records || 1))} per record`,
          `• Overall fund utilisation ${pct(share(t.recommended, t.allocated))} — computed from the totals, not by averaging percentages`,
        ),
        'Averaging percentages across members would weight a small portfolio the same as a large one, so the rates above are recomputed from the totals instead.',
      ),
      suggestions: ['Top 5 states by allocation', 'Which members have the lowest fund utilisation?'],
    };
  },

  memberProfile(s) {
    if (!s.members.length) return handlers.unknown(s);
    const m = s.members[0];
    const anomaly = m.classification && m.classification !== 'Normal' && m.explanation
      ? `Why it was flagged: ${m.explanation}`
      : null;
    return {
      text: paras(memberBlock(m), anomaly, CAVEAT),
      actions: [{ label: 'Open the full record', url: `/compare?ids=${m.id}` }],
      suggestions: [`How does ${m.state} compare overall?`, 'Compare this member with another', 'Why was this record flagged?'],
    };
  },

  comparison(s) {
    if (s.members.length < 2) {
      if (s.states.length >= 2) return handlers.stateComparison(s);
      if (/^(where|how do i|how can i|open|take me)/.test(s.parsed.clean)) return handlers.navigation(s);
      // "What's the difference between recommended and spent?" names two measures, not
      // two people — answer the definition rather than asking for names.
      const measureWords = (s.parsed.clean.match(/\b(allocation|allocated|recommended|expenditure|spent|paid|utilisation|utilization|works|completion|unpaid|balance)\b/g) || []);
      if (new Set(measureWords).size >= 2 || /\bdifference between\b|\bdiffer\w* between\b/.test(s.parsed.clean)) {
        return handlers.glossary(s);
      }
      const one = s.members.length === 1 ? ` I found ${s.members[0].name}, but only one name.` : '';
      return {
        text: `To compare, give me two names and I will put them side by side.${one} For example: "compare Atul Garg and Mahesh Sharma". I can take up to four at once.`,
        suggestions: ['Top 5 members by allocation', 'Which members have the lowest fund utilisation?'],
      };
    }
    const picked = s.members.slice(0, 4);
    const body = picked.map(memberBlock).join('\n\n');

    let verdict = '';
    if (picked.length === 2) {
      const [a, b] = picked;
      const call = (va, vb, label) => {
        if (va === null || va === undefined || vb === null || vb === undefined) return null;
        if (va === vb) return `${label}: level`;
        return `${label}: ${va > vb ? a.name : b.name}`;
      };
      const picks = [
        call(a.utilization, b.utilization, 'Higher fund utilisation'),
        call(a.worksCompleted, b.worksCompleted, 'More works completed'),
        call(a.spent, b.spent, 'Larger amount paid out'),
      ].filter(Boolean);
      if (picks.length) verdict = `On the figures — ${picks.join('; ')}.`;
    }

    return {
      text: paras(`Comparing ${picked.length} members from the loaded data:`, body, verdict, CAVEAT),
      actions: [{ label: 'Open the full comparison', url: `/compare?ids=${picked.map((m) => m.id).join(',')}` }],
      suggestions: ['Which of them was flagged by the screening?', 'How do their states compare?', 'What is fund utilisation?'],
    };
  },

  stateProfile(s) {
    if (!s.states.length) return handlers.unknown(s);
    if (s.states.length >= 2) return handlers.stateComparison(s);
    const state = s.states[0];
    const p = s.repo.stateProfile(state, s.house);
    if (!p) {
      return {
        text: `${state} appears in the list of states but has no records under ${houseLabel(s.house)}. Switching the House filter to both Houses may bring its records into scope.`,
        suggestions: ['Top 5 states by allocation', 'Give me an overview of the data'],
      };
    }
    const members = s.repo.membersIn(state, s.house, 3);
    return {
      text: paras(
        `**${state}** — ${num(p.members)} members, ${num(p.records)} records${p.allocationRank ? `, ranked ${p.allocationRank} by total allocation` : ''}.`,
        lines(
          `• Allocated ${inr(p.allocated)} (average ${inr(p.avgAllocation)}, range ${inr(p.minAllocation)} to ${inr(p.maxAllocation)})`,
          `• Recommended ${inr(p.recommended)} — fund utilisation ${pct(share(p.recommended, p.allocated))}`,
          `• Paid out ${inr(p.expenditure)} (${pct(share(p.expenditure, p.allocated))} of allocation)`,
          `• Works ${num(p.worksCompleted)} completed of ${num(p.worksRecommended)} recommended`,
          `• ${num(p.flagged)} record${p.flagged === 1 ? '' : 's'} carry at least one statistical signal`,
        ),
        members.length ? `Largest allocations there: ${members.map((m) => `${m.mp_name} (${inr(m.amount)})`).join(', ')}.` : null,
      ),
      actions: [{ label: `Open ${state} on the map`, url: `/states?state=${encodeURIComponent(state)}` }],
      suggestions: [`Which members in ${state} have the lowest utilisation?`, `Compare ${state} with another state`, 'Top 5 states by allocation'],
    };
  },

  stateComparison(s) {
    const picked = s.states.slice(0, 3)
      .map((name) => s.repo.stateProfile(name, s.house))
      .filter(Boolean);
    if (picked.length < 2) return handlers.stateProfile(s);
    const body = picked.map((p) => lines(
      `**${p.state}** — ${num(p.members)} members`,
      `  • Allocated ${inr(p.allocated)} · paid out ${inr(p.expenditure)}`,
      `  • Fund utilisation ${pct(share(p.recommended, p.allocated))} · works ${num(p.worksCompleted)} of ${num(p.worksRecommended)} completed`,
      `  • ${num(p.flagged)} flagged record${p.flagged === 1 ? '' : 's'}`,
    )).join('\n\n');
    const best = [...picked].sort((a, b) => (share(b.recommended, b.allocated) || 0) - (share(a.recommended, a.allocated) || 0))[0];
    return {
      text: paras(`Comparing ${picked.length} states under ${houseLabel(s.house)}:`, body,
        `${best.state} shows the highest fund utilisation of these. Totals here track the number of members a state has as much as anything else, so a larger total is not a better result.`),
      suggestions: ['Top 5 states by allocation', 'Which states have the lowest utilisation?'],
    };
  },

  ranking(s) {
    const metricKey = s.metric || 'allocation';
    const direction = s.direction || 'desc';
    const limit = s.parsed.limit || 5;
    const wantsStates = /\bstates?\b|\buts?\b|state ?wise|\bregions?\b/.test(s.parsed.clean);

    if (wantsStates) {
      const { metric, rows } = s.repo.stateRanking({
        metric: metricKey, direction, limit, house: s.house,
      });
      if (!rows.length) return handlers.unknown(s);
      const note = metric.kind === 'money'
        ? 'Higher totals largely reflect how many members a state has, not a judgement about spending.'
        : 'These are aggregates across all members in each state, computed from the totals rather than by averaging percentages.';
      return {
        text: paras(`States by ${metric.label}, ${direction === 'desc' ? 'highest' : 'lowest'} first (${houseLabel(s.house)}):`,
          rankingList(rows, metric, 'state'), note),
        actions: [{ label: 'Open the states map', url: '/states' }],
        suggestions: [`Which members lead on ${metric.label}?`, `Tell me about ${rows[0].state}`, 'Give me an overview of the data'],
      };
    }

    const stateFilter = s.states.length === 1 ? s.states[0] : null;
    const { metric, rows } = s.repo.memberRanking({
      metric: metricKey, direction, limit, house: s.house, state: stateFilter,
    });
    if (!rows.length) return handlers.unknown(s);

    const zeroNote = direction === 'asc' && metric.kind === 'percent' && rows.some((r) => Number(r.value) === 0)
      ? 'A reading of 0% means no works have been recommended yet, which is the expected position for a member who entered the House recently — it is a statement about tenure, not about performance.'
      : null;

    return {
      text: paras(
        `Members by ${metric.label}, ${direction === 'desc' ? 'highest' : 'lowest'} first${stateFilter ? ` in ${stateFilter}` : ''} (${houseLabel(s.house)}):`,
        rankingList(rows, metric, 'member'),
        zeroNote,
        CAVEAT,
      ),
      actions: [{ label: 'Compare the top of this list', url: `/compare?ids=${rows.slice(0, 3).map((r) => r.id).join(',')}` }],
      suggestions: [`Tell me about ${rows[0].mp_name}`, `Same ranking for states`, 'How does the screening work?'],
    };
  },

  anomalies(s) {
    const q = s.parsed.clean;

    // "Why was X flagged?" — a specific record's screening result.
    if (s.members.length === 1 && /\bwhy|reason|explain|what (made|makes)\b/.test(q)) {
      const m = s.members[0];
      if (!m.classification || m.classification === 'Normal') {
        return {
          text: `${m.name}'s record was not flagged — the screening classified it as ${m.classification || 'not analysed'}. That means no statistical method found the values unusual relative to the rest of that dataset. It is not a clearance: the screening reads numbers against numbers and cannot see whether a work was built or a price was fair.`,
          suggestions: ['Show the most-flagged records', 'How does the screening work?'],
        };
      }
      return {
        text: paras(
          `${m.name} — classified **${m.classification}**${m.methodCount ? `, with ${m.methodCount} of 4 methods in agreement` : ''}${m.percentileRank !== null && m.percentileRank !== undefined ? `, sitting at the ${Number(m.percentileRank).toFixed(1)}th percentile of its dataset` : ''}.`,
          m.explanation || null,
          `The figures behind it: allocated ${inr(m.allocated)}, recommended ${inr(m.recommended)}, paid out ${inr(m.spent)}.`,
          CAVEAT,
        ),
        actions: [{ label: 'Open the record', url: `/compare?ids=${m.id}` }],
        suggestions: ['What does that classification mean?', 'Show the most-flagged records', 'How does the screening work?'],
      };
    }

    const summary = s.repo.anomalySummary(s.house);
    if (!summary.analysed) {
      return {
        text: 'No dataset has been analysed yet, so there are no screening results to report. Records are ingested first and screened as a separate step.',
        suggestions: s.isAdmin ? ['How do I run the analysis?', 'What datasets are loaded?'] : ['What data is loaded?'],
      };
    }

    // A request for the specific records rather than the totals.
    if (/\b(show|list|which|worst|top|most|biggest|give me)\b/.test(q) || s.states.length) {
      const rows = s.repo.topAnomalies({
        house: s.house, limit: s.parsed.limit || 5, state: s.states[0] || null,
      });
      if (rows.length) {
        const body = rows.map((r, i) => lines(
          `${i + 1}. ${r.mp_name} (${r.state || 'state not recorded'}) — ${r.classification}, ${r.method_count} of 4 methods`,
          `   ${inr(r.amount)}${r.percentile_rank !== null && r.percentile_rank !== undefined ? ` · ${Number(r.percentile_rank).toFixed(1)}th percentile` : ''} · review status ${r.review_status}`,
        )).join('\n');
        return {
          text: paras(`The records where the most methods agree${s.states[0] ? ` in ${s.states[0]}` : ''}:`, body, CAVEAT),
          actions: [{ label: 'Open the anomaly explorer', url: s.isAdmin ? '/admin/anomalies' : '/projects' }],
          suggestions: ['Why was the first one flagged?', 'How does the screening work?', 'What does a flag actually mean?'],
        };
      }
    }

    const byClass = summary.byClass.map((c) => `${c.classification}: ${num(c.count)}`).join(', ');
    const methods = summary.byMethod || {};
    return {
      text: paras(
        `Of ${num(summary.analysed)} analysed records under ${houseLabel(s.house)}, ${num(summary.flagged)} carry at least one statistical signal (${pct(share(summary.flagged, summary.analysed))} of them).`,
        lines(
          `• By classification — ${byClass}`,
          `• By method — IQR ${num(methods.iqr)}, Z-score ${num(methods.z)}, modified Z ${num(methods.modz)}, 95th percentile ${num(methods.pct95)}, 99th percentile ${num(methods.pct99)}`,
          `• Review — ${num(summary.unreviewed)} still unreviewed, ${num(summary.confirmed)} confirmed, ${num(summary.dismissed)} dismissed`,
        ),
        CAVEAT,
      ),
      suggestions: ['Show the most-flagged records', 'How does the screening work?', s.isAdmin ? 'What should I review first?' : 'What does a flag actually mean?'],
    };
  },

  /* ---- administrator ----------------------------------------------------- */

  adminUpload() {
    return { text: K.ADMIN.upload, actions: [{ label: 'Open datasets', url: '/admin/datasets' }], suggestions: ['How do I run the analysis?', 'What datasets are loaded?'] };
  },

  adminAnalysis(s) {
    const pending = s.repo.datasets().filter((d) => !d.analyzed_at && d.status !== 'analyzed');
    return {
      text: paras(K.ADMIN.analysis, pending.length
        ? `Currently waiting on analysis: ${pending.map((d) => d.name).join(', ')}.`
        : 'Every loaded dataset has already been analysed.'),
      actions: [{ label: 'Open datasets', url: '/admin/datasets' }],
      suggestions: ['What should I review first?', 'How does the screening work?'],
    };
  },

  adminReview(s) {
    const summary = s.repo.anomalySummary(s.house);
    const queue = s.repo.reviewQueue({ house: s.house, limit: s.parsed.limit || 5 });
    const body = queue.length
      ? queue.map((r, i) => `${i + 1}. ${r.mp_name} (${r.state || 'state not recorded'}) — ${r.classification}, ${r.method_count} of 4 methods, score ${num(r.anomaly_score)}`).join('\n')
      : null;
    return {
      text: paras(
        `${num(summary.unreviewed)} flagged record${summary.unreviewed === 1 ? ' is' : 's are'} still unreviewed, out of ${num(summary.flagged)} flagged. ${num(summary.confirmed)} confirmed and ${num(summary.dismissed)} dismissed so far.`,
        body ? paras('Highest score first — that is the order I would take them in:', body) : 'The queue is clear.',
        K.ADMIN.review,
      ),
      actions: [{ label: 'Open the investigation queue', url: '/admin/investigation' }],
      suggestions: queue.length
        ? [`Why was ${queue[0].mp_name} flagged?`, 'How does the screening work?', 'Generate a report']
        : ['Show recent audit activity', 'What datasets are loaded?'],
    };
  },

  adminReports(s) {
    const r = s.repo.reportSummary();
    return {
      text: paras(K.ADMIN.reports, r.total
        ? `${num(r.total)} report${r.total === 1 ? '' : 's'} generated so far${r.last ? `; the most recent was ${r.last.format || 'PDF'} on ${r.last.generated_at}${r.last.dataset ? ` for ${r.last.dataset}` : ''}` : ''}.`
        : 'No report has been generated from this deployment yet.'),
      actions: [{ label: 'Open reports', url: '/admin/reports' }],
      suggestions: ['What should I review first?', 'What datasets are loaded?'],
    };
  },

  adminAudit(s) {
    const a = s.repo.auditSummary(s.parsed.limit || 5);
    const recent = a.recent.length
      ? a.recent.map((e) => `• ${e.ts} — ${e.action}${e.actor_email ? ` by ${e.actor_email}` : ''} (${e.actor_role || 'anonymous'})`).join('\n')
      : 'Nothing recorded yet.';
    const common = a.byAction.length ? a.byAction.map((x) => `${x.action} (${num(x.count)})`).join(', ') : 'none';
    return {
      text: paras(
        `The audit log holds ${num(a.total)} entries. Most frequent actions: ${common}.`,
        paras('Most recent:', recent),
        K.ADMIN.audit,
      ),
      actions: [{ label: 'Open the audit log', url: '/admin/audit' }],
      suggestions: ['Show security events', 'What should I review first?'],
    };
  },

  adminSecurity(s) {
    const sec = s.repo.securitySummary(s.parsed.limit || 5);
    const recent = sec.recent.length
      ? sec.recent.map((e) => `• ${e.ts} — ${e.event_type}${e.email ? ` (${e.email})` : ''}${e.ip ? ` from ${e.ip}` : ''}`).join('\n')
      : 'No security events recorded.';
    return {
      text: paras(
        `${num(sec.activeSessions)} active session${sec.activeSessions === 1 ? '' : 's'}; ${num(sec.lockedOut)} account${sec.lockedOut === 1 ? '' : 's'} currently locked.`,
        paras('Recent events:', recent),
        K.ADMIN.security,
      ),
      actions: [{ label: 'Open security', url: '/admin/security' }],
      suggestions: ['Show recent audit activity', 'How many admin accounts exist?'],
    };
  },

  adminUsers(s) {
    const u = s.repo.userSummary();
    const byRole = u.byRole.map((r) => `${num(r.count)} ${r.role}`).join(', ') || 'none';
    return {
      text: paras(`Accounts on this deployment: ${byRole}.`, K.ADMIN.users),
      actions: [{ label: 'Open security', url: '/admin/security' }],
      suggestions: ['Show security events', 'Show recent audit activity'],
    };
  },

  adminAiConfig() {
    return {
      text: K.ADMIN.aiConfig,
      actions: [{ label: 'Open AI configuration', url: '/admin/ai' }],
      suggestions: ['What can you do?', 'How does the screening work?'],
    };
  },

  /* ---- fallback ---------------------------------------------------------- */

  unknown(s) {
    const t = s.repo.totals(s.house);
    const nearMiss = s.parsed.candidates.length > 1 ? s.parsed.candidates[1] : null;
    const hint = nearMiss && nearMiss.score >= 4 ? 'If I have misread that, rephrase it and I will try again. ' : '';
    return {
      text: paras(
        `I could not place that question against the data I hold. ${hint}I can read ${num(t.records)} records — ${num(t.members)} members across ${num(t.states)} states and union territories — and answer on members, states, allocation and expenditure, works, fund utilisation, and the statistical screening.`,
        'Things that work well: naming two members to compare, asking for the top or bottom of any measure, asking about a state by name, or asking how a screening method works.',
      ),
      suggestions: s.isAdmin
        ? ['What should I review first?', 'Top 5 states by allocation', 'What can you do?']
        : ['Give me an overview of the data', 'Top 5 states by allocation', 'What can you do?'],
    };
  },
};

/* -------------------------------------------------------------------------- */
/* Conversation memory                                                         */
/* -------------------------------------------------------------------------- */

const EMPTY_MEMORY = {
  members: [], state: null, metric: null, direction: null,
  lastIntent: null, lastSubject: null, turnCount: 0,
};

/**
 * Carries forward whatever the new question leaves unsaid. This is what makes
 * "and Bihar?", "what about his works?" and "same for states" behave the way a
 * person expects rather than resetting to a blank slate each turn.
 */
function applyMemory(parsed, resolved, memory) {
  // Only an explicit continuation inherits the previous subject. Treating any short
  // question as a follow-up made unrelated queries silently inherit a state filter.
  const inheritEntities = parsed.isFollowUp || parsed.hasPronoun;

  let members = resolved;
  if (!members.length && inheritEntities && memory.members.length) members = memory.members;

  let states = parsed.states;
  if (!states.length && inheritEntities && memory.state && !members.length) states = [memory.state];

  const metric = parsed.metric || (parsed.isFollowUp ? memory.metric : null);
  const direction = parsed.direction || (parsed.isFollowUp ? memory.direction : null);

  return { members, states, metric, direction };
}

/* -------------------------------------------------------------------------- */
/* Entry point                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Answers one question.
 *
 * @param {string}  question  what the person typed
 * @param {object}  options   house lens, administrator flag, and the memory object
 *                            returned by the previous call
 */
function respond(question, { house = 'both', isAdmin = false, memory = null } = {}) {
  const { repo, resolveMembers, shapeMember } = D();
  const mem = { ...EMPTY_MEMORY, ...(memory || {}) };
  mem.turnCount += 1;

  const knownStates = repo.stateNames();
  const resolved = resolveMembers(question).map(shapeMember);
  const parsed = nlu.analyse(question, { knownStates, isAdmin, hasMember: resolved.length > 0 });
  const carried = applyMemory(parsed, resolved, mem);

  // A House named in the question overrides the lens the reader is browsing under,
  // for this answer only — "how is Rajya Sabha doing" should answer about it.
  const effectiveHouse = parsed.house || house;

  const s = {
    parsed,
    repo,
    isAdmin,
    house: effectiveHouse,
    members: carried.members,
    states: carried.states,
    metric: carried.metric,
    direction: carried.direction,
    memory: mem,
    suggestionsFor: () => (isAdmin
      ? ['What should I review first?', 'Show recent audit activity', 'Top 5 states by allocation']
      : ['Top 5 states by allocation', 'Which members have the lowest fund utilisation?', 'How does the screening work?']),
  };

  // Intent selection. The classifier proposes; a few structural facts about the
  // question override it, because a resolved pair of names or an explicit metric is
  // stronger evidence than any keyword.
  let intent = parsed.intent;
  const strong = parsed.confidence >= 10;

  if (!strong) {
    if (s.members.length >= 2) intent = 'comparison';
    else if (s.members.length === 1 && !['anomalies', 'accusation', 'comparison'].includes(intent)) {
      intent = /\b(why|flag|anomal|screen)/.test(parsed.clean) ? 'anomalies' : 'memberProfile';
    } else if (!intent && (s.metric || s.direction)) intent = 'ranking';
    else if (!intent && s.states.length) intent = s.states.length >= 2 ? 'stateComparison' : 'stateProfile';
  }
  if (intent === 'ranking' && !s.metric && !s.direction && !parsed.limit && s.states.length) {
    intent = s.states.length >= 2 ? 'stateComparison' : 'stateProfile';
  }
  if (!intent) intent = 'unknown';

  const handler = handlers[intent] || handlers.unknown;
  let result;
  try {
    result = handler(s);
  } catch (err) {
    // A malformed dataset must degrade to an honest sentence, never a stack trace.
    result = {
      text: 'I could not complete that read against the loaded records — the data may be missing a column that question needs. Try asking it a different way, or ask me for an overview to see what is actually available.',
      suggestions: ['Give me an overview of the data', 'What data is loaded?'],
      failed: err.message,
    };
  }

  const nextMemory = {
    members: s.members.slice(0, 4),
    state: s.states[0] || (s.members[0] ? s.members[0].state : null) || mem.state,
    metric: s.metric || mem.metric,
    direction: s.direction || mem.direction,
    lastIntent: intent,
    lastSubject: s.members.length
      ? s.members.map((m) => m.name).join(' and ')
      : (s.states[0] || mem.lastSubject),
    turnCount: mem.turnCount,
  };

  return {
    answer: result.text,
    intent,
    confidence: parsed.confidence,
    suggestions: result.suggestions || [],
    actions: result.actions || [],
    memory: nextMemory,
    grounding: {
      house: effectiveHouse,
      records: repo.totals(effectiveHouse).records,
      members: s.members.slice(0, 4).map((m) => ({
        id: m.id, name: m.name, state: m.state, house: m.house,
      })),
      states: s.states,
      isComparison: intent === 'comparison' || intent === 'stateComparison',
      compareUrl: s.members.length >= 2
        ? `/compare?ids=${s.members.slice(0, 4).map((m) => m.id).join(',')}`
        : null,
    },
  };
}

/** The opening message shown when the panel is first opened, with no question asked. */
function greeting({ house = 'both', isAdmin = false } = {}) {
  return respond('hello', { house, isAdmin, memory: null });
}

module.exports = {
  respond, greeting, handlers, __setDeps, inr, num, pct,
};
