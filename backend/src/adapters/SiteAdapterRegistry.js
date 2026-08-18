'use strict';

/**
 * SiteAdapterRegistry
 *
 * Each site can have its own DB connection (Firebase or Supabase).
 * Site DB config is stored encrypted in the platform DB.
 *
 * Flow:
 *   1. Admin registers site DB config via API (credentials encrypted server-side)
 *   2. On first use, adapter is initialized and cached
 *   3. All analytics for that site go to its own DB
 *   4. Falls back to platform MemoryAdapter if no site DB configured
 *
 * Security:
 *   - DB credentials are AES-256-GCM encrypted at rest
 *   - Never returned to frontend
 *   - Decrypted only when initializing the adapter (server-side, in-memory)
 */

const { decrypt } = require('../utils/secretCrypto');
const { encrypt } = require('../utils/secretCrypto');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// Map<siteId, { config: encryptedConfig, adapter: AdapterInstance | null }>
const siteConfigs = new Map();
// Map<siteId, DatabaseAdapter>  — initialized adapters cache
const adapterCache = new Map();

// ─── Config management ────────────────────────────────────────────────────

/**
 * Register or update a site's DB config.
 * credentials object is encrypted before storage.
 *
 * @param {string} siteId
 * @param {'firebase'|'supabase'|'memory'} type
 * @param {object} credentials  — plaintext, encrypted immediately
 */
function setSiteDbConfig(siteId, type, credentials) {
  const allowed = new Set(['firebase', 'supabase', 'memory']);
  if (!allowed.has(type)) throw Object.assign(new Error(`Unsupported DB type: ${type}`), { status: 400 });

  const encrypted = encrypt(JSON.stringify(credentials));
  siteConfigs.set(siteId, { type, encrypted, updatedAt: new Date().toISOString() });

  // Invalidate cached adapter so it's rebuilt with new credentials
  adapterCache.delete(siteId);

  logger.audit('SITE_DB_CONFIG_SET', { siteId, type });
}

/**
 * Get site DB config metadata (no credentials).
 */
function getSiteDbConfigMeta(siteId) {
  const conf = siteConfigs.get(siteId);
  if (!conf) return null;
  return { siteId, type: conf.type, updatedAt: conf.updatedAt };
}

/**
 * Remove site DB config.
 */
function removeSiteDbConfig(siteId) {
  siteConfigs.delete(siteId);
  adapterCache.delete(siteId);
  logger.audit('SITE_DB_CONFIG_REMOVED', { siteId });
}

// ─── Adapter resolution ───────────────────────────────────────────────────

/**
 * Get (or initialize) the DatabaseAdapter for a given site.
 * Falls back to platform MemoryAdapter if no config set.
 */
async function getSiteAdapter(siteId) {
  // Return cached adapter if available
  if (adapterCache.has(siteId)) return adapterCache.get(siteId);

  const conf = siteConfigs.get(siteId);
  if (!conf) {
    // No site-specific DB — use platform default (MemoryAdapter)
    const { getDb } = require('./DatabaseRegistry');
    return getDb();
  }

  // Decrypt credentials
  let credentials;
  try {
    credentials = JSON.parse(decrypt(conf.encrypted));
  } catch (err) {
    logger.error('SITE_DB_DECRYPT_FAILED', { siteId, error: err.message });
    throw new Error('Failed to load site database configuration.');
  }

  // Initialize adapter
  const adapter = await _buildAdapter(siteId, conf.type, credentials);
  adapterCache.set(siteId, adapter);
  return adapter;
}

async function _buildAdapter(siteId, type, credentials) {
  switch (type) {
    case 'firebase': {
      const FirebaseAdapter = require('../adapters/firebase/FirebaseAdapter');
      const adapter = new FirebaseAdapter();
      // Inject credentials via env-like object (adapter reads from process.env fallback)
      // We override by passing credentials directly to a connect variant
      await adapter.connectWithCredentials(credentials);
      logger.info('Site Firebase adapter initialized', { siteId });
      return adapter;
    }

    case 'supabase': {
      const SupabaseAdapter = require('../adapters/supabase/SupabaseAdapter');
      const adapter = new SupabaseAdapter();
      await adapter.connectWithCredentials(credentials);
      logger.info('Site Supabase adapter initialized', { siteId });
      return adapter;
    }

    case 'memory':
    default: {
      const MemoryAdapter = require('../adapters/MemoryAdapter');
      const adapter = new MemoryAdapter();
      await adapter.ping();
      return adapter;
    }
  }
}

module.exports = { setSiteDbConfig, getSiteDbConfigMeta, removeSiteDbConfig, getSiteAdapter };
