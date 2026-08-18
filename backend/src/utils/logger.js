'use strict';

/**
 * Structured logger.
 * NEVER log: passwords, tokens, API keys, DB credentials, PII.
 */

const SENSITIVE_KEYS = new Set([
  'password', 'secret', 'token', 'apiKey', 'api_key',
  'authorization', 'credential', 'private_key', 'privateKey',
  'serviceAccountKey', 'refreshToken', 'accessToken',
]);

function redact(obj, depth = 0) {
  if (depth > 5 || obj === null || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(k) || SENSITIVE_KEYS.has(k.toLowerCase())) {
      out[k] = '[REDACTED]';
    } else if (typeof v === 'object') {
      out[k] = redact(v, depth + 1);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function formatLog(level, message, meta = {}) {
  return JSON.stringify({
    ts: new Date().toISOString(),
    level,
    message,
    ...redact(meta),
  });
}

// Lazy require to avoid circular deps
function getAuditStore() {
  return require('../services/auditStore');
}

const logger = {
  info(message, meta = {}) {
    console.log(formatLog('INFO', message, meta));
  },
  warn(message, meta = {}) {
    console.warn(formatLog('WARN', message, meta));
  },
  error(message, meta = {}) {
    console.error(formatLog('ERROR', message, meta));
  },
  audit(action, meta = {}) {
    // Audit logs: who did what, when, on which site, success/fail
    console.log(formatLog('AUDIT', action, meta));
    // Persist to audit store (non-blocking)
    try {
      getAuditStore().append({
        actorId:  meta.userId || meta.actorId || null,
        siteId:   meta.siteId || null,
        action,
        result:   meta.result || 'SUCCESS',
        metadata: meta,
      });
    } catch { /* store not ready yet — skip */ }
  },
};

module.exports = logger;
