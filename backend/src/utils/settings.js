/**
 * Server-side settings store.
 *
 * Secrets configured by an administrator (currently the AI provider API key) live
 * here. Three rules govern this file:
 *
 *   1. A secret is encrypted at rest with AES-256-GCM before it touches the database,
 *      so a copy of the SQLite file does not hand over the key.
 *   2. The plaintext is returned only to server-side code that needs to call the
 *      provider. No route ever serialises it, and `describeSecret` is the only shape
 *      that reaches a browser.
 *   3. Nothing here is ever written to a log.
 *
 * The encryption key is derived from JWT_SECRET. If that secret is rotated, stored
 * values become undecryptable — which reads as "not configured", and the administrator
 * simply saves the key again. That is the intended failure mode: never a silent
 * fallback to plaintext.
 */
const crypto = require('crypto');
const db = require('../db');

const ALGORITHM = 'aes-256-gcm';

function encryptionKey() {
  const secret = process.env.JWT_SECRET || 'pramana-development-secret';
  return crypto.createHash('sha256').update(`pramana:settings:${secret}`).digest();
}

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), enc.toString('base64')].join(':');
}

function decrypt(stored) {
  try {
    const [version, iv, tag, payload] = String(stored).split(':');
    if (version !== 'v1' || !iv || !tag || !payload) return null;
    const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(payload, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    // Wrong key, tampered value, or corrupt row — treat as unset rather than throwing.
    return null;
  }
}

function getSetting(key) {
  const row = db.prepare('SELECT value, is_secret FROM app_settings WHERE key = ?').get(key);
  if (!row) return null;
  return row.is_secret ? decrypt(row.value) : row.value;
}

function setSetting(key, value, { secret = false, updatedBy = null } = {}) {
  const stored = secret ? encrypt(value) : String(value);
  db.prepare(`INSERT INTO app_settings (key, value, is_secret, updated_at, updated_by)
              VALUES (?,?,?,CURRENT_TIMESTAMP,?)
              ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                is_secret = excluded.is_secret,
                updated_at = CURRENT_TIMESTAMP,
                updated_by = excluded.updated_by`).run(key, stored, secret ? 1 : 0, updatedBy);
}

function clearSetting(key) {
  db.prepare('DELETE FROM app_settings WHERE key = ?').run(key);
}

function settingMeta(key) {
  return db.prepare('SELECT updated_at, updated_by FROM app_settings WHERE key = ?').get(key) || null;
}

/**
 * The only representation of a secret that may leave the server: a length and the
 * last four characters, so an administrator can tell which key is installed without
 * the value itself ever crossing the wire.
 */
function describeSecret(value) {
  if (!value) return null;
  const tail = value.length > 4 ? value.slice(-4) : '';
  return { masked: `${'•'.repeat(Math.min(Math.max(value.length - 4, 8), 28))}${tail}`, length: value.length };
}

// --- AI provider configuration ---------------------------------------------

const KEY_ENGINE = 'ai.engine';

/**
 * Which engine writes the answer.
 *
 *   'builtin' (the default) — PRAMANA's own data engine, running on this server with
 *   no key, no provider account and no outbound request. Every capability the
 *   assistant has is available in this mode.
 *
 *   'model' — the built-in engine still resolves the figures; a connected provider
 *   only rephrases them. Requires a saved key, and falls back to 'builtin' on any
 *   failure, so selecting it can never make the assistant unavailable.
 */
function getEngineMode() {
  return getSetting(KEY_ENGINE) === 'model' ? 'model' : 'builtin';
}

function setEngineMode(mode, updatedBy = null) {
  const value = mode === 'model' ? 'model' : 'builtin';
  setSetting(KEY_ENGINE, value, { updatedBy });
  return value;
}

const KEY_API = 'ai.kimi.apiKey';
const KEY_BASE = 'ai.kimi.baseUrl';
const KEY_MODEL = 'ai.kimi.model';

/**
 * Which provider issued a key, inferred from its prefix.
 *
 * Google AI Studio keys start with "AIza"; NVIDIA's with "nvapi-"; OpenAI project and
 * service-account keys with "sk-proj-" / "sk-svcacct-"; Moonshot's own keys with a
 * plain "sk-". Detecting this means an administrator pastes a key and the correct
 * endpoint, request shape and default model follow automatically, with no separate
 * provider dropdown to get wrong. A plain "sk-" stays with Moonshot because OpenAI's
 * current keys always carry one of the longer prefixes; either can be overridden from
 * the endpoint and model fields on the admin screen.
 */
function providerForKey(apiKey) {
  const key = String(apiKey || '');
  if (/^AIza/.test(key)) return 'gemini';
  if (/^nvapi-/i.test(key)) return 'nvidia';
  if (/^sk-(proj|svcacct|admin)-/i.test(key)) return 'openai';
  if (key) return 'moonshot';
  return 'none';
}

const PROVIDER_LABELS = {
  gemini: 'Google Gemini',
  openai: 'OpenAI',
  nvidia: 'NVIDIA (Kimi K2)',
  moonshot: 'Moonshot (Kimi)',
  none: 'Not configured',
};

/**
 * Sensible defaults for the endpoint that issued the key.
 *
 * The Gemini default is deliberately a free-tier model: gemini-2.0-flash is served on
 * Google AI Studio's no-cost tier, so a demonstration key does not accrue charges.
 */
function defaultsForKey(apiKey) {
  switch (providerForKey(apiKey)) {
    case 'gemini':
      return {
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        model: 'gemini-2.0-flash',
        transport: 'gemini',
      };
    case 'openai':
      return {
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini',
        transport: 'openai',
      };
    case 'nvidia':
      return {
        baseUrl: 'https://integrate.api.nvidia.com/v1',
        model: 'moonshotai/kimi-k2-instruct',
        transport: 'openai',
      };
    default:
      return {
        baseUrl: 'https://api.moonshot.ai/v1',
        model: 'kimi-k2-0905-preview',
        transport: 'openai',
      };
  }
}

/**
 * Models offered as a dropdown on the admin screen, per provider.
 *
 * Only inexpensive models are listed. PRAMANA AI sends a compact factual context and
 * asks for a few sentences back, so a small model is the right tool: a larger one costs
 * more and adds nothing, because the figures are resolved in SQL before the model runs.
 */
const SUGGESTED_MODELS = {
  gemini: [
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash — free tier, fastest' },
    { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash-Lite — free tier, lowest latency' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash — free tier, stronger reasoning' },
  ],
  openai: [
    { id: 'gpt-4o-mini', label: 'GPT-4o mini — lowest cost, recommended' },
    { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini — low cost, stronger instruction following' },
    { id: 'gpt-4o', label: 'GPT-4o — full size, noticeably more expensive' },
  ],
};

/**
 * Effective AI configuration. A key saved by an administrator takes precedence over
 * one supplied through the environment, so the admin screen is authoritative.
 */
function envKey() {
  // Normalised here too: a key pasted into .env frequently carries a "Bearer " prefix,
  // and an unnormalised prefix would defeat provider detection.
  return normaliseApiKey(
    process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.KIMI_API_KEY || '',
  );
}

function getKimiConfig() {
  const stored = getSetting(KEY_API);
  const apiKey = stored || envKey();
  const source = stored ? 'admin' : (envKey() ? 'environment' : 'none');
  const defaults = defaultsForKey(apiKey);
  const provider = providerForKey(apiKey);
  // A model saved for one provider must not leak into another; if the stored model
  // does not belong to the current key's provider, fall back to that provider's default.
  const storedModel = getSetting(KEY_MODEL) || process.env.GEMINI_MODEL || process.env.KIMI_MODEL || '';
  // A model saved under one provider must not carry over to another.
  const family = (m) => {
    if (/^gemini/i.test(m)) return 'gemini';
    if (/^(gpt|o[134])[-.]?/i.test(m)) return 'openai';
    return 'other';
  };
  const expected = provider === 'gemini' ? 'gemini' : provider === 'openai' ? 'openai' : 'other';
  const modelFitsProvider = family(storedModel) === expected;
  return {
    apiKey,
    provider,
    providerLabel: PROVIDER_LABELS[provider],
    transport: defaults.transport,
    source,
    baseUrl: getSetting(KEY_BASE) || process.env.KIMI_BASE_URL || defaults.baseUrl,
    model: (storedModel && modelFitsProvider) ? storedModel : defaults.model,
    updated: settingMeta(KEY_API),
  };
}

/** Public-safe status for the admin screen. The key itself is never included. */
function getKimiStatus() {
  const cfg = getKimiConfig();
  return {
    configured: Boolean(cfg.apiKey),
    // The built-in engine is always present; a key is never required for the
    // assistant to work, only to change how its answers are worded.
    engine: getEngineMode(),
    builtinAlwaysAvailable: true,
    provider: cfg.provider,
    providerLabel: cfg.providerLabel,
    source: cfg.source,
    baseUrl: cfg.baseUrl,
    model: cfg.model,
    suggestedModels: SUGGESTED_MODELS[cfg.provider] || [],
    key: describeSecret(cfg.apiKey),
    updatedAt: cfg.updated ? cfg.updated.updated_at : null,
    updatedBy: cfg.updated ? cfg.updated.updated_by : null,
    envKeyPresent: Boolean(envKey()),
  };
}

/**
 * Normalises what an administrator pasted. Keys are frequently copied together with
 * the "Bearer " prefix, an "API key:" label, or surrounding quotes — all stripped
 * here so a valid key is not rejected over formatting.
 */
function normaliseApiKey(raw) {
  return String(raw || '')
    .replace(/^\s*(authorization\s*:)?\s*/i, '')
    .replace(/^bearer\s+/i, '')
    .replace(/^["']|["']$/g, '')
    .trim();
}

/** Pulls a key out of an uploaded .env / .txt file without logging the contents. */
function extractKeyFromText(text) {
  const lines = String(text || '').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const named = trimmed.match(/^(?:GEMINI_API_KEY|GOOGLE_API_KEY|GOOGLE_GENAI_API_KEY|OPENAI_API_KEY|KIMI_API_KEY|MOONSHOT_API_KEY|NVIDIA_API_KEY|API_KEY)\s*[=:]\s*(.+)$/i);
    if (named) return normaliseApiKey(named[1]);
  }
  // A file containing nothing but the key itself is also accepted.
  const only = lines.map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  if (only.length === 1) return normaliseApiKey(only[0]);
  return null;
}

module.exports = {
  getSetting,
  setSetting,
  clearSetting,
  getKimiConfig,
  getKimiStatus,
  getEngineMode,
  setEngineMode,
  KEY_ENGINE,
  normaliseApiKey,
  extractKeyFromText,
  defaultsForKey,
  providerForKey,
  SUGGESTED_MODELS,
  KEY_API,
  KEY_BASE,
  KEY_MODEL,
};
