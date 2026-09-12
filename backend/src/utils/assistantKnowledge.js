/**
 * The things PRAMANA AI knows that are not in the spreadsheet.
 *
 * Two kinds of content live here, and they are kept apart deliberately:
 *
 *   • How PRAMANA itself works — its screening methods, its screens, its admin
 *     workflow. This is a description of the software, so it is authoritative.
 *   • General background on the MPLAD Scheme. This is published scheme design, not
 *     a reading of the loaded data, and every answer drawn from it says so, so a
 *     reader never mistakes background for a finding about a specific member.
 *
 * Nothing here is generated. Editing this file is how you change what the
 * assistant says on these subjects.
 */

const BACKGROUND_NOTE = 'That is general background on how the scheme is designed — not a figure read from the datasets loaded here.';

const SCHEME = {
  what: [
    'The Members of Parliament Local Area Development Scheme (MPLADS) lets each MP recommend development works in their area, which the district authority then sanctions, executes and pays for. The MP recommends; they do not hold or spend the money themselves.',
    'Each Member is entitled to Rs 5 crore a year, released to the district authority in two instalments of Rs 2.5 crore. Lok Sabha members recommend works in their constituency; Rajya Sabha members choose a district in the state that elected them; nominated members may choose anywhere in India.',
    'The scheme is administered by the Ministry of Statistics and Programme Implementation (MoSPI), and recommendations and progress are recorded on the Government\'s e-SAKSHI portal. Guidelines set aside a share of funds for areas with substantial Scheduled Caste and Scheduled Tribe populations, and works must create durable community assets.',
  ].join('\n\n'),
  entitlement: 'Under the scheme guidelines each Member of Parliament is entitled to Rs 5 crore per year, released in two instalments of Rs 2.5 crore to the nodal district authority. Entitlement accrues with the term, so a member who entered the House recently has a smaller cumulative limit than one who has served a full term — which is why two members\' totals are often not directly comparable.',
  eligibility: 'MPLADS works must create durable community assets — school buildings, roads, drinking water, health infrastructure and similar. The guidelines exclude works on private land, memorials, office buildings for government, and grants to individuals. Recommendations go to the district authority, which checks eligibility before sanctioning.',
  who: 'MPLADS is administered by the Ministry of Statistics and Programme Implementation (MoSPI). Sanction and execution sit with the district authority in each district; the MP recommends works and the authority carries them out.',
};

const METHODOLOGY = {
  overview: [
    'Every analysed dataset is screened by four independent statistical methods, and each method is applied to that dataset\'s own distribution — no threshold is hard-coded, so the screening adapts to whatever data is uploaded.',
    '1. IQR rule — a value above Q3 + 1.5 x IQR (or below Q1 - 1.5 x IQR) is flagged; beyond 3 x IQR it is marked extreme.',
    '2. Z-score — how many standard deviations a value sits from the mean. |Z| above 3 is flagged.',
    '3. Modified Z-score — the same idea built on the median and the median absolute deviation, so a handful of very large values cannot drag the threshold with them. |M| above 3.5 is flagged.',
    '4. Percentile position — values at or above the 95th and 99th percentiles of the dataset are marked.',
    'A record is then classified by how many of the four agree. More agreement means the reading is less likely to be an artefact of one method\'s assumptions. Where a method\'s scale estimate is zero — every value identical, for instance — it reports "not applicable" rather than flagging everything.',
  ].join('\n'),
  iqr: 'The IQR rule sorts the values, takes the middle 50% (from the 25th percentile Q1 to the 75th percentile Q3), and calls that spread the interquartile range. Anything above Q3 + 1.5 x IQR or below Q1 - 1.5 x IQR is unusual relative to the bulk of the data; beyond 3 x IQR it is treated as extreme. It uses no mean and no standard deviation, so a few huge values do not move the boundary.',
  zscore: 'The Z-score expresses a value as the number of standard deviations it sits from the mean: Z = (value - mean) / standard deviation. PRAMANA flags |Z| above 3. Its weakness is that the mean and standard deviation are themselves pulled by outliers, which is exactly why the modified Z-score runs alongside it.',
  modz: 'The modified Z-score replaces the mean with the median and the standard deviation with the median absolute deviation (MAD): M = 0.6745 x (value - median) / MAD. PRAMANA flags |M| above 3.5. Because the median and MAD barely move when a few extreme values are present, this method catches outliers the ordinary Z-score misses.',
  percentile: 'Percentile position asks where a value sits in the sorted order rather than how far it is from the centre. A value at the 99th percentile is larger than 99% of the records in that dataset. It is a ranking statement, so it holds whatever shape the distribution has.',
  classification: 'The classification is the count of agreeing methods, not a verdict. Broadly: "Normal" means no method flagged the record; a single flag is a weak signal that can easily be legitimate; two or three agreeing methods make it worth a human look; all four agreeing means the value stands far outside its own dataset by every measure used. In all cases it is a prompt for review, never a finding of wrongdoing.',
  crossDataset: 'Where two or more analysed datasets are loaded, PRAMANA also matches records across them — the same member or constituency appearing in both — and flags disagreements between the two sources. That cross-dataset check is a fifth signal, reported separately from the four statistical methods.',
  limits: 'What the screening cannot do: it cannot see whether a work was actually built, whether a price was fair, or whether a procedure was followed. It reads numbers against other numbers. A flagged record may have an entirely ordinary explanation — a longer term, a larger constituency, a single big infrastructure work — and an unflagged record is not certified as clean.',
};

