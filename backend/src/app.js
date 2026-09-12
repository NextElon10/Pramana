const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { attachUser } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const datasetRoutes = require('./routes/datasets');
const projectRoutes = require('./routes/projects');
const stateRoutes = require('./routes/states');
const analyticsRoutes = require('./routes/analytics');
const anomalyRoutes = require('./routes/anomalies');
const reviewRoutes = require('./routes/reviews');
const reportRoutes = require('./routes/reports');
const auditRoutes = require('./routes/audit');
const securityRoutes = require('./routes/security');
const metaRoutes = require('./routes/meta');
const passwordResetRoutes = require('./routes/passwordReset');
const assistantRoutes = require('./routes/assistant');
const settingsRoutes = require('./routes/settings');
const performanceRoutes = require('./routes/performance');

const app = express();

app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: false, // relaxed for local dev/demo; configure a strict CSP for production deployment
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

const globalLimiter = rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });
app.use('/api', globalLimiter);

app.use(attachUser);

app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'PRAMANA', demo: true }));

app.use('/api/auth', authRoutes);
app.use('/api/datasets', datasetRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/states', stateRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/anomalies', anomalyRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/meta', metaRoutes);
app.use('/api/password', passwordResetRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/admin/settings', settingsRoutes);
app.use('/api/performance', performanceRoutes);

// Unknown API route -> JSON 404 (never fall through to the SPA handler)
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: `No API route matches ${req.method} ${req.originalUrl}` });
});

// Serve the built frontend when it exists (single-server / production mode).
// Express 5 uses path-to-regexp v8, where a bare '*' is no longer a valid path —
// a middleware-style catch-all is the portable way to serve an SPA fallback.
const fs = require('fs');
const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
const indexFile = path.join(frontendDist, 'index.html');

app.use(express.static(frontendDist));
app.use((req, res) => {
  if (fs.existsSync(indexFile)) return res.sendFile(indexFile);
  // The frontend has not been built. Explain exactly what to do instead of a blank 500.
  res.status(200).type('html').send(`<!doctype html>
<html><head><meta charset="utf-8"><title>PRAMANA — backend running</title>
<style>
  body{font-family:"Segoe UI",Arial,sans-serif;background:#f4f6f9;color:#16202e;margin:0;padding:48px 16px;line-height:1.6}
  .box{max-width:640px;margin:0 auto;background:#fff;border:1px solid #e2e6ec;border-radius:6px;padding:32px}
  h1{color:#132038;margin:0 0 4px;font-size:20px}
  code{background:#f2f5f9;border:1px solid #e2e6ec;border-radius:3px;padding:2px 6px;font-size:13px}
  pre{background:#132038;color:#fff;padding:14px 16px;border-radius:4px;overflow-x:auto;font-size:13px}
  .ok{color:#15803d;font-weight:600}
</style></head><body><div class="box">
  <h1>PRAMANA backend is running</h1>
  <p class="ok">API is live at <code>/api/health</code>.</p>
  <p>The frontend has not been built yet, so there is no user interface to serve from this port.</p>
  <p><strong>For development</strong> (two terminals — this is the normal way to run PRAMANA):</p>
  <pre>cd frontend
npm install
npm run dev     →  open http://localhost:5173</pre>
  <p><strong>Or build once and serve everything from this port:</strong></p>
  <pre>cd frontend
npm install
npm run build   →  then reload this page</pre>
  <p style="color:#5b6675;font-size:13px;margin-bottom:0">PRAMANA is a statistical transparency and analytical prototype and is not the official e-SAKSHI portal.</p>
</div></body></html>`);
});

// Central error handler — never leak stack traces.
app.use((err, req, res, next) => {
  if (err && err.message === 'UNSUPPORTED_FILE') {
    return res.status(400).json({ error: 'UNSUPPORTED_FILE', message: 'Only CSV and XLSX files are supported.' });
  }
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'UPLOAD_FAILED', message: 'File exceeds the maximum allowed size (25MB).' });
  }
  console.error(err);
  res.status(500).json({ error: 'SERVER_ERROR', message: 'An unexpected error occurred.' });
});

module.exports = app;
