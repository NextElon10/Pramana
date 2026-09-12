const path = require('path');
const fs = require('fs');
const { Database } = require('node-sqlite3-wasm');

// ---------------------------------------------------------------------------
// PRAMANA uses SQLite compiled to WebAssembly (node-sqlite3-wasm) rather than a
// native addon. This is a deliberate choice: a native SQLite binding has to be
// compiled at install time on any Node version without a matching prebuilt
// binary, which requires Python and a C++ toolchain and is the single most
// common reason a project like this "won't install". The WASM build needs no
// compiler, no Python and no build tools, and behaves identically on Windows,
// macOS and Linux across every supported Node version.
//
// The adapter below exposes the small, synchronous API surface the rest of the
// application uses (prepare/run/get/all, exec, pragma, transaction) so route
// code stays plain and database-agnostic.
// ---------------------------------------------------------------------------

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const configured = process.env.DATABASE_PATH;
const DB_PATH = configured
  ? (path.isAbsolute(configured) ? configured : path.join(__dirname, '..', configured))
  : path.join(DATA_DIR, 'pramana.sqlite');

const raw = new Database(DB_PATH);

/**
 * Bound parameters are accepted in the shapes better-sqlite3 allows:
 *   stmt.run({ state: 'Kerala' })      → named, keys normalised to @state
 *   stmt.run(['Kerala'])               → positional array
 *   stmt.run('Kerala', 12)             → positional varargs
 */
function normalizeParams(args) {
  if (args.length === 0) return undefined;

  if (args.length === 1 && args[0] !== null && typeof args[0] === 'object' && !Array.isArray(args[0])) {
    const out = {};
    for (const [key, value] of Object.entries(args[0])) {
      const bindKey = /^[@:$]/.test(key) ? key : `@${key}`;
      out[bindKey] = value === undefined ? null : value;
    }
    return out;
  }

  const flat = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
  return flat.map((v) => (v === undefined ? null : v));
}

// Prepared statements are cached by SQL text (as better-sqlite3 does internally),
// so repeated queries do not re-compile and WASM statement handles are not leaked.
const statementCache = new Map();

function getStatement(sql) {
  let stmt = statementCache.get(sql);
  if (!stmt) {
    stmt = raw.prepare(sql);
    statementCache.set(sql, stmt);
  }
  return stmt;
}

function prepare(sql) {
  return {
    run: (...args) => getStatement(sql).run(normalizeParams(args)),
    get: (...args) => getStatement(sql).get(normalizeParams(args)),
    all: (...args) => getStatement(sql).all(normalizeParams(args)),
  };
}

function exec(sql) {
  return raw.exec(sql);
}

function pragma(statement) {
  return raw.exec(`PRAGMA ${statement};`);
}

/**
 * Wraps a function in a real SQLite transaction. Nested calls reuse the outer
 * transaction, matching better-sqlite3's behaviour closely enough for our use.
 */
let transactionDepth = 0;
function transaction(fn) {
  return (...args) => {
    if (transactionDepth > 0) return fn(...args);
    transactionDepth++;
    raw.exec('BEGIN');
    try {
      const result = fn(...args);
      raw.exec('COMMIT');
      return result;
    } catch (err) {
      try { raw.exec('ROLLBACK'); } catch { /* rollback is best-effort */ }
      throw err;
    } finally {
      transactionDepth--;
    }
  };
}

function close() {
  for (const stmt of statementCache.values()) {
    try { stmt.finalize(); } catch { /* ignore */ }
  }
  statementCache.clear();
  raw.close();
}

const db = { prepare, exec, pragma, transaction, close, path: DB_PATH };

