// Deletes the local SQLite database so the next start re-seeds demo accounts and datasets.
// Handles both the database file and the lock directory the WASM SQLite driver creates.
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'backend', 'data');
let removed = 0;

if (fs.existsSync(dataDir)) {
  for (const entry of fs.readdirSync(dataDir)) {
    if (!entry.startsWith('pramana.sqlite')) continue;
    const target = path.join(dataDir, entry);
    try {
      fs.rmSync(target, { recursive: true, force: true });
      removed++;
    } catch (err) {
      console.error(`Could not remove ${entry}: ${err.message}`);
      console.error('Stop the backend first, then run this again.');
      process.exit(1);
    }
  }
}

console.log(removed
  ? `PRAMANA: removed ${removed} database file(s). Start the backend to re-seed demo data.`
  : 'PRAMANA: no database file found — nothing to reset.');
