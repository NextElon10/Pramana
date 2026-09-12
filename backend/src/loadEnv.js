const fs = require('fs');
const path = require('path');

// Single place where configuration is loaded.
// On first run this creates backend/.env from .env.example so the application
// starts with documented defaults rather than failing silently.
// `quiet: true` suppresses dotenv's startup banner.
const envPath = path.join(__dirname, '..', '.env');
const examplePath = path.join(__dirname, '..', '.env.example');

let created = false;
if (!fs.existsSync(envPath) && fs.existsSync(examplePath)) {
  try {
    fs.copyFileSync(examplePath, envPath);
    created = true;
  } catch { /* non-fatal: defaults still apply */ }
}

require('dotenv').config({ path: envPath, quiet: true });

module.exports = { envPath, created };
