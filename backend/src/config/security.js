/**
 * Security configuration
 * All values must come from environment variables.
 * Never hardcode secrets here.
 */

'use strict';

function requireEnv(name) {
  const val = process.env[name];
  if (!val) {
    throw new Error(`[SECURITY] Missing required environment variable: ${name}`);
  }
  return val;
}

const security = {
  jwt: {
    secret: requireEnv('JWT_SECRET'),
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
  },

  cors: {
    // Parse comma-separated list of allowed origins
    allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    ingestionMax: parseInt(process.env.INGESTION_RATE_LIMIT_MAX || '500', 10),
  },

  encryption: {
    key: requireEnv('SECRET_ENCRYPTION_KEY'),
  },

  requestSizeLimit: '10kb',
  ingestionSizeLimit: '50kb',
};

module.exports = security;
