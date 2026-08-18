'use strict';

/**
 * Ingestion payload processor.
 *
 * Responsibilities:
 * - Strip/reject any fields that could identify individuals
 * - Validate and normalize allowed fields
 * - Never trust client-supplied identity/privilege fields
 * - Coarse-grain geographic info (no precise location)
 */

const { isValidEventName, isValidTimestamp } = require('../utils/validate');

// Allowed device categories (whitelist)
const VALID_DEVICE_CATEGORIES = new Set(['mobile', 'desktop', 'tablet', 'unknown']);

// Allowed browser labels (client provides these — we just sanitize)
const BROWSER_REGEX = /^[a-zA-Z0-9 ._/-]{1,64}$/;
const OS_REGEX = /^[a-zA-Z0-9 ._/-]{1,64}$/;

// Referrer: only store origin (strip path, query, fragment) to avoid leaking PII in URLs
function sanitizeReferrer(ref) {
  if (!ref || typeof ref !== 'string') return null;
  try {
    const url = new URL(ref);
    // Only keep scheme + host — no path, no query params
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

// Coarse region: expect ISO 3166-1 alpha-2 country code only
const COUNTRY_CODE_REGEX = /^[A-Z]{2}$/;
function sanitizeRegion(region) {
  if (!region || typeof region !== 'string') return null;
  const upper = region.trim().toUpperCase();
  return COUNTRY_CODE_REGEX.test(upper) ? upper : null;
}

// Metadata: allow simple key-value pairs, no nested objects, limited size
function sanitizeMetadata(meta) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  const out = {};
  let count = 0;
  for (const [k, v] of Object.entries(meta)) {
    if (count >= 10) break; // max 10 keys
    if (typeof k !== 'string' || k.length > 64) continue;
    if (!BROWSER_REGEX.test(k)) continue; // reuse safe-char regex for keys
    if (typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean') continue;
    if (typeof v === 'string' && v.length > 256) continue;
    out[k] = v;
    count++;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Parse and sanitize a raw ingestion payload.
 * Returns { ok: true, event } or { ok: false, error }
 */
function parseIngestionPayload(body, siteId) {
  // eventName: required, whitelist
  const eventName = body?.eventName;
  if (!isValidEventName(eventName)) {
    return { ok: false, error: 'Invalid or missing eventName.' };
  }

  // timestamp: required, replay protection (±5 min)
  const ts = body?.timestamp;
  if (!isValidTimestamp(ts)) {
    return { ok: false, error: 'Invalid or missing timestamp.' };
  }

  // sessionId: optional, fixed format uuid or short alphanumeric
  const rawSessionId = body?.sessionId;
  let sessionId = null;
  if (rawSessionId && typeof rawSessionId === 'string') {
    // Accept UUID or up to 64-char alphanumeric string
    const SESSION_REGEX = /^[a-zA-Z0-9_-]{8,64}$/;
    sessionId = SESSION_REGEX.test(rawSessionId) ? rawSessionId : null;
  }

  // deviceCategory: optional, whitelist
  const rawDevice = body?.deviceCategory;
  const deviceCategory =
    rawDevice && VALID_DEVICE_CATEGORIES.has(rawDevice.toLowerCase())
      ? rawDevice.toLowerCase()
      : null;

  // browser / os: optional, safe-char regex
  const rawBrowser = body?.browser;
  const browser =
    rawBrowser && typeof rawBrowser === 'string' && BROWSER_REGEX.test(rawBrowser)
      ? rawBrowser
      : null;

  const rawOs = body?.os;
  const os = rawOs && typeof rawOs === 'string' && OS_REGEX.test(rawOs) ? rawOs : null;

  // Referrer: strip to origin only
  const referrer = sanitizeReferrer(body?.referrer);

  // Region: country code only (no city/precise location)
  const regionCoarse = sanitizeRegion(body?.regionCoarse);

  // Metadata: sanitized kv pairs
  const metadata = sanitizeMetadata(body?.metadata);

  // NEVER accept client-supplied fields:
  //   userId, adminId, role, siteOwner, verified, ip, email, name, etc.
  // siteId comes from the validated API key, not from the body.

  return {
    ok: true,
    event: {
      siteId,     // from API key, never from body
      eventName,
      sessionId,
      deviceCategory,
      browser,
      os,
      regionCoarse,
      referrer,
      timestamp: parseInt(ts, 10),
      metadata,
    },
  };
}

module.exports = { parseIngestionPayload };
