/**
 * Administrator settings — the PRAMANA AI provider configuration (Gemini, Kimi).
 *
 * Every route here requires an administrator session. The API key travels one way
 * only: the browser can send a new key, and can ask whether one is installed, but no
 * response on this router ever contains the key, and the key is never logged. The
 * audit trail records that the key changed, not what it changed to.
 */
const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { requireRole, logAudit } = require('../middleware/auth');
const {
  setSetting, clearSetting, getKimiConfig, getKimiStatus, setEngineMode,
  normaliseApiKey, extractKeyFromText, defaultsForKey, providerForKey,
  KEY_API, KEY_BASE, KEY_MODEL,
} = require('../utils/settings');
const { callModel } = require('../utils/aiClient');

const router = express.Router();
const admin = requireRole('admin', 'superadmin');

// A key file is a few dozen bytes; the cap exists so this cannot be used as an upload
// channel for anything else.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024, files: 1 } });

const testLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_ATTEMPTS', message: 'Too many connection tests. Please wait a moment.' },
});

/** GET /api/admin/settings/ai — status only, never the key. */
router.get('/ai', admin, (req, res) => {
  res.json(getKimiStatus());
});

function saveKey(req, res, apiKey) {
  const key = normaliseApiKey(apiKey);
  if (key.length < 12) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: 'That does not look like an API key. Paste the full key issued by your AI provider.',
    });
  }

  const defaults = defaultsForKey(key);
  const baseUrl = String(req.body?.baseUrl || '').trim();
  const model = String(req.body?.model || '').trim();

  if (baseUrl && !/^https:\/\//i.test(baseUrl)) {
    return res.status(400).json({ error: 'INVALID_INPUT', message: 'The API base URL must start with https://' });
  }

  setSetting(KEY_API, key, { secret: true, updatedBy: req.user.email });
  setSetting(KEY_BASE, baseUrl || defaults.baseUrl, { updatedBy: req.user.email });
  setSetting(KEY_MODEL, model || defaults.model, { updatedBy: req.user.email });

  // Deliberately records only that the key changed and how it ends.
  logAudit('AI_KEY_UPDATED', req, {
    provider: providerForKey(key), keyEndsWith: key.slice(-4), model: model || defaults.model,
  });

  res.json({ message: 'API key saved. It is stored encrypted on the server and is never sent to the browser.', ...getKimiStatus() });
}

/**
 * PUT /api/admin/settings/ai/engine — choose which engine writes the answers.
 *
 * 'builtin' needs nothing at all. 'model' is refused unless a key is stored, so the
 * assistant can never be switched into a mode it cannot serve.
 */
router.put('/ai/engine', admin, (req, res) => {
  const requested = String(req.body?.engine || '').toLowerCase();
  if (!['builtin', 'model'].includes(requested)) {
    return res.status(400).json({ error: 'INVALID_INPUT', message: 'Engine must be either "builtin" or "model".' });
  }
  if (requested === 'model' && !getKimiConfig().apiKey) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: 'Save an API key before switching answer phrasing to a model. The built-in engine remains fully functional either way.',
    });
  }

  const engine = setEngineMode(requested, req.user.email);
  logAudit('AI_ENGINE_CHANGED', req, { engine });
  return res.json({
    message: engine === 'builtin'
      ? 'PRAMANA AI now answers entirely from the built-in engine on this server. No external service is contacted.'
      : 'Answers will be resolved by the built-in engine and rephrased by the connected model. Figures still come from the database.',
    ...getKimiStatus(),
  });
});

/** PUT /api/admin/settings/ai — save or replace the key. */
router.put('/ai', admin, (req, res) => saveKey(req, res, req.body?.apiKey));

/** POST /api/admin/settings/ai/upload — same, from a small .env/.txt file. */
router.post('/ai/upload', admin, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const tooBig = err.code === 'LIMIT_FILE_SIZE';
      return res.status(400).json({
        error: 'UPLOAD_FAILED',
        message: tooBig ? 'That file is larger than 8 KB — an API key file should be a single line.' : 'The file could not be read.',
      });
    }
    if (!req.file) return res.status(400).json({ error: 'INVALID_INPUT', message: 'Choose a .txt or .env file containing the key.' });

    const key = extractKeyFromText(req.file.buffer.toString('utf8'));
    if (!key) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'No API key was found in that file. It should contain a single key, or a line such as GEMINI_API_KEY=…',
      });
    }
    return saveKey(req, res, key);
  });
});

/** DELETE /api/admin/settings/ai — remove the stored key. */
router.delete('/ai', admin, (req, res) => {
  clearSetting(KEY_API);
  clearSetting(KEY_BASE);
  clearSetting(KEY_MODEL);
  // Removing the key must also drop out of model phrasing, or the assistant would be
  // pointed at a provider it can no longer reach.
  setEngineMode('builtin', req.user.email);
  logAudit('AI_KEY_REMOVED', req, { provider: 'any' });
  res.json({
    message: 'The stored API key has been removed. The assistant continues to answer from the built-in data engine.',
    ...getKimiStatus(),
  });
});

/**
 * POST /api/admin/settings/ai/test — one minimal live call to the provider.
 * Failures are reported as a category and the provider's status code. The key never
 * appears in a response, and provider error text is truncated and stripped of
 * anything key-shaped before it is shown.
 */
router.post('/ai/test', admin, testLimiter, async (req, res) => {
  const cfg = getKimiConfig();
  if (!cfg.apiKey) {
    return res.status(400).json({ ok: false, message: 'No API key is configured yet. Save a key first.' });
  }

  try {
    const { text, model } = await callModel(cfg, {
      system: 'You are a connection test. Reply with the single word: ready',
      user: 'Reply with the single word: ready',
      maxTokens: 16,
      temperature: 0,
    });
    logAudit('AI_CONNECTION_TEST', req, { result: 'ok', provider: cfg.provider, model: cfg.model });
    return res.json({
      ok: true,
      message: `${cfg.providerLabel} connection successful. PRAMANA AI will now answer through ${cfg.model}.`,
      model,
      sample: text.slice(0, 60),
    });
  } catch (err) {
    logAudit('AI_CONNECTION_TEST', req, { result: 'failed', provider: cfg.provider, status: err.status || 0 });
    return res.json({
      ok: false,
      status: err.status || null,
      message: err.message,
      detail: err.detail || null,
    });
  }
});

module.exports = router;
