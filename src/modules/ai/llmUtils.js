/**
 * llmUtils.js – Production-grade multi-provider LLM wrapper.
 *
 * Provider strategy:
 *   Tier 1 (Primary)  : Google Gemini   via @google/generative-ai SDK
 *   Tier 2 (Fallback) : Hugging Face    via HF Router REST API (existing logic)
 *
 * Shared infrastructure (both providers):
 *   - Per-provider circuit breakers  (CLOSED → OPEN → HALF_OPEN)
 *   - Response cache with TTL        (LRU-like, shared hash key)
 *   - In-flight request dedup        (identical concurrent prompts share one call)
 *   - Exponential back-off + jitter  retries on transient failures
 *   - Token estimation               for context-window budget tracking
 *   - Prompt & response sanitization
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const crypto = require('crypto');
const dns = require('dns');

// Force IPv4 first to prevent 'fetch failed' and 'ENOTFOUND' errors on Windows/Node.js
dns.setDefaultResultOrder('ipv4first');

// ─── Configuration ────────────────────────────────────────────────────────────
const CONFIG = {
  // Gemini
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',

  // Hugging Face
  hfApiKey: process.env.HF_API_KEY || '',
  hfPrimaryModel: process.env.HF_MODEL_ID || '',
  hfFallbackModel: process.env.HF_FALLBACK_MODEL_ID || '',
  hfBaseUrl: 'https://router.huggingface.co/v1',

  // Retry / timeout
  maxRetries: Number(process.env.LLM_MAX_RETRIES) || 3,
  baseDelay: Number(process.env.LLM_BASE_DELAY_MS) || 2000,
  timeout: Number(process.env.LLM_TIMEOUT_MS) || 30_000,

  // Cache
  cacheTTL: Number(process.env.LLM_CACHE_TTL_MS) || 5 * 60 * 1000, // 5 min
  maxCacheSize: 200,

  // Circuit breaker
  cbThreshold: 5,
  cbResetTimeout: 60_000, // 1 min
};

// ─── Circuit Breaker ──────────────────────────────────────────────────────────
class CircuitBreaker {
  constructor(name, threshold, resetTimeout) {
    this.name = name;
    this.threshold = threshold;
    this.resetTimeout = resetTimeout;
    this.failures = 0;
    this.state = 'CLOSED'; // CLOSED | OPEN | HALF_OPEN
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
      console.warn(
        `[CircuitBreaker:${this.name}] OPEN after ${this.failures} failures. Cooldown: ${this.resetTimeout}ms`
      );
    }
  }

  canRequest() {
    if (this.state === 'CLOSED') return true;
    if (Date.now() >= this.nextAttemptAt) {
      this.state = 'HALF_OPEN';
      return true; // one probe request
    }
    return false;
  }

  getState() {
    return this.state;
  }
}

const geminiBreaker = new CircuitBreaker('Gemini', CONFIG.cbThreshold, CONFIG.cbResetTimeout);
const hfBreaker = new CircuitBreaker('HuggingFace', CONFIG.cbThreshold, CONFIG.cbResetTimeout);

// ─── Response Cache (LRU-like with TTL) ───────────────────────────────────────
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
    if (this.store.size >= this.maxSize) {
      const oldest = this.store.keys().next().value;
      this.store.delete(oldest);
    }
    const key = this._key(prompt, options);
    this.store.set(key, { value, ts: Date.now() });
  }

  clear() {
    this.store.clear();
  }
}

const cache = new ResponseCache(CONFIG.maxCacheSize, CONFIG.cacheTTL);

// ─── In-Flight Deduplication ──────────────────────────────────────────────────
const inFlight = new Map();

// ─── Token Estimation ─────────────────────────────────────────────────────────
function estimateTokens(text) {
  return Math.ceil(text.length / 3.5);
}

// ─── Sanitization ─────────────────────────────────────────────────────────────
function sanitizePrompt(text) {
  return String(text)
    .trim()
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .slice(0, 8000); // expanded for Gemini's large context window
}

function sanitizeResponse(text) {
  const markers = ['Assistant:', 'Assistant (helpful, concise):'];
  for (const m of markers) {
    const idx = text.lastIndexOf(m);
    if (idx !== -1) text = text.slice(idx + m.length).trim();
  }
  return text.trim();
}

// ─── HF Response Parser ───────────────────────────────────────────────────────
function parseHFResponse(data) {
  if (data?.choices?.[0]?.message?.content)
    return data.choices[0].message.content.trim();
  if (Array.isArray(data) && data[0]?.generated_text)
    return data[0].generated_text.trim();
  if (data?.generated_text) return data.generated_text.trim();
  if (Array.isArray(data) && data[0]?.summary_text)
    return data[0].summary_text.trim();
  if (typeof data === 'string') return data.trim();
  if (data?.conversation?.generated_responses) {
    const r = data.conversation.generated_responses;
    return r[r.length - 1]?.trim() ?? '';
  }
  throw new Error('Unexpected HF response shape');
}

// ─── Provider: Gemini ─────────────────────────────────────────────────────────
let _geminiClient = null;

function getGeminiClient() {
  if (!_geminiClient) {
    if (!CONFIG.geminiApiKey) throw new Error('GEMINI_API_KEY not configured');
    _geminiClient = new GoogleGenerativeAI(CONFIG.geminiApiKey);
  }
  return _geminiClient;
}

async function _callGemini(prompt, parameters) {
  const client = getGeminiClient();
  const model = client.getGenerativeModel({
    model: CONFIG.geminiModel,
    generationConfig: {
      temperature: parameters.temperature ?? 0.7,
      maxOutputTokens: parameters.max_new_tokens ?? parameters.max_tokens ?? 512,
    },
  });

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();
  if (!text) throw new Error('Gemini returned an empty response');
  return text.trim();
}

// ─── Provider: Hugging Face ───────────────────────────────────────────────────
async function _callHF(modelId, prompt, parameters) {
  if (!modelId) throw new Error('No HF model configured');
  const url = `${CONFIG.hfBaseUrl}/chat/completions`;
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
        Authorization: `Bearer ${CONFIG.hfApiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: CONFIG.timeout,
    }
  );
  return parseHFResponse(response.data);
}

// ─── Retry Helper ─────────────────────────────────────────────────────────────
async function withRetry(fn, maxRetries, baseDelay, providerName) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err.response?.status;
      const isTransient = !status || [429, 500, 502, 503, 504].includes(status);
      if (attempt < maxRetries && isTransient) {
        const delay = baseDelay * 2 ** attempt + Math.random() * 300;
        console.warn(
          `[LLM:${providerName}] Attempt ${attempt + 1} failed (${err.message}). Retrying in ${Math.round(delay)}ms`
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

// ─── Core Generate (with provider waterfall) ──────────────────────────────────
async function _generateInternal(prompt, options) {
  const startMs = Date.now();

  // ── Tier 1: Gemini ──
  if (geminiBreaker.canRequest()) {
    try {
      const raw = await withRetry(
        () => _callGemini(prompt, options),
        CONFIG.maxRetries,
        CONFIG.baseDelay,
        'Gemini'
      );
      const text = sanitizeResponse(raw);
      geminiBreaker.recordSuccess();
      const result = { text, model: CONFIG.geminiModel, cached: false, latencyMs: Date.now() - startMs };
      cache.set(prompt, options, { text, model: CONFIG.geminiModel });
      return result;
    } catch (err) {
      geminiBreaker.recordFailure();
      console.warn(`[LLM] Gemini failed (${err.message}). Falling back to Hugging Face.`);
    }
  } else {
    console.warn('[LLM] Gemini circuit OPEN – skipping directly to Hugging Face.');
  }

  // ── Tier 2: Hugging Face (primary HF model → HF fallback model) ──
  const hfModels = [CONFIG.hfPrimaryModel, CONFIG.hfFallbackModel].filter(Boolean);

  if (hfModels.length === 0) {
    throw new Error('No HF model configured and Gemini is unavailable.');
  }

  if (!hfBreaker.canRequest()) {
    throw new Error('LLM service temporarily unavailable (both circuit breakers open).');
  }

  for (const modelId of hfModels) {
    try {
      const raw = await withRetry(
        () => _callHF(modelId, prompt, options),
        CONFIG.maxRetries,
        CONFIG.baseDelay,
        `HF:${modelId}`
      );
      const text = sanitizeResponse(raw);
      hfBreaker.recordSuccess();
      const result = { text, model: modelId, cached: false, latencyMs: Date.now() - startMs };
      cache.set(prompt, options, { text, model: modelId });
      return result;
    } catch (err) {
      hfBreaker.recordFailure();
      console.warn(`[LLM] HF model ${modelId} failed: ${err.message}`);
      // try next hfModel in list
    }
  }

  throw new Error('All LLM providers exhausted. No response generated.');
}

/**
 * Generate an LLM response.
 * Tries Gemini first; falls back to Hugging Face automatically.
 *
 * @param {string} prompt
 * @param {object} options  - { temperature, max_new_tokens, max_tokens }
 * @returns {Promise<{ text: string, model: string, cached: boolean, latencyMs: number }>}
 */
