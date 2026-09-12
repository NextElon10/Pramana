/**
 * One-shot helper to install an AI provider key without opening the admin screen —
 * useful for a scripted setup or a kiosk demo machine.
 *
 * The key is read from the environment or the command line and is NEVER written into
 * this file: a key committed to source is a key that leaks the moment the project is
 * shared. The normal route remains Admin -> AI Configuration.
 *
 *   KIMI_API_KEY=your-key node backend/inject-key.js
 *   node backend/inject-key.js your-key
 */
require('./src/loadEnv');
const { setSetting, normaliseApiKey, defaultsForKey, KEY_API, KEY_BASE, KEY_MODEL } = require('./src/utils/settings');

const raw = process.argv[2] || process.env.KIMI_API_KEY || '';
const apiKey = normaliseApiKey(raw);

if (!apiKey || apiKey.length < 12) {
  console.error('No API key supplied.');
  console.error('Usage:  KIMI_API_KEY=your-key node backend/inject-key.js');
  console.error('   or:  node backend/inject-key.js your-key');
  process.exit(1);
}

const defaults = defaultsForKey(apiKey);
setSetting(KEY_API, apiKey, { secret: true, updatedBy: 'inject-key script' });
setSetting(KEY_BASE, process.env.KIMI_BASE_URL || defaults.baseUrl, { updatedBy: 'inject-key script' });
setSetting(KEY_MODEL, process.env.KIMI_MODEL || defaults.model, { updatedBy: 'inject-key script' });

// Only the tail is echoed, so a terminal scrollback or CI log never carries the key.
console.log(`Stored an API key ending ...${apiKey.slice(-4)} (encrypted at rest).`);
console.log(`Endpoint: ${process.env.KIMI_BASE_URL || defaults.baseUrl}`);
console.log(`Model:    ${process.env.KIMI_MODEL || defaults.model}`);
