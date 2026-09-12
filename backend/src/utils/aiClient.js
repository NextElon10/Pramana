/**
 * One call site for every AI provider PRAMANA can talk to.
 *
 * Two wire formats are supported. Moonshot and NVIDIA both speak the OpenAI chat
 * shape, so they share a transport. Google Gemini uses its own `:generateContent`
 * endpoint with the system prompt carried in `systemInstruction` — a different body,
 * a different reply shape, and the key passed as a header rather than a bearer token.
 *
 * Nothing in this module logs, returns or embeds the API key. `sanitise()` strips
 * anything key-shaped out of provider error text before it can reach a browser.
 */

const TIMEOUT_MS = 30000;

/** Removes anything that looks like a credential from provider error text. */
function sanitise(text) {
  return String(text || '')
    .replace(/(nvapi-|sk-|AIza)[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(/key=[A-Za-z0-9_-]+/gi, 'key=[redacted]');
}

function classify(status, raw, cfg) {
  const label = cfg.providerLabel || 'The AI provider';
  // A 403 can come from the provider (bad key) or from a network policy in front of
  // this server. Say which, rather than blaming a key the administrator cannot fix.
  if (/allowlist|egress|proxy|forbidden by policy|blocked/i.test(raw)) {
    return `The request never reached ${label} — a network policy on this server blocked it. Allow outbound HTTPS to the API host.`;
  }
  if (status === 401 || status === 403) return `${label} rejected the key. Check that it is correct and still active.`;
  if (status === 404) return `The endpoint or model was not found. Check the base URL and model name (currently "${cfg.model}").`;
  if (status === 429) return `${label} is rate-limiting this key. Free-tier quotas are per-minute — wait a moment and retry.`;
  return `${label} connection failed (HTTP ${status}).`;
}

async function post(url, headers, body, signal) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal,
  });
}

/**
 * Sends one prompt and returns the model's text.
 * Throws an Error carrying `status`, `message` (human-readable) and sanitised `detail`.
 */
async function callModel(cfg, { system, user, maxTokens = 700, temperature = 0.2 }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    let response;
    if (cfg.transport === 'gemini') {
      // The key goes in a header, never in the URL, so it cannot end up in a proxy log.
      response = await post(
        `${cfg.baseUrl}/models/${encodeURIComponent(cfg.model)}:generateContent`,
        { 'x-goog-api-key': cfg.apiKey },
        {
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { temperature, maxOutputTokens: maxTokens, topP: 0.8 },
        },
        controller.signal,
      );
    } else {
      // OpenAI's reasoning-era models renamed the token ceiling and accept only the
      // default temperature; sending the older fields to them is a hard 400. Everything
      // else — GPT-4o/4.1, Kimi on Moonshot or NVIDIA — takes the classic pair.
      const reasoningEra = /^(gpt-5|o[134])\b/i.test(cfg.model || '');
      const body = {
        model: cfg.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      };
      if (reasoningEra) {
        body.max_completion_tokens = maxTokens;
      } else {
        body.max_tokens = maxTokens;
        body.temperature = temperature;
      }
      response = await post(
        `${cfg.baseUrl}/chat/completions`,
        { Authorization: `Bearer ${cfg.apiKey}` },
        body,
        controller.signal,
      );
    }

    if (!response.ok) {
      const raw = await response.text().catch(() => '');
      const err = new Error(classify(response.status, raw, cfg));
      err.status = response.status;
      err.detail = sanitise(raw).slice(0, 240);
      throw err;
    }

    const data = await response.json();
    const text = cfg.transport === 'gemini'
      ? (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim()
      : String(data?.choices?.[0]?.message?.content || '').trim();

    if (!text) {
      // Gemini returns an empty candidate with a finishReason when a safety filter or
      // the token ceiling stops generation; surfacing that beats an empty bubble.
      const reason = data?.candidates?.[0]?.finishReason
        || data?.promptFeedback?.blockReason
        || data?.choices?.[0]?.finish_reason;
      const err = new Error(reason ? `The model returned no text (${reason}).` : 'The model returned no text.');
      err.status = 200;
      throw err;
    }

    return { text, model: data?.model || data?.modelVersion || cfg.model };
  } catch (err) {
    if (err.name === 'AbortError') {
      const timeoutErr = new Error(`${cfg.providerLabel || 'The AI provider'} did not respond within 30 seconds.`);
      timeoutErr.status = 504;
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { callModel, sanitise };