async function generate(prompt, options = {}) {
  const cleanPrompt = sanitizePrompt(prompt);
  if (!cleanPrompt) throw new Error('Prompt is empty after sanitization');

  const tokenEst = estimateTokens(cleanPrompt);
  if (tokenEst > 6000) {
    console.warn(`[LLM] Prompt is ~${tokenEst} tokens – may hit context window limit`);
  }

  // Cache check
  const cached = cache.get(cleanPrompt, options);
  if (cached) {
    return { text: cached.text, model: cached.model, cached: true, latencyMs: 0 };
  }

  // In-flight dedup
  const dedupeKey = crypto
    .createHash('md5')
    .update(JSON.stringify({ cleanPrompt, options }))
    .digest('hex');

  if (inFlight.has(dedupeKey)) {
    return inFlight.get(dedupeKey);
  }

  const resultPromise = _generateInternal(cleanPrompt, options);
  inFlight.set(dedupeKey, resultPromise);
  try {
    return await resultPromise;
  } finally {
    inFlight.delete(dedupeKey);
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  generate,
  estimateTokens,
  clearCache: () => cache.clear(),
  getProviderStatus: () => ({
    gemini: { state: geminiBreaker.getState(), model: CONFIG.geminiModel },
    huggingFace: {
      state: hfBreaker.getState(),
      primaryModel: CONFIG.hfPrimaryModel,
      fallbackModel: CONFIG.hfFallbackModel || null,
    },
  }),
};
