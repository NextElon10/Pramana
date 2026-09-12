const { created: createdEnv } = require('./loadEnv');
if (createdEnv) {
  console.log('PRAMANA: created backend/.env from .env.example (edit it to change secrets and demo credentials).');
}

// Preflight: PRAMANA supports Node 20.19+ and every release after it, including
// the current Node LTS. No native modules are compiled, so no build tools are
// required on any platform.
const [major, minor] = process.versions.node.split('.').map((n) => parseInt(n, 10));
const supported = major > 20 || (major === 20 && minor >= 19);
if (!supported) {
  console.error(`\n  PRAMANA requires Node.js 20.19 or newer — you are running Node ${process.versions.node}.`);
  console.error('  Node 22 LTS or Node 24 LTS is recommended: https://nodejs.org\n');
  process.exit(1);
}

const app = require('./app');
const { ensureSeeded } = require('./seed/seed');

const PORT = parseInt(process.env.PORT || '4000', 10);

ensureSeeded().catch((err) => {
  console.error('PRAMANA: seeding failed —', err.message);
  console.error('The server is still running, but demo data may be missing.');
});

const server = app.listen(PORT, () => {
  console.log('');
  console.log('  PRAMANA backend running');
  console.log(`  API      : http://localhost:${PORT}/api/health`);
  console.log(`  Frontend : run "npm run dev" inside the frontend folder, then open http://localhost:5173`);
  console.log('');
  console.log('  PRAMANA is a statistical transparency and analytical prototype');
  console.log('  and is not the official e-SAKSHI portal.');
  console.log('');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nPort ${PORT} is already in use.`);
    console.error('Either stop the process using it, or start PRAMANA on another port:');
    console.error(`  PORT=4100 npm run dev          (macOS / Linux)`);
    console.error(`  set PORT=4100 && npm run dev   (Windows cmd)`);
    console.error('If you change the port, update the proxy target in frontend/vite.config.ts to match.\n');
    process.exit(1);
  }
  console.error('PRAMANA failed to start:', err.message);
  process.exit(1);
});

process.on('SIGINT', () => { server.close(() => process.exit(0)); });
process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
