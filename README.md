# PRAMANA — MPLADS Statistical Integrity & Transparency Explorer

> **PRAMANA is a statistical transparency and analytical prototype and is not the official e-SAKSHI portal.**
> Official MPLADS information is available through the Government of India e-SAKSHI portal:
> <https://mplads.mospi.gov.in/digigov/dashboard.html>

A working full-stack application: an open MPLADS transparency portal that needs no account, plus a secure,
statistically-grounded anomaly-screening workspace for government officials. It runs locally with real
demonstration data already loaded.

**No build tools required.** PRAMANA contains no native modules — nothing is compiled during
`npm install`, so you do not need Python, Visual Studio Build Tools, Xcode Command Line Tools or
`node-gyp` on any platform.

---

## 1. Requirements

| | |
|---|---|
| **Node.js** | **20.19 or newer** — Node 22 LTS or Node 24 LTS recommended |
| npm | 10 or newer (ships with Node) |
| Database | none to install — SQLite is bundled as WebAssembly |
| Build tools | none |

Check your version with `node -v`. If it is older than 20.19, install a current LTS from
<https://nodejs.org>. The backend prints a clear message and stops if the version is too old, rather
than failing with a confusing stack trace.

---

## 2. Quick start (3 commands)

```bash
npm install          # installs the task runner
npm run setup        # installs backend + frontend dependencies
npm run dev          # starts BOTH servers together
```

Then open **<http://localhost:5173>**

| Portal | URL |
|---|---|
| Public portal | <http://localhost:5173> |
| Administrator portal | <http://localhost:5173/admin/login> |
| API health check | <http://localhost:4000/api/health> |

On first start the backend creates `backend/.env` automatically, seeds two demo accounts, and loads
and analyses the two bundled demonstration datasets (774 records). **The demo credentials are printed
in your terminal.**

### Running the two servers separately

```bash
# Terminal 1 — backend (port 4000)
cd backend && npm install && npm run dev

# Terminal 2 — frontend (port 5173)
cd frontend && npm install && npm run dev
```

### Single-server / production-style run

```bash
npm start            # builds the frontend, then serves UI + API from http://localhost:4000
```

### Other commands

| Command | What it does |
|---|---|
| `npm run reset` | Deletes the local database; the next start re-seeds demo data |
| `npm run build` | Builds the frontend only |
| `npm run typecheck` | Runs TypeScript against the frontend |
| `npm run seed` | Seeds demo accounts and datasets without starting the server |

---

### Datasets and the House lens

PRAMANA seeds two bundled extracts — `lok-sabha-mp-summary.csv` (543 members) and
`rajya-sabha-mp-summary.csv` (231) — whose union is exactly the combined "both Houses" file. Seeding
them separately keeps every total identical while preserving per-House provenance and letting
cross-dataset comparison activate out of the box.

Each row carries allocation, amount recommended, total expenditure, utilisation, works completed,
works recommended, completion rate, unpaid balance and transaction counts. The ingested totals match
the source manifest exactly: ₹11,681.90 Cr allocated, ₹3,995.34 Cr spent, 44,028 works completed and
131,141 recommended across 774 members.

The **House selector** in the main navigation is a portal-wide lens: choosing Lok Sabha or Rajya Sabha
narrows the home page, state table, explorer and comparison tool in one move. The choice persists
across navigation and reloads.

> **Not built: the LS term selector (18th / 17th).** The extract carries no term column, so a
> 18th/17th toggle would have to invent the split. It is left out rather than faked.

### Browse states — fund utilisation

`/states` aggregates every member into their state or union territory: MPs, total allocated, total
expenditure, fund utilisation, works completed and works recommended. It supports a text filter, a
performance band (high ≥80%, medium 50–79%, low <50%), a grid/list toggle and a CSV download of the
exact table on screen.

Utilisation follows the source extract's own definition — amount recommended as a share of allocation
— and the share *actually paid out* is reported separately, because the two answer different
questions. The bar is colour-coded by band, but the percentage is always printed beside it and the
band is named, so nothing depends on colour alone.

