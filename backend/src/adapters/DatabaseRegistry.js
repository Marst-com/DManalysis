'use strict';

/**
 * DatabaseRegistry
 *
 * Single point of adapter selection.
 * Backend services import `db` from here — never import adapters directly.
 *
 * Adapter is chosen by DB_ADAPTER env var:
 *   memory   → MemoryAdapter   (dev / test)
 *   firebase → FirebaseAdapter (production)
 *   supabase → SupabaseAdapter (future — STEP 9)
 *
 * Default: memory (safe fallback, no credentials needed)
 */

const logger = require('../utils/logger');

let _adapter = null;

async function init() {
  if (_adapter) return _adapter;

  const type = (process.env.DB_ADAPTER || 'memory').toLowerCase();

  switch (type) {
    case 'firebase': {
      const FirebaseAdapter = require('./firebase/FirebaseAdapter');
      _adapter = new FirebaseAdapter();
      await _adapter.connect();
      logger.info('Database adapter: Firebase');
      break;
    }

    case 'supabase': {
      const SupabaseAdapter = require('./supabase/SupabaseAdapter');
      _adapter = new SupabaseAdapter();
      await _adapter.connect();
      logger.info('Database adapter: Supabase');
      break;
    }

    case 'memory':
    default: {
      const MemoryAdapter = require('./MemoryAdapter');
      _adapter = new MemoryAdapter();
      await _adapter.ping();
      logger.info('Database adapter: Memory (dev mode)');
      break;
    }
  }

  return _adapter;
}

/**
 * Get the initialized adapter.
 * Throws if init() was not called first.
 */
function getDb() {
  if (!_adapter) {
    throw new Error('Database not initialized. Call DatabaseRegistry.init() at startup.');
  }
  return _adapter;
}

module.exports = { init, getDb };