const GLOSSARY = {
  utilisation: 'Fund utilisation here means the amount recommended as a share of the allocated limit: recommended / allocated x 100. It measures how much of the entitlement has been committed to works, not how much money has actually left the treasury.',
  expenditure: 'Expenditure is the amount actually paid out against sanctioned works. It always trails recommendations, because a work is recommended first, sanctioned next, and paid for in stages as it is built. A gap between the two is normal and is not by itself a problem.',
  recommended: 'The recommended amount is the value of works an MP has proposed to the district authority. It is a commitment, not a payment.',
  allocation: 'The allocated limit is the entitlement available to that member in this dataset. It varies legitimately with how long the member has served, which House they sit in, and when they entered it.',
  unpaid: 'The unpaid balance is the amount sanctioned but not yet disbursed — money committed to works that are still in progress.',
  completion: 'The works completion rate is works completed as a share of works recommended. Recently recommended works are naturally still open, so a low rate can simply mean a young portfolio of works.',
  anomaly: 'An anomaly in PRAMANA is a value that sits far from the rest of its own dataset by one or more statistical tests. It is a signal for human review. It is not evidence of fraud, and PRAMANA never claims otherwise.',
  house: 'Parliament has two Houses. Lok Sabha members are directly elected from a constituency; Rajya Sabha members are elected by state legislatures or nominated, and so have no constituency of their own — which is why that column is empty for them here.',
  constituency: 'A constituency is the territorial seat a Lok Sabha member is elected from. Rajya Sabha members do not have one; they nominate a district in their state instead.',
};

const NAVIGATION = {
  states: 'The States view maps allocation and utilisation across India — select any state on the map to open its figures.',
  compare: 'The Compare tool puts up to four members side by side on the same measures. You can also just name two members here and I will read the comparison out.',
  projects: 'The Projects view lists individual records with filters for state, House and domain, and opens a detail drawer for any row.',
  house: 'The House selector in the header switches the whole portal — and this assistant — between Lok Sabha, Rajya Sabha, or both.',
  language: 'The language switcher sits in the header. It changes the portal\'s interface text; I answer in English regardless of that setting.',
  download: 'Data views offer a download of what you are looking at. Signed-in administrators can also generate a full PDF screening report from the Reports screen.',
  admin: 'Administrator screens are reached by signing in at /admin — datasets, the anomaly explorer, investigation queue, reports, audit log and security.',
};