### Compare constituencies

`/compare` puts up to four members side by side: constituency, state and House; allocated,
recommended, spent, utilisation and share paid; works recommended, completed, outstanding and
completion rate; plus an overlay bar chart. Selections are mirrored into the URL, so a comparison can
be linked or bookmarked.

> **Party affiliation is not shown** — the MPLADS extract does not contain it, and the page says so
> rather than leaving a blank column.

### Compliance controls

- **Captcha** — an arithmetic challenge issued and verified *on the server*. The answer never reaches
  the browser, challenges are single-use and expire after five minutes, and three wrong answers
  destroy the challenge. It guards administrator sign-in (before any password comparison) and bulk CSV
  export. This is proportionate for a prototype; a production deployment should front it with a
  hardened provider such as Turnstile or hCaptcha.
- **Cookie notice** — a bottom banner listing exactly what is stored: an HTTP-only administrator
  session cookie, and display preferences in local storage. There is no analytics, advertising or
  third-party tracking, and the expandable panel says so rather than implying choices that do not exist.
- **Prototype watermark** — a faint repeating diagonal legend, *PRAMANA STATISTICAL PROTOTYPE — FOR
  DEMO USE ONLY*, across every analytical view and every page of the generated PDF, so a screenshot or
  an extracted page cannot circulate without the words that qualify it. It is unselectable, never a
  hit target, and sits below the content layer.
- **Policy page** — `/policy` (and `/privacy`) covering the data disclaimer, data freshness, privacy
  and terms of use, with the relationship to e-SAKSHI and the Ministry of Statistics stated plainly.

### State map

The home page map plots each state at its geographic centroid, sized by allocation and coloured by
utilisation band. Hovering a state shows its full figures — allocated, spent, utilisation and works
completed — and clicking opens the same panel with a link through to that state's records. MPLADS data contains no coordinates for
individual works, so the map deliberately shows the unit the data *is* about — the state — rather
than scattering members' works across invented pins.

---

## 3. What is in this build

| Feature | Where |
|---|---|
| **Public portal** — home, project explorer, state explorer, comparison, about | `/` |
| **No public account required** — every public page is open; there is no citizen sign-up or sign-in | `/` |
| **Guided official workflow** — dataset → analyse → review findings → investigate → report | admin sidebar |
| **Progressive disclosure** — plain-language signal first, full statistical evidence one click away | `/admin/anomalies` |
| **Administrator password reset** — single-use tokens, 30-minute expiry, all sessions revoked on change | `/forgot-password` |
| **AI provider configuration** — optional phrasing layer (built-in engine is the default); save, replace, upload, test; the key never reaches the browser | `/admin/ai` |
| **12 Indian languages** with on-demand script fonts and RTL support for Urdu | language menu, top right |
| **PRAMANA AI** — conversational, grounded in the loaded records, role-aware, runs entirely on the server with no API key | button, bottom right |
| **Administrator portal** — screening dashboard, anomaly explorer, dataset manager, investigation workspace | `/admin/login` |
| **PDF / CSV / JSON reports** generated from the actual analysis | `/admin/reports` |
| **Audit log and security dashboard** | `/admin/audit`, `/admin/security` |

### Languages

English, हिन्दी, বাংলা, मराठी, తెలుగు, தமிழ், ગુજરાતી, ಕನ್ನಡ, മലയാളം, ਪੰਜਾਬੀ, ଓଡ଼ିଆ and اردو.
Every listed language is genuinely translated — there are no placeholder or machine-mangled entries, and a
missing key falls back to English rather than rendering blank. The script font for a language is fetched only
when that language is selected, non-blocking, so an English reader downloads nothing extra and an offline
machine still renders in the system fallback face.

Translation covers the interface a member of the public reads: navigation, headings, forms, table headers, actions and
footer. Long-form methodology prose and the statistical explanations generated per record stay in English,
because those sentences are computed from live data and translating them mechanically would risk changing
what they assert. Adding a language means adding one entry to `src/i18n/languages.ts` and one dictionary to
`src/i18n/strings.ts`.

