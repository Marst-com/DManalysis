'use strict';

/**
 * Site Secret Store.
 *
 * Each site can register named secrets (placeholders → real values).
 * Real values are AES-256-GCM encrypted at rest.
 *
 * Example:
 *   placeholder: "GEMINI_KEY"
 *   realValue:   "AIza..."   ← stored encrypted, never returned to client
 *
 * When backend needs to call a 3rd-party API on behalf of a site,
 * it resolves the placeholder to the decrypted real value server-side.
 * The real value is NEVER sent to the frontend.
 */

const { encrypt, decrypt } = require('../utils/secretCrypto');
const { v4: uuidv4 } = require('uuid');

// Map<siteId, Map<placeholder, encryptedRecord>>
const store = new Map();

/**
 * Set (create or update) a secret for a site.
 * realValue is encrypted before storage.
 */
function setSecret(siteId, placeholder, realValue, label = '') {
  _validatePlaceholder(placeholder);
  if (typeof realValue !== 'string' || realValue.length < 1 || realValue.length > 4096) {
    throw Object.assign(new Error('Secret value must be a non-empty string (max 4096 chars).'), { status: 400 });
  }

  if (!store.has(siteId)) store.set(siteId, new Map());

  const encrypted = encrypt(realValue);
  const now = new Date().toISOString();
  const existing = store.get(siteId).get(placeholder);

  store.get(siteId).set(placeholder, {
    id: existing?.id || uuidv4(),
    siteId,
    placeholder,
    label: label || placeholder,
    encrypted,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  });
}

/**
 * Resolve a placeholder to its real (decrypted) value.
 * Returns null if not found.
 * This is ONLY called server-side — result never sent to frontend.
 */
function resolveSecret(siteId, placeholder) {
  const record = store.get(siteId)?.get(placeholder);
  if (!record) return null;
  return decrypt(record.encrypted);
}

/**
 * List secrets for a site — returns metadata only, NO encrypted values.
 */
function listSecrets(siteId) {
  const siteSecrets = store.get(siteId);
  if (!siteSecrets) return [];
  return [...siteSecrets.values()].map(({ id, siteId, placeholder, label, createdAt, updatedAt }) => ({
    id, siteId, placeholder, label, createdAt, updatedAt,
    // Never include 'encrypted' field in listing
  }));
}

/**
 * Delete a secret.
 */
function deleteSecret(siteId, placeholder) {
  return store.get(siteId)?.delete(placeholder) ?? false;
}

/**
 * Resolve all placeholders in an object (for batch resolution).
 * Input: { someKey: "GEMINI_KEY", other: "static-value" }
 * Output: { someKey: "<real gemini key>", other: "static-value" }
 *
 * Only resolves values that exactly match a registered placeholder.
 * Non-matching values pass through unchanged.
 * Result is NEVER sent to frontend.
 */
function resolvePlaceholders(siteId, obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const resolved = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') {
      const real = resolveSecret(siteId, v);
      resolved[k] = real !== null ? real : v;
    } else {
      resolved[k] = v;
    }
  }
  return resolved;
}

function _validatePlaceholder(name) {
  if (typeof name !== 'string' || !/^[A-Z0-9_]{1,64}$/.test(name)) {
    throw Object.assign(
      new Error('Placeholder must be uppercase letters, numbers, underscores, 1-64 chars. E.g. GEMINI_KEY'),
      { status: 400 }
    );
  }
}

module.exports = { setSecret, resolveSecret, listSecrets, deleteSecret, resolvePlaceholders };