// SQLite tuning. WAL is not used because the WASM build runs single-process and
// journal files would only add moving parts to a local demo deployment.
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','superadmin')),
  name TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_login_at TEXT,
  failed_attempts INTEGER DEFAULT 0,
  locked_until TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  user_agent TEXT,
  revoked INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS datasets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  filename TEXT,
  source TEXT,
  house TEXT,
  uploaded_by INTEGER REFERENCES users(id),
  uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
  row_count INTEGER DEFAULT 0,
  column_count INTEGER DEFAULT 0,
  columns_json TEXT,
  schema_map_json TEXT,
  status TEXT DEFAULT 'uploaded',
  is_demo INTEGER DEFAULT 0,
  stats_json TEXT,
  analyzed_at TEXT
);

CREATE TABLE IF NOT EXISTS records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  row_index INTEGER,
  raw_json TEXT NOT NULL,
  state TEXT,
  district TEXT,
  constituency TEXT,
  mp_name TEXT,
  project_id TEXT,
  project_name TEXT,
  domain TEXT,
  amount REAL,
  financial_year TEXT,
  house TEXT,
  member_type TEXT,
  status TEXT,
  image_url TEXT,
  -- Performance fields, populated only when the source dataset carries them.
  expenditure REAL,
  recommended_amount REAL,
  utilization REAL,
  works_completed INTEGER,
  works_recommended INTEGER,
  completion_rate REAL,
  balance_unpaid REAL,
  transactions INTEGER,
  is_duplicate INTEGER DEFAULT 0,
  duplicate_of INTEGER
);
CREATE INDEX IF NOT EXISTS idx_records_dataset ON records(dataset_id);
CREATE INDEX IF NOT EXISTS idx_records_state ON records(state);
CREATE INDEX IF NOT EXISTS idx_records_mp ON records(mp_name);
CREATE INDEX IF NOT EXISTS idx_records_amount ON records(amount);
CREATE INDEX IF NOT EXISTS idx_records_domain ON records(domain);

CREATE TABLE IF NOT EXISTS anomalies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_id INTEGER NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  iqr_flag INTEGER DEFAULT 0,
  iqr_extreme INTEGER DEFAULT 0,
  z_flag INTEGER DEFAULT 0,
  z_extreme INTEGER DEFAULT 0,
  modz_flag INTEGER DEFAULT 0,
  pct95_flag INTEGER DEFAULT 0,
  pct99_flag INTEGER DEFAULT 0,
  cross_dataset_flag INTEGER DEFAULT 0,
  method_count INTEGER DEFAULT 0,
  anomaly_score INTEGER DEFAULT 0,
  classification TEXT,
  z_score REAL,
  mod_z_score REAL,
  percentile_rank REAL,
  explanation TEXT,
  review_status TEXT DEFAULT 'Unreviewed',
  reviewer TEXT,
  review_notes TEXT,
  reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_anomalies_record ON anomalies(record_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_dataset ON anomalies(dataset_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_class ON anomalies(classification);
CREATE INDEX IF NOT EXISTS idx_anomalies_review ON anomalies(review_status);

CREATE TABLE IF NOT EXISTS cross_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dataset_a INTEGER NOT NULL,
  dataset_b INTEGER NOT NULL,
  record_a INTEGER NOT NULL,
  record_b INTEGER NOT NULL,
  match_type TEXT,
  confidence REAL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cross_records ON cross_matches(record_a, record_b);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT DEFAULT CURRENT_TIMESTAMP,
  actor_email TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  dataset_id INTEGER,
  metadata_json TEXT,
  ip TEXT
);

CREATE TABLE IF NOT EXISTS security_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT DEFAULT CURRENT_TIMESTAMP,
  event_type TEXT NOT NULL,
  email TEXT,
  ip TEXT,
  detail TEXT
);

CREATE TABLE IF NOT EXISTS password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  used_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_resets_user ON password_resets(user_id);

-- Server-side application settings. Secret values (such as the AI provider API key)
-- are stored encrypted and are never returned to any client — see utils/settings.js.
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  is_secret INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dataset_id INTEGER REFERENCES datasets(id) ON DELETE CASCADE,
  generated_by INTEGER REFERENCES users(id),
  generated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  format TEXT,
  content_json TEXT
);
`);

process.on('exit', () => { try { close(); } catch { /* ignore */ } });

module.exports = db;
