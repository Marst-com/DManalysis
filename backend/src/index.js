'use strict';

require('dotenv').config();

// Validate all required env vars before anything else
require('./config/startupValidator').validate();

let securityConfig;
try {
  securityConfig = require('./config/security');
} catch (err) {
  console.error('[STARTUP ERROR]', err.message);
  process.exit(1);
}

const express = require('express');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const {
  helmetMiddleware,
  corsMiddleware,
  apiRateLimiter,
  errorHandler,
} = require('./middleware/security');

const app = express();

// ─── Security middleware ──────────────────────────────────────────────────
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.options('/{*path}', corsMiddleware);

// ─── Body parsing ─────────────────────────────────────────────────────────
app.use(express.json({ limit: securityConfig.requestSizeLimit }));
app.use(express.urlencoded({ extended: false, limit: securityConfig.requestSizeLimit }));
app.use(cookieParser());

// ─── Logging ──────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') app.use(morgan('combined'));

// ─── Global rate limiter ─────────────────────────────────────────────────
app.use('/api/', apiRateLimiter);

// ─── SDK static file ────────────────────────────────────────────────────────
const path = require('path');
app.get('/sdk/dm.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  // CORS: SDK must be loadable from any origin (it's a public script)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.sendFile(path.join(__dirname, '..', 'public', 'dm.js'));
});

// ─── Health check ─────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ─── API Routes ───────────────────────────────────────────────────────────
app.get('/api/v1', (req, res) => res.json({ name: 'DuoMarst Analytics API', version: '1.0.0' }));
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/sites', require('./routes/sites'));
app.use('/api/v1/events', express.json({ limit: securityConfig.ingestionSizeLimit }), require('./routes/events'));
app.use('/api/v1/analytics', require('./routes/analytics'));
app.use('/api/v1/functions', require('./routes/functions'));
app.use('/api/v1/ai', require('./routes/ai'));
app.use('/api/v1/alerts', require('./routes/alerts'));
app.use('/api/v1/audit', require('./routes/audit'));
app.use('/api/v1/sites/:siteId', require('./routes/siteConfig'));

// ─── 404 ──────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

// ─── Error handler ────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Startup ──────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '4000', 10);

async function start() {
  // Init DB adapter BEFORE accepting requests
  const db = require('./adapters/DatabaseRegistry');
  await db.init();

  const seedAdmin = require('./utils/seedAdmin');

  const server = app.listen(PORT, async () => {
    console.log(`[SERVER] DuoMarst Analytics API on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
    await seedAdmin();
  });

  process.on('SIGTERM', () => {
    console.log('[SERVER] Shutting down...');
    server.close(() => { console.log('[SERVER] Closed.'); process.exit(0); });
  });

  return server;
}

start().catch((err) => {
  console.error('[STARTUP ERROR]', err.message);
  process.exit(1);
});

module.exports = app;
