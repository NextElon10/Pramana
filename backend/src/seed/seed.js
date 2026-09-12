const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { ingestDataset } = require('../utils/ingest');

const DEMO_DIR = path.join(__dirname, 'demo-data');

/**
 * Two datasets rather than the combined file: the union of the two is exactly the
 * "both Houses" extract, so seeding them separately keeps every total identical while
 * preserving per-House provenance and letting cross-dataset comparison activate.
 */
const DEMO_FILES = [
  {
    file: 'rajya-sabha-mp-summary.csv',
    name: 'Rajya Sabha — MP allocation and works summary',
    house: 'Rajya Sabha',
  },
  {
    file: 'lok-sabha-mp-summary.csv',
    name: 'Lok Sabha — MP allocation and works summary',
    house: 'Lok Sabha',
  },
];

function seedUsers() {
  if (db.prepare('SELECT COUNT(*) c FROM users').get().c > 0) return;

  const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@pramana.local').toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe#Admin123';
  db.prepare('INSERT INTO users (email, password_hash, role, name) VALUES (?,?,?,?)')
    .run(adminEmail, bcrypt.hashSync(adminPassword, 12), 'superadmin', 'PRAMANA Administrator');

  console.log('');
  console.log('  ── PRAMANA administrator account (from environment variables — change before deployment) ──');
  console.log(`     Administrator  /admin/login   ${adminEmail}   ${adminPassword}`);
  console.log('     The public portal needs no account — every public page is open.');
  console.log('  ────────────────────────────────────────────────────────────────────────────────────────');
}

async function seedDatasets() {
  if (db.prepare('SELECT COUNT(*) c FROM datasets').get().c > 0) return;
  if (!fs.existsSync(DEMO_DIR)) return;

  for (const demo of DEMO_FILES) {
    const full = path.join(DEMO_DIR, demo.file);
    if (!fs.existsSync(full)) continue;
    try {
      await ingestDataset({
        buffer: fs.readFileSync(full),
        filename: demo.file,
        name: demo.name,
        source: 'MPLADS MP summary extract bundled with this prototype',
        house: demo.house,
        isDemo: true,
      });
    } catch (e) {
      console.error(`PRAMANA: could not load demo dataset ${demo.file} — ${e.message}`);
    }
  }
  const count = db.prepare('SELECT COUNT(*) c FROM records').get().c;
  if (count) console.log(`  PRAMANA: demo datasets loaded and analysed (${count} records).`);
}

async function ensureSeeded() {
  seedUsers();
  await seedDatasets();
}

module.exports = { ensureSeeded };

if (require.main === module) {
  require('../loadEnv');
  ensureSeeded()
    .then(() => console.log('Seed complete.'))
    .catch((e) => { console.error('Seed failed:', e.message); process.exit(1); });
}
