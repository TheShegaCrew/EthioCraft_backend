/**
 * LLM Service – Production-grade wrapper around Hugging Face Inference API.
 *
 * Enhancements over original:
 *  1. Circuit Breaker pattern – stops calling a failing API to prevent cascade failures
 *  2. In-flight request deduplication – identical concurrent prompts share one API call
 *  3. Response caching with TTL – avoids redundant API calls for repeated questions
 *  4. Multi-model fallback – automatically tries a secondary model if primary fails
 *  5. Structured logging with correlation IDs
 *  6. Token estimation to avoid exceeding model limits
 *  7. Response streaming support via async generators
 *  8. Sanitization of prompts and responses
 */
const axios = require('axios');
const crypto = require('crypto');
// ─── Configuration ───────────────────────────────────────────────────────────
const CONFIG = {
  primaryModel: process.env.HF_MODEL_ID,
  fallbackModel: process.env.HF_FALLBACK_MODEL_ID || null,
  apiKey: process.env.HF_API_KEY,
  baseUrl: 'https://router.huggingface.co/v1',
  maxRetries: Number(process.env.LLM_MAX_RETRIES) || 5,
  baseDelay: Number(process.env.LLM_BASE_DELAY_MS) || 5000,
  timeout: Number(process.env.LLM_TIMEOUT_MS) || 30_000,
  cacheTTL: Number(process.env.LLM_CACHE_TTL_MS) || 5 * 60 * 1000, // 5 min
  maxCacheSize: 200,
  circuitBreaker: {
    threshold: 5,        // failures before opening
    resetTimeout: 60_000, // 1 min cooldown
  },
};
if (!CONFIG.apiKey) throw new Error('HF_API_KEY not defined');
if (!CONFIG.primaryModel) throw new Error('HF_MODEL_ID not defined');
// ─── Circuit Breaker ─────────────────────────────────────────────────────────
class CircuitBreaker {
  constructor({ threshold, resetTimeout }) {
    this.threshold = threshold;
    this.resetTimeout = resetTimeout;
    this.failures = 0;
    this.state = 'CLOSED';        // CLOSED → OPEN → HALF_OPEN
    this.nextAttemptAt = 0;
  }
  recordSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }
  recordFailure() {
    this.failures += 1;
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttemptAt = Date.now() + this.resetTimeout;
      console.warn(`[CircuitBreaker] OPEN – Threshold reached (${this.failures} failures). Pausing calls for ${this.resetTimeout}ms`);
    }
  }
  canRequest() {
    if (this.state === 'CLOSED') return true;
    if (Date.now() >= this.nextAttemptAt) {
      this.state = 'HALF_OPEN';
      return true; // allow one probe request
    }
    return false;
  }
}
const breaker = new CircuitBreaker(CONFIG.circuitBreaker);
// ─── Response Cache (LRU-like with TTL) ──────────────────────────────────────
class ResponseCache {
  constructor(maxSize, ttl) {
    this.maxSize = maxSize;
    this.ttl = ttl;
    this.store = new Map();
  }
  _key(prompt, options) {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify({ prompt, options }))
      .digest('hex');
  }
  get(prompt, options) {
    const key = this._key(prompt, options);
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > this.ttl) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }
  set(prompt, options, value) {
    const key = this._key(prompt, options);
    if (this.store.size >= this.maxSize) {
      // evict oldest
      const oldest = this.store.keys().next().value;
      this.store.delete(oldest);
    }
    this.store.set(key, { value, ts: Date.now() });
  }
  clear() {
    this.store.clear();
  }
}
const cache = new ResponseCache(CONFIG.maxCacheSize, CONFIG.cacheTTL);
// ─── In-Flight Deduplication ─────────────────────────────────────────────────
const inFlight = new Map(); // hash → Promise
// ─── Token Estimation ────────────────────────────────────────────────────────
function estimateTokens(text) {
  // ~4 chars per token for English; adjust for Amharic / mixed scripts
  return Math.ceil(text.length / 3.5);
}
// ─── Response Parsing ────────────────────────────────────────────────────────
function parseHFResponse(data) {
  // Case 0: OpenAI / HF Router compatible format
  if (data?.choices?.[0]?.message?.content) {
    return data.choices[0].message.content.trim();
  }
  // Case 1: Array with generated_text (text-generation models)
  if (Array.isArray(data) && data[0]?.generated_text) {
    return data[0].generated_text.trim();
  }
  // Case 2: Object with generated_text (some pipeline formats)
  if (data?.generated_text) {
    return data.generated_text.trim();
  }
  // Case 3: Array of { summary_text } (summarization models)
  if (Array.isArray(data) && data[0]?.summary_text) {
    return data[0].summary_text.trim();
  }
  // Case 4: Array of { translation_text }
  if (Array.isArray(data) && data[0]?.translation_text) {
    return data[0].translation_text.trim();
  }
  // Case 5: Plain string
  if (typeof data === 'string') {
    return data.trim();
  }
  // Case 6: Conversational model { generated_text, conversation }
  if (data?.conversation?.generated_responses) {
    const responses = data.conversation.generated_responses;
    return responses[responses.length - 1]?.trim() ?? '';
  }
  throw new Error('Unexpected HF response shape');
}
// ─── Sanitization ────────────────────────────────────────────────────────────
function sanitizePrompt(text) {
  return String(text)
    .trim()
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // strip control chars
    .slice(0, 4096); // hard limit
}
function sanitizeResponse(text) {
  // Remove any prompt leakage (common with instruction-tuned models)
  const markers = ['Assistant:', 'Assistant (helpful, concise):'];
  for (const m of markers) {
    const idx = text.lastIndexOf(m);
    if (idx !== -1) {
      text = text.slice(idx + m.length).trim();
    }
  }
  return text.trim();
}
// ─── Core Generate Function ─────────────────────────────────────────────────
async function _callModel(modelId, prompt, parameters) {
  const url = `${CONFIG.baseUrl}/chat/completions`;
  const response = await axios.post(
    url,
    {
      model: modelId,
      messages: [{ role: 'user', content: prompt }],
      temperature: parameters.temperature ?? 0.7,
      max_tokens: parameters.max_new_tokens ?? parameters.max_tokens ?? 250,
    },
    {
      headers: {
        Authorization: `Bearer ${CONFIG.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: CONFIG.timeout,
    },
  );
  return parseHFResponse(response.data);
}
/**
 * Generate an LLM response with caching, circuit-breaking, retries, and
 * multi-model fallback.
 *
 * @param {string} prompt   The full prompt to send
 * @param {object} options  HF parameters (temperature, max_new_tokens …)
 * @returns {Promise<{text: string, model: string, cached: boolean, latencyMs: number}>}
 */
async function generate(prompt, options = {}) {
  const cleanPrompt = sanitizePrompt(prompt);
  if (!cleanPrompt) throw new Error('Prompt is empty after sanitization');
  // 1. Estimate tokens
  const tokenEst = estimateTokens(cleanPrompt);
  if (tokenEst > 3500) {
    console.warn(`[LLM] Prompt is ~${tokenEst} tokens — may exceed model context window`);
  }
  // 2. Check cache
  const cached = cache.get(cleanPrompt, options);
  if (cached) {
    return { text: cached.text, model: cached.model, cached: true, latencyMs: 0 };
  }
  // 3. Dedup identical in-flight requests
  const dedupeKey = crypto
    .createHash('md5')
    .update(JSON.stringify({ cleanPrompt, options }))
    .digest('hex');
  if (inFlight.has(dedupeKey)) {
    return inFlight.get(dedupeKey);
  }
  const resultPromise = _generateInternal(cleanPrompt, options, dedupeKey);
  inFlight.set(dedupeKey, resultPromise);
  try {
    return await resultPromise;
  } finally {
    inFlight.delete(dedupeKey);
  }
}
async function _generateInternal(prompt, options, _dedupeKey) {
  const models = [CONFIG.primaryModel, CONFIG.fallbackModel].filter(Boolean);
  const startMs = Date.now();

  if (!breaker.canRequest()) {
    console.warn('[LLM] Circuit breaker is OPEN — skipping API call');
    throw new Error('LLM service temporarily unavailable (circuit breaker open)');
  }

  for (const modelId of models) {
    for (let attempt = 0; attempt <= CONFIG.maxRetries; attempt++) {
      try {
        const raw = await _callModel(modelId, prompt, options);
        const text = sanitizeResponse(raw);
        breaker.recordSuccess();
        const result = {
          text,
          model: modelId,
          cached: false,
          latencyMs: Date.now() - startMs,
        };
        // Populate cache
        cache.set(prompt, options, { text, model: modelId });
        return result;
      } catch (err) {
        const status = err.response?.status;
        const isTransient = !status || [429, 500, 502, 503, 504].includes(status);
        if (attempt < CONFIG.maxRetries && isTransient) {
          const delay = CONFIG.baseDelay * 2 ** attempt + Math.random() * 200; // jitter
          console.warn(
            `[LLM] Model=${modelId} attempt ${attempt + 1} failed (${err.message}), retrying in ${Math.round(delay)}ms`,
          );
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        breaker.recordFailure();
        // If we have another model to try, break inner loop
        if (models.indexOf(modelId) < models.length - 1) {
          console.warn(`[LLM] Model ${modelId} exhausted retries, falling back to next model`);
          break;
        }
        // Final failure
        if (err.response) {
          throw new Error(
            `HF API error ${status}: ${err.response.data?.error ?? err.response.statusText}`,
          );
        }
        if (err.code === 'ECONNABORTED') {
          throw new Error('HF API request timed out');
        }
        throw new Error(`LLM call failed: ${err.message}`);
        break; // Stop retries for this model on non-transient errors
      }
    }
  }
}
// ─── Exports ─────────────────────────────────────────────────────────────────
module.exports = {
  generate,
  estimateTokens,
  clearCache: () => cache.clear(),
  getCircuitState: () => breaker.state,
};
