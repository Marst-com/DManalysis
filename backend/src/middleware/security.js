'use strict';

const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;
const securityConfig = require('../config/security');

/**
 * Helmet: sets secure HTTP headers
 */
const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: {
    maxAge: 63072000, // 2 years
    includeSubDomains: true,
    preload: true,
  },
});

/**
 * CORS: only allow registered origins
 */
const corsMiddleware = cors({
  origin(origin, callback) {
    // Allow requests with no origin (e.g. server-to-server, health checks)
    if (!origin) return callback(null, false);

    if (securityConfig.cors.allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Log rejected origin (without leaking in response)
    console.warn(`[CORS] Rejected origin: ${origin}`);
    return callback(new Error('CORS_REJECTED'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
  maxAge: 600, // preflight cache 10 min
});

/**
 * General API rate limiter
 */
const apiRateLimiter = rateLimit({
  windowMs: securityConfig.rateLimit.windowMs,
  max: securityConfig.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler(req, res) {
    res.status(429).json({ error: 'Too many requests. Please try again later.' });
  },
});

/**
 * Stricter limiter for auth endpoints (brute force protection)
 */
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler(req, res) {
    res.status(429).json({ error: 'Too many authentication attempts. Try again later.' });
  },
});

/**
 * Analytics ingestion rate limiter (per API key, higher volume allowed)
 */
const ingestionRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: securityConfig.rateLimit.ingestionMax,
  keyGenerator(req) {
    // Rate limit by API key if present; otherwise fall back to normalized IP
    const apiKey = req.headers['x-api-key'];
    if (apiKey && typeof apiKey === 'string') return `key:${apiKey}`;
    return `ip:${ipKeyGenerator(req)}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler(req, res) {
    res.status(429).json({ error: 'Ingestion rate limit exceeded.' });
  },
});

/**
 * Sanitize error responses: never expose internal details to clients
 */
function errorHandler(err, req, res, next) {
  // CORS rejection
  if (err.message === 'CORS_REJECTED') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Log full error server-side only
  console.error('[ERROR]', {
    path: req.path,
    method: req.method,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  const status = err.status || err.statusCode || 500;

  // Never expose stack traces or internal messages in production
  if (process.env.NODE_ENV === 'production') {
    return res.status(status).json({ error: '요청을 처리하지 못했습니다.' });
  }

  return res.status(status).json({ error: err.message || '요청을 처리하지 못했습니다.' });
}

module.exports = {
  helmetMiddleware,
  corsMiddleware,
  apiRateLimiter,
  authRateLimiter,
  ingestionRateLimiter,
  errorHandler,
};