### PRAMANA AI

PRAMANA AI is the portal's own data assistant. It answers **only** from the records actually loaded. Before
either engine runs, the server resolves the question against the database: it splits the question on
comparison connectives (`and`, `vs`, `versus`, `against`), filters out question words so "compare the two
members from Bihar" does not match name letters, and scores each of the 774 member rows on name-token
overlap. A match below the two-strong-token confidence threshold is discarded rather than guessed at. The
resolved rows, plus totals, per-state figures, utilisation extremes and classification counts, are the only
facts either engine may use.

**It needs no API key, no provider account and no internet connection.** The built-in engine is the whole
assistant, not a degraded fallback: it understands the question, fetches the figures and writes the reply,
all on this server. Nothing a user types leaves the deployment.

How a question is handled:

1. **Understanding** (`utils/nlu.js`) — the text is normalised, typos are corrected against a fixed
   vocabulary by edit distance (`utilisaton`, `anomolies`, `Karnatka` all resolve), synonyms collapse to one
   canonical form, and the result is scored against ~35 declared intents. Multi-word phrases outrank single
   keywords, so "how are you" is never mistaken for a methodology question.
2. **Entity resolution** — member names are matched against every row with a two-strong-token confidence
   threshold; states are matched with fuzzy and alias handling (`UP`, `Tamilnadu`, `NCR`); the measure
   (allocation, utilisation, expenditure, works, completion), the direction (highest/lowest), the count
   ("top 5") and the House are extracted from the wording.
3. **Retrieval** (`utils/assistantRepo.js`) — the single place the assistant may read the database. Column
   names are whitelisted there, so a question can never steer a query.
4. **Composition** (`utils/answerEngine.js`) — the reply is assembled from the returned figures. Because
   every number is fetched rather than generated, the engine has no mechanism for inventing one.

It is conversational. A short-term memory (30 minutes, in process, keyed by conversation id) carries the last
member, state and measure forward, so `tell me about Bihar` → `and Kerala?` → `why was it flagged?` behave the
way a person means them. Each reply also returns follow-up chips, and links straight through to the matching
screen — `/compare`, `/states`, the anomaly explorer.