const ADMIN = {
  upload: [
    'Upload from Admin → Datasets → Upload. CSV and XLSX are accepted, up to 25MB.',
    'PRAMANA reads the header row and maps your columns onto its own fields — member, state, constituency, House, allocated limit, recommended amount, expenditure, works recommended, works completed. The mapping it proposes is shown before anything is ingested, and you can correct any column it guessed wrong.',
    'Unmapped columns are not discarded — the original row is kept verbatim, so nothing in your file is lost.',
    'After ingestion the dataset sits at status "uploaded" until you run the analysis; only then are anomalies computed.',
  ].join('\n'),
  analysis: 'Open Admin → Datasets, pick the dataset and run the analysis. All four screening methods run over that dataset\'s own distribution, anomaly rows are written, and the status moves to analysed. Re-running is safe: it recomputes from the stored records and replaces the previous screening, so nothing is duplicated.',
  review: [
    'The investigation workflow: the Anomaly Explorer lists flagged records with the methods that agreed and the reason; open one and mark it Confirmed (worth escalating) or Dismissed (explained), with a note.',
    'Work the queue by anomaly score first — those are the records where the most methods agree.',
    'Every decision is written to the audit log with your account and the time, so the review history stands up to scrutiny later.',
    'A dismissal is as valuable as a confirmation: it records that a human looked and found an explanation.',
  ].join('\n'),
  reports: 'Admin → Reports generates a PDF covering the dataset, the totals, the screening results and the review decisions taken so far. Generated reports are listed with their timestamp so you can re-download an earlier one.',
  audit: 'Admin → Audit Log records every consequential action — sign-ins, uploads, analysis runs, review decisions, settings changes — with the account, the time and the originating IP. It is append-only from the application: there is no screen that edits or deletes an entry.',
  security: 'Admin → Security shows failed sign-in attempts, locked accounts and active sessions. Accounts lock automatically after repeated failures, sign-in is captcha-protected, sessions are server-side and revocable, and passwords are stored as bcrypt hashes.',
  users: 'Administrator accounts are managed from the admin area; roles are "admin" and "superadmin", with superadmin required for account and settings changes. Password resets issue a single-use, time-limited token — an administrator never sets another person\'s password directly.',
  aiConfig: [
    'PRAMANA AI runs entirely on this server. It reads the loaded records, resolves what your question refers to, and writes the answer itself — no external API, no API key, no outbound request, nothing leaving the deployment.',
    'The AI Configuration screen is optional and exists only for deployments that want a language model to rephrase the same figures more fluently. It is off by default, and leaving it empty costs you no capability: the built-in engine answers every question on its own.',
  ].join('\n\n'),
};

const IDENTITY = {
  who: 'I am PRAMANA AI, the data assistant built into this portal. I read the MPLADS records loaded here and answer from them — totals, states, members, side-by-side comparisons, and the statistical screening. I run locally on this server, so I have no knowledge of anything outside these datasets and no connection to any outside service.',
  about: 'PRAMANA is a statistical transparency prototype for MPLADS data. It ingests published scheme data, screens it with four independent statistical methods, and presents what it finds for human review — state by state, member by member. It is an analytical tool, not a Government system, and it is not the official e-SAKSHI portal.',
  offline: [
    'No. I do not call any external API, model or internet service — there is no API key involved and nothing you type leaves this server.',
    'How I answer: I normalise your question, correct obvious typos, work out what you are asking for and which members, states or measures you mean, run the corresponding query against the loaded records, and compose the answer from the figures that come back. Because every number is fetched rather than generated, I cannot invent one — if the data does not hold it, I say so instead.',
  ].join('\n\n'),
  privacy: 'This conversation stays on the server running PRAMANA. Nothing you type is sent to an external service, because the assistant does not call one. Questions are recorded in the audit log the same way other actions are, for accountability. The portal itself uses only the cookies needed to keep an administrator signed in, and the underlying MPLADS data is published scheme data, not personal data.',
  refusal: 'I can show you what the figures say, but I will not label anyone corrupt or fraudulent — and neither should the statistics. A record stands out here only relative to other records in the same file, and allocation totals differ legitimately with term length, House and date of entry. What a flag means is: a human should look at this. If you tell me a name or a state, I will give you the numbers and the screening result, and you can judge what deserves scrutiny.',
};

module.exports = {
  BACKGROUND_NOTE, SCHEME, METHODOLOGY, GLOSSARY, NAVIGATION, ADMIN, IDENTITY,
};
