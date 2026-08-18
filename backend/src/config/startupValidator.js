'use strict';

/**
 * Production startup validator.
 * Checks all required env vars and security conditions before accepting requests.
 * Fails fast with a clear error — never silently continue with bad config.
 */

const ERRORS = [];

function require_env(name, opts = {}) {
  const val = process.env[name];
  if (!val) {
    ERRORS.push(`Missing required env var: ${name}`);
    return null;
  }
  if (opts.minLength && val.length < opts.minLength) {
    ERRORS.push(`${name} must be at least ${opts.minLength} chars (got ${val.length})`);
  }
  if (opts.hexLength && !/^[0-9a-fA-F]+$/.test(val)) {
    ERRORS.push(`${name} must be a hex string`);
  }
  if (opts.hexLength && val.length !== opts.hexLength) {
    ERRORS.push(`${name} must be exactly ${opts.hexLength} hex chars (got ${val.length})`);
  }
  return val;
}

function warn_if(condition, message) {
  if (condition) console.warn(`[STARTUP WARN] ${message}`);
}

function validate() {
  const isProd = process.env.NODE_ENV === 'production';

  // ─── Required always ──────────────────────────────────────────────────
  require_env('JWT_SECRET', { minLength: 64 });
  require_env('SECRET_ENCRYPTION_KEY', { hexLength: 64 });
  require_env('ALLOWED_ORIGINS');

  // ─── Production-only requirements ────────────────────────────────────
  if (isProd) {
    // Must not use insecure defaults
    const jwtSecret = process.env.JWT_SECRET || '';
    if (jwtSecret.includes('test') || jwtSecret.includes('dev') || jwtSecret.includes('replace')) {
      ERRORS.push('JWT_SECRET appears to be a placeholder — use a cryptographically random value in production.');
    }

    const encKey = process.env.SECRET_ENCRYPTION_KEY || '';
    if (encKey === '0'.repeat(64)) {
      ERRORS.push('SECRET_ENCRYPTION_KEY is all zeros — use a cryptographically random value in production.');
    }

    // HTTPS origins only in production
    const origins = (process.env.ALLOWED_ORIGINS || '').split(',');
    for (const origin of origins) {
      const trimmed = origin.trim();
      if (trimmed && !trimmed.startsWith('https://')) {
        ERRORS.push(`ALLOWED_ORIGINS must be HTTPS in production. Found: ${trimmed}`);
      }
    }

    // Seed credentials must not be set in production (security risk)
    if (process.env.SEED_ADMIN_EMAIL || process.env.SEED_ADMIN_PASSWORD) {
      ERRORS.push('SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD must not be set in production.');
    }
  }

  // ─── Warn about optional but recommended settings ─────────────────────
  warn_if(!process.env.WEBHOOK_SECRET, 'WEBHOOK_SECRET not set — webhook signatures will use insecure default.');
  warn_if(!process.env.AI_PROVIDER_API_KEY && !process.env.AI_PROVIDER, 'AI_PROVIDER_API_KEY not set — AI features will only work with per-site secrets.');

  // ─── DB adapter validation ────────────────────────────────────────────
  const adapter = process.env.DB_ADAPTER || 'memory';
  if (isProd && adapter === 'memory') {
    ERRORS.push('DB_ADAPTER=memory is not suitable for production. Use firebase or supabase.');
  }
  if (adapter === 'firebase') {
    require_env('FIREBASE_PROJECT_ID');
    require_env('FIREBASE_CLIENT_EMAIL');
    require_env('FIREBASE_PRIVATE_KEY');
  }
  if (adapter === 'supabase') {
    require_env('SUPABASE_URL');
    require_env('SUPABASE_SERVICE_ROLE_KEY');
  }

  // ─── Fail if any errors ───────────────────────────────────────────────
  if (ERRORS.length > 0) {
    console.error('\n[STARTUP ERROR] Configuration validation failed:');
    ERRORS.forEach((e) => console.error(`  ✗ ${e}`));
    console.error('\nFix the above issues and restart.\n');
    process.exit(1);
  }

  console.log(`[STARTUP] Config validated OK (${isProd ? 'production' : 'development'})`);
}

module.exports = { validate };
