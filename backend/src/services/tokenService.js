'use strict';

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const securityConfig = require('../config/security');

/**
 * Issue a short-lived access token.
 * Payload contains only what's needed — no sensitive data.
 */
function issueAccessToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    securityConfig.jwt.secret,
    {
      algorithm: 'HS256',
      expiresIn: securityConfig.jwt.accessExpires,
      issuer: 'duomarst-analytics',
    }
  );
}

/**
 * Issue a long-lived refresh token (opaque random string).
 * We store only the HASH of this in the DB — never the raw token.
 */
function issueRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

/**
 * Hash a refresh token for safe storage.
 * Using SHA-256 is acceptable here: tokens are high-entropy random strings,
 * not user-chosen passwords.
 */
function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Refresh token cookie options.
 * httpOnly: JS cannot access it (XSS protection).
 * sameSite: Strict prevents CSRF.
 * secure: only sent over HTTPS (disabled in dev).
 */
function refreshCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'Strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    path: '/api/v1/auth', // restrict cookie to auth endpoints only
  };
}

module.exports = {
  issueAccessToken,
  issueRefreshToken,
  hashRefreshToken,
  refreshCookieOptions,
};