It is role-aware. The public panel answers on members, states, rankings, screening results, scheme background
and portal navigation. Signed in as an administrator, the same panel also answers on the review queue ("what
should I review first?"), datasets, reports, the audit trail and security posture. The role is taken from the
verified session cookie, never from the question — asking "as an admin" does not make anyone one.

**Optional model phrasing.** An administrator may connect a provider under Admin → AI Configuration and switch
the answer engine to *model phrasing*. The built-in engine still resolves every figure; the model only rewords
the result, under a system prompt that forbids inventing figures or implying wrongdoing. If the provider is
slow or unreachable the built-in answer is returned instead, so this can never take the assistant down.
Removing the key automatically returns the portal to the built-in engine.

Either way the reply is labelled with the engine that wrote it, lists the rows it resolved, and — for a
comparison — links straight through to the full `/compare` tool. The House lens the reader is browsing under
travels with the question, so an answer under "Rajya Sabha" is computed from those 231 rows alone.

Fields the extract does not carry are reported as absent, never filled in. Party affiliation, project
photographs and work-level coordinates are not in this data, and asking for them says so.

#### Configuring the key

Sign in as an administrator and open **Admin → AI Configuration** (`/admin/ai`). Paste the key (a leading
`Bearer` is stripped for you), or upload a small `.txt`/`.env` file containing it, then press **Test
connection** to make one real call to the provider.

The provider is detected from the key's prefix, and the endpoint and model follow it unless you override
them:

| Key prefix | Provider | Default model | Endpoint |
|---|---|---|---|
| `AIza…` | Google AI Studio | `gemini-2.0-flash` — **free tier** | `https://generativelanguage.googleapis.com/v1beta` |
| `sk-proj-…` | OpenAI | `gpt-4o-mini` | `https://api.openai.com/v1` |
| `nvapi-…` | NVIDIA | `moonshotai/kimi-k2-instruct` | `https://integrate.api.nvidia.com/v1` |
| `sk-…` | Moonshot | `kimi-k2-0905-preview` | `https://api.moonshot.ai/v1` |

The model field becomes a dropdown of that provider's inexpensive models, so a demonstration key cannot be
pointed at an expensive one by accident. This is a deliberate limit rather than a shortcut: the figures are
resolved in SQL before the model runs, so the model only has to phrase facts it was handed, and a larger one
costs more without changing a single number. Free Gemini keys: <https://aistudio.google.com/apikey>.

**No API key ships with this repository.** `backend/.env` is distributed blank; add a key through the admin
screen on the machine you are running on, and never commit one.

How the key is handled:

- Encrypted with AES-256-GCM (key derived from `JWT_SECRET`) before it is written to `app_settings`.
- Never returned to the browser. The settings endpoint reports only *configured / not configured*, the model,
  and a mask ending in the last four characters.
- Kept out of the audit log, application logs and error messages; provider error text is scrubbed of
  anything key-shaped before it is displayed.
- Replacing or removing the key takes effect on the next question, with no restart.

`KIMI_API_KEY` in `backend/.env` still works as a deployment fallback, but a key saved from the admin screen
takes precedence over it.

### Password reset

`/forgot-password` issues a single-use token (SHA-256 hashed at rest, 30-minute expiry). The same response is
returned whether or not the account exists, so the endpoint cannot be used to discover registered addresses,
and requests are rate limited. Completing a reset revokes every existing session for that account.

No mail server is configured, so outside production the reset link is printed to the backend console **and**
returned to the browser so the flow can be completed in one sitting. In production (`NODE_ENV=production`)
the link is never returned in the response — wire up your mail provider at that point.

### Constituency, and fields with no data

Constituency is read from the source file wherever the file carries it. The schema mapper recognises the
spellings these extracts actually use — `Constituency`, `Constituency Name`, `Parliamentary Constituency`,
`PC Name`, `pc_name`, `Seat` — and if the header row is unusual, a per-row recovery pass looks for an
equivalent key in the row itself before giving up. Nothing is ever inferred: a constituency PRAMANA cannot
read from the data is never guessed.

Three outcomes are reported differently, because they mean different things:

| Situation | Shown as |
|---|---|
| The file provides a constituency | The constituency name |
| A Rajya Sabha member | *Rajya Sabha seat* — elected by the State Legislative Assembly, so no constituency exists |
| The file has no constituency column | *Not provided in source data* |

More generally, columns are rendered from a live field-availability check, so the explorer shows the columns
the loaded data actually fills instead of a wall of "not available". The record panel lists only the fields
present and states how many were omitted.

---

## 4. Administrator account

Printed to the terminal on first run, and configurable in `backend/.env`:

| Portal | Route | Email | Password |
|---|---|---|---|
| Administrator | `/admin/login` | `admin@pramana.local` | `ChangeMe#Admin123` |

There is only one kind of account. It comes from environment variables (`SEED_ADMIN_*`), never from
hard-coded values in application source, and is used only once — when the `users` table is empty. Passwords
are stored as bcrypt hashes. **Change them before exposing this to anyone else.**

**The public portal has no accounts.** Home, Projects, States, Domains and About are open to everyone, with
no sign-up, no sign-in and no citizen dashboard — that content is public-transparency material and requiring
an account to read it served no purpose. Every administrative function sits behind `/admin/login` with
server-side RBAC, and the login endpoint refuses any account that is not an administrator.

---

## 5. Troubleshooting

| Symptom | Cause & fix |
|---|---|
| **`npm install` tries to compile something / node-gyp or Python errors** | Should not happen — PRAMANA has no native dependencies. If you see this, you are installing an older copy of the project; use this one. |
| **Blank page / "Cannot reach the PRAMANA backend"** | The backend isn't running. Start it: `cd backend && npm run dev`. The frontend on :5173 proxies `/api` to :4000. |
| **`http://localhost:4000` shows "backend is running" instead of the app** | The frontend hasn't been built. Use the dev server (`npm run dev` → :5173) or run `npm run build` once. |
| **`EADDRINUSE` on start** | Port 4000 is taken. Run `PORT=4100 npm run dev` (Windows: `set PORT=4100 && npm run dev`) and update the proxy target in `frontend/vite.config.ts`. |
| **"PRAMANA requires Node.js 20.19 or newer"** | Install a current Node LTS from nodejs.org. |
| **Login says "Account temporarily locked"** | Five failed attempts lock an account for 15 minutes — by design. Wait, or run `npm run reset`. |
| **`npm run reset` says it can't remove the database** | Stop the backend first (the database file is open), then run it again. |
| **Dates look shifted** | Timestamps are stored and displayed in UTC. |

---

## 6. What to try first

1. **Public portal** (<http://localhost:5173>) — search the project explorer, filter by state or house
   (Lok Sabha / Rajya Sabha), open a record's detail panel, sort the state explorer.
2. **Admin overview** (`/admin/login` → Overview) — the page opens on *what needs your attention* and the
   highest-priority records. KPI tiles sit below, and **Statistical detail** expands to the risk
   distribution (click a bar to filter), cross-dataset relationship status, state totals and method
   contribution — every chart is still there, just not competing with the answer.
3. **Anomaly Explorer** — sort by score, open any flagged record, read the one-line reason and the full
   **"Why was this flagged?"** explanation built from that record's actual computed values, then expand
   **View statistical details** for IQR, Z-score, Modified Z-score and percentiles. Set a review status and
   note; it is written to the audit log.
4. **Upload a dataset** — `Datasets → Choose a CSV or XLSX file`. A ready-made sample is bundled at
   `backend/src/seed/demo-data/sample-upload-projects.xlsx` (180 synthetic project rows with domain,
   financial year and completion status, including three deliberate outliers). Uploading it activates
   the time-trend chart and extends cross-dataset analysis to three datasets.
5. **Switch language** — the menu at the top right. Try हिन्दी or اردو (which flips the layout to
   right-to-left).
6. **Ask PRAMANA AI** — the button at the bottom right. Try “Compare Atul Garg and Mahesh Sharma”, then “Which states have the highest total
   allocation?” or a member's name. It answers from the loaded records, with no API key required.
7. **Download a PDF report** — `/admin/reports` → Download PDF.
8. **Follow the workflow strip** — the numbered band across the top of every admin page marks where you are
   in Dataset → Analyse → Review findings → Investigate → Report.
9. **Open Admin → AI Configuration** — paste an API key, press **Test connection**, then ask the assistant a
   question and watch the answer's source change from the built-in engine to the model.
10. **Audit Log & Security** — every action you just took is recorded.

---

## 7. How the statistical engine works

For each dataset PRAMANA computes descriptive statistics on the allocation column — mean, median,
standard deviation, Q1/Q3, IQR, skewness, MAD, and the 95th/99th percentiles
(`backend/src/utils/stats.js`). Each record is then screened by four independent methods:

| Method | Flag threshold | Extreme |
|---|---|---|
| IQR rule | `amount > Q3 + 1.5 × IQR` | `> Q3 + 3 × IQR` |
| Z-score | `\|Z\| > 3` | `\|Z\| > 4` |
| Modified Z-score | `\|0.6745 × (x − median) / MAD\| > 3.5` | — |
| Percentile | at/above the 95th and 99th percentile | — |

**Degenerate distributions are handled explicitly.** Real MPLADS entitlement data is highly
concentrated — a majority of members can share an identical allocation, which drives the IQR or the MAD
to exactly zero. A naive implementation then flags every above-median record as "extreme". PRAMANA
instead:

- marks a method **not applicable** when its scale estimate is zero (it cannot flag, and is excluded
  from the method count) and says so in the record's explanation;
- falls back to the mean absolute deviation (consistency constant 1.253314) for the Modified Z-score
  when MAD is zero, so the method still works on concentrated data;
- computes an exact percentile rank by binary search over the sorted distribution, using the mid-rank
  convention for ties.

Classification follows method convergence: `0 → Normal`, `1 → Slightly Unusual`, `2 → Unusual`,
`3+ → Highly Unusual`, and an extreme IQR/Z breach corroborated by a second signal (or 3+ methods
agreeing) escalates to **Extreme Statistical Anomaly**. Every flagged record carries a written
explanation built from its own computed values — never a vague "this looks suspicious".

**Statistical anomaly ≠ fraud.** Every screen, report and export carries this disclaimer, and every
signal routes to a human review workflow (Unreviewed → Under Review → Reviewed – No Issue / Escalated)
rather than an automated verdict.

---

## 8. Multi-dataset architecture

Datasets are stored as a collection — there is **no hard-coded limit of two**. Adding a second analysed
dataset automatically activates cross-dataset analysis; a third, fourth or Nth dataset joins the same
pairwise matching with no new code path. Entity resolution
(`backend/src/utils/analysisEngine.js → runCrossDatasetMatching`) tries, in order:

1. exact Project ID match — confidence 1.00
2. normalised MP name + constituency — confidence 0.90
3. fuzzy normalised-name match — 0.75 same state / 0.55 different state

Uncertain matches are never silently merged: each is stored with its confidence and surfaced in the
record drawer ("MATCH" vs "POSSIBLE MATCH" with a percentage). Every dataset pair reports
`CONNECTED`, `PARTIALLY CONNECTED`, or `NO COMPATIBLE RELATIONSHIP FOUND` — and independent statistical
analysis keeps working regardless, which is why the bundled Lok Sabha and Rajya Sabha datasets
correctly report only partial connection (Rajya Sabha members have no constituency).

---

## 9. Uploading your own data

`Datasets → Choose a CSV or XLSX file` runs: **Select → Preview → Schema → Confirm → Analysis**.

PRAMANA previews the file (rows, columns, missing values, duplicate rows) and auto-detects semantic
fields — state, district, constituency, MP/member, project, project ID, domain, amount, financial year,
house, member type, status, agency (`backend/src/utils/schemaMapper.js`). Strong matches show as
**auto-mapped**; weaker ones as **possible field detected**. On confirm the backend cleans currency
symbols and separators, drops "Grand Total" summary rows, runs duplicate detection (row hash +
duplicate project ID), computes statistics, flags anomalies, and re-runs cross-dataset matching.

Fields your file doesn't contain are shown as **"Not available in current dataset"** — never inferred.

Limits: 25 MB, `.csv` and `.xlsx` only, enforced server-side. Legacy `.xls` is rejected with a message
telling you to re-save as `.xlsx`.

---

## 10. Security

- **bcrypt** password hashing (cost 12).
- **HTTP-only, SameSite=Lax session cookies** carrying a signed JWT; `Secure` is set automatically when
  `NODE_ENV=production`. Sessions are tracked server-side so they can be revoked immediately.
- **Account lockout** after 5 failed attempts (15 minutes) plus **rate limiting** on both login routes
  and a global API limiter.
- **Server-side RBAC** (`admin` / `superadmin`) on every route; dataset deletion requires
  `superadmin`. Public users hitting an admin route get `403 — "Administrator access required."`
- **Upload validation**: extension allowlist, 25 MB cap, single file, typed errors — no stack traces.
- **CSV-injection protection**: exported cells starting with `= + - @` are prefixed with `'`.
- **`helmet()`** security headers; parameterised SQL everywhere (no string-built queries).
- **Audit logging** of logins, uploads, deletions, re-analysis, review changes, report generation,
  password changes and session events. Passwords, tokens and OTP values are never logged.
- **No secrets in source** — everything is read from `backend/.env` (git-ignored, generated from
  `.env.example`).
- **`npm audit` reports 0 vulnerabilities** across the backend, frontend and root packages.

**Honest gaps** (reported in the UI rather than faked): MFA/OTP is not implemented — the Security
Dashboard says "Not enabled" instead of showing a fake status. CSRF tokens are not implemented; the API
relies on `SameSite=Lax` cookies plus CORS allowlisting. Add CSRF middleware before any real deployment.

---

## 11. Database

SQLite compiled to **WebAssembly** (`node-sqlite3-wasm`). This is a deliberate engineering choice: the
usual Node SQLite bindings are native addons that must be compiled at install time whenever there is no
prebuilt binary for your Node version, which requires Python and a C++ toolchain and is the single most
common reason a project like this fails to install. The WASM build needs no compiler and behaves
identically on Windows, macOS and Linux across every supported Node version.

`backend/src/db.js` wraps it in a small synchronous adapter (`prepare/run/get/all`, `exec`, `pragma`,
`transaction`) so route code stays plain SQL with bound parameters. The schema is created automatically
on first run — no separate migration step locally. Tables: `users`, `sessions`, `datasets`, `records`,
`anomalies`, `cross_matches`, `audit_log`, `security_events`, `reports`, with indexes on the hot query
paths.

**Moving to PostgreSQL:** swap the driver in `db.js` for `pg`, port the `CREATE TABLE` statements into a
migration tool (node-pg-migrate, Prisma Migrate), and convert the adapter's methods to async client
calls. Because every route goes through that adapter, no route file changes. The statistical modules are
pure functions with no database coupling.

---

## 12. Stack

| Layer | Choice | Version |
|---|---|---|
| Runtime | Node.js | 20.19+ (22/24 LTS recommended) |
| Server | Express | 5.x |
| Database | SQLite (WebAssembly) | node-sqlite3-wasm 0.8 |
| Auth | jsonwebtoken + bcryptjs | 9.x / 3.x |
| Spreadsheets | ExcelJS + csv-parse | 4.x / 7.x |
| Security | helmet, express-rate-limit, multer | 8.x / 8.x / 2.x |
| UI | React | 19.x |
| Build | Vite | 8.x |
| Styling | Tailwind CSS | 4.x |
| Routing | React Router | 7.x |
| Charts | Recharts | 3.x |
| Types | TypeScript | 5.9 |
| PDF | pdfkit | 0.15 |
| AI | Google Gemini (free tier) or Moonshot Kimi — both optional | `:generateContent` / OpenAI-compatible |

Two deliberate version choices: **TypeScript stays on 5.9** (the 7.x native compiler is very new and its
ecosystem type definitions are still settling — 5.9 is the safe, fully-supported line), and
`npm run build` runs `vite build` without a blocking type check, with `npm run typecheck` available
separately. That means a type nit can never stop you from building and demoing.

The previously used `xlsx` package (high-severity advisory, no fix available) was replaced with
ExcelJS, and `multer` moved to 2.x.

---

### Project thumbnails

Records show a square thumbnail wherever the loaded data can fill one.

If the dataset carries an image column — `Image URL`, `Photo`, `Thumbnail` and similar spellings are
detected automatically — the photograph is shown, lazily loaded, with alt text built from that
record's own project name and state. Only `http(s)` URLs are stored, so a stray `javascript:` or
`data:` value in a spreadsheet cannot reach the browser.

When there is no photograph, or one fails to load, the thumbnail falls back to a mark for the
record's own **sector**: roads and infrastructure, education, water and sanitation, healthcare,
sports, power. The mark is drawn from the record's `domain` value — a record whose dataset carries no
domain gets a neutral default rather than a guessed sector, and the label says the dataset has no
photograph rather than claiming any work was built.

The thumbnail column appears in the explorer only when the loaded data has photographs or sectors to
show. The two bundled allocation-limit datasets have neither, so the column stays hidden there;
uploading `backend/src/seed/demo-data/sample-upload-projects.xlsx` (which carries Roads, Education,
Drinking Water, Sanitation, Health and Sports) activates it.

---

### Public portal visual language

The public portal reads as a light civic dashboard: an off-white page (`slate-50`) with white,
softly elevated cards, Plus Jakarta Sans for headings and Inter for interface text. The
administrator workspace keeps its denser, tabular treatment — the two audiences want different
things from the same data.

The dark strip at the very top names the scheme and the ministry that administers **MPLADS**. It
deliberately does **not** claim that this portal is operated by them: PRAMANA is an independent
prototype, and every page says so.

---

## 13. Scope notes

Called out rather than silently omitted:

- **Languages**: 12 languages are translated across the public interface. Long-form methodology
  prose and per-record statistical explanations remain in English by design (see §3).
- **Relationship graph**: real node/edge data is served at `/api/meta/graph`; the frontend does not yet
  render an interactive force-directed view of it.
- **PDF reports**: generated server-side with pdfkit — a laid-out A4 document with the full statistics
  table, method applicability, risk distribution and top flagged records. CSV and JSON exports remain.
- **Scheme artwork**: `frontend/public/mplads-scheme.png` is the MPLADS scheme emblem supplied with the
  project, used only as a faint (≈9% opacity) background watermark behind the "About the MPLADS scheme"
  section. It is decorative, is not a hit target, and the section reads identically if it fails to load.
  Confirm you are entitled to use the asset before any real deployment.
- **State Emblem**: `frontend/public/state-emblem.png` is rendered at its original aspect ratio, never
  stretched or recoloured. Confirm you are using the authorised asset from
  <https://www.presentations.gov.in/logos/national-emblem/> before any real deployment. The PRAMANA mark is
  an original document/verification icon, visually unrelated to the Ashoka Lion Capital.
- **Historical analysis** activates only when a dataset actually has a financial-year column. The two
  bundled allocation-limit datasets do not, so the UI says so; upload the bundled sample XLSX to see
  the time-trend chart populate.

---

## 14. Project structure

```
pramana/
├── package.json              # npm run setup / dev / build / start / reset / typecheck
├── scripts/reset-db.js
├── backend/
│   ├── .env.example
│   └── src/
│       ├── app.js  server.js  db.js  loadEnv.js
│       ├── routes/           # auth, passwordReset, datasets, projects, states, analytics,
│       │                     # anomalies, reviews, reports, audit, security, meta,
│       │                     # assistant, settings (encrypted AI key)
│       ├── middleware/       # auth, RBAC, audit logging
│       ├── utils/            # stats engine, anomaly engine, schema mapper, cleaning,
│       │                     # ingestion, cross-dataset matching, sessions, pdfReport,
│       │                     # dataContext (AI grounding), settings (encrypted at rest)
│       └── seed/             # administrator account + demo datasets + sample upload file
└── frontend/
    └── src/
        ├── pages/public/     # Home, Projects, States, Domains, About,
        │                     # ForgotPassword, ResetPassword
        ├── pages/admin/      # AdminLogin, Dashboard, AnomalyExplorer, Datasets,
        │                     # Investigation, Reports, AuditLog, Security, AiSettings
        ├── components/       # layout, shared UI, drawers, admin components
        ├── i18n/             # languages, translated dictionaries, provider
        ├── context/          # AuthContext
        ├── public/           # state-emblem.png, mplads-scheme.png (watermark)
        └── lib/api.ts
```

---

## 15. Disclaimer

PRAMANA is a prototype built for demonstration and evaluation. It is **not** an official Government of
India product and is not connected to any Government system. Its bundled datasets are sample allocation-limit
statements loaded for demonstration, not official government records. Statistical anomalies surfaced by PRAMANA do
not constitute evidence of wrongdoing and always require human review and verification. For official
MPLADS information use the Government of India e-SAKSHI portal:
<https://mplads.mospi.gov.in/digigov/dashboard.html>
