'use strict';

/**
 * AI Comment Analysis Service.
 *
 * Security rules:
 *   - AI API key loaded from env or site secret store — never from client
 *   - Comments sanitized before sending to AI
 *   - AI result validated before storage
 *   - Results presented as probability, never as fact
 *   - Original comment and AI result stored separately
 */

const { resolveSecret } = require('./siteSecretStore');
const logger = require('../utils/logger');

// Supported AI providers
const PROVIDERS = { openai: _callOpenAI, gemini: _callGemini };

// Simple in-memory result cache (siteId+commentHash → result)
const resultCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min

/**
 * Analyze a comment for sentiment.
 *
 * @param {string} siteId
 * @param {string} commentText  — raw comment
 * @param {object} options      — { provider, apiKeyPlaceholder }
 * @returns {{ sentiment, confidence, keywords, scores, cached }}
 */
async function analyzeComment(siteId, commentText, options = {}) {
  // 1. Sanitize input
  const sanitized = _sanitizeComment(commentText);
  if (!sanitized) throw Object.assign(new Error('Comment is empty after sanitization.'), { status: 400 });

  // 2. Resolve API key — from site secret store (placeholder) or platform env
  const provider = options.provider || process.env.AI_PROVIDER || 'openai';
  const apiKey = _resolveApiKey(siteId, options.apiKeyPlaceholder, provider);
  if (!apiKey) throw Object.assign(new Error('AI API key not configured for this site.'), { status: 503 });

  // 3. Check cache
  const cacheKey = `${siteId}:${provider}:${_hash(sanitized)}`;
  const cached = resultCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return { ...cached.result, cached: true };
  }

  // 4. Call AI provider
  const callFn = PROVIDERS[provider];
  if (!callFn) throw Object.assign(new Error(`Unsupported AI provider: ${provider}`), { status: 400 });

  let raw;
  try {
    raw = await callFn(sanitized, apiKey);
  } catch (err) {
    logger.error('AI_CALL_FAILED', { siteId, provider, error: err.message });
    throw Object.assign(new Error('AI analysis temporarily unavailable.'), { status: 503 });
  }

  // 5. Validate AI response
  const result = _validateAndNormalize(raw);

  // 6. Cache result
  resultCache.set(cacheKey, { result, ts: Date.now() });

  logger.info('AI_COMMENT_ANALYZED', { siteId, provider, sentiment: result.sentiment });
  return { ...result, cached: false };
}

// ─── Provider implementations ─────────────────────────────────────────────

async function _callOpenAI(text, apiKey) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 200,
      messages: [
        {
          role: 'system',
          content: `Analyze the sentiment of the following text.
Respond ONLY with valid JSON in this exact format (no markdown, no extra text):
{"sentiment":"positive"|"neutral"|"negative","confidence":0.0-1.0,"keywords":["word1","word2"],"scores":{"positive":0.0,"neutral":0.0,"negative":0.0}}`,
        },
        { role: 'user', content: text },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${err.slice(0, 100)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty OpenAI response.');

  return JSON.parse(content);
}

async function _callGemini(text, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `Analyze sentiment. Respond ONLY with JSON, no markdown:
{"sentiment":"positive"|"neutral"|"negative","confidence":0.0-1.0,"keywords":["word1"],"scores":{"positive":0.0,"neutral":0.0,"negative":0.0}}

Text: ${text}`,
        }],
      }],
      generationConfig: { maxOutputTokens: 200, temperature: 0.1 },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini error ${response.status}: ${err.slice(0, 100)}`);
  }

  const data = await response.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error('Empty Gemini response.');

  // Strip markdown fences if present
  const clean = content.replace(/```json?|```/g, '').trim();
  return JSON.parse(clean);
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function _sanitizeComment(text) {
  if (typeof text !== 'string') return '';
  return text
    .trim()
    .slice(0, 2000)                   // max length
    .replace(/<script[\s\S]*?<\/script>/gi, '') // strip script blocks
    .replace(/<style[\s\S]*?<\/style>/gi, '')  // strip style blocks
    .replace(/<[^>]*>/g, '')               // strip remaining tags
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // strip control chars
}

function _resolveApiKey(siteId, placeholder, provider) {
  // 1. Site-specific key via placeholder
  if (placeholder) {
    const key = resolveSecret(siteId, placeholder);
    if (key) return key;
  }

  // 2. Platform-level env var
  return process.env.AI_PROVIDER_API_KEY || null;
}

function _validateAndNormalize(raw) {
  const VALID_SENTIMENTS = new Set(['positive', 'neutral', 'negative']);

  if (!raw || typeof raw !== 'object') throw new Error('Invalid AI response structure.');

  const sentiment = raw.sentiment;
  if (!VALID_SENTIMENTS.has(sentiment)) throw new Error(`Invalid sentiment value: ${sentiment}`);

  const confidence = parseFloat(raw.confidence);
  if (isNaN(confidence) || confidence < 0 || confidence > 1) throw new Error('Invalid confidence value.');

  const keywords = Array.isArray(raw.keywords)
    ? raw.keywords.filter((k) => typeof k === 'string').slice(0, 10)
    : [];

  const scores = raw.scores || {};
  const normalize = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : Math.min(1, Math.max(0, n)); };

  return {
    sentiment,
    confidence: Math.round(confidence * 100) / 100,
    keywords,
    scores: {
      positive: normalize(scores.positive),
      neutral: normalize(scores.neutral),
      negative: normalize(scores.negative),
    },
    // Never present AI results as definitive facts
    disclaimer: 'AI-generated estimate. Confidence indicates probability, not certainty.',
  };
}

function _hash(text) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

module.exports = { analyzeComment };
