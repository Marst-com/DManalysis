'use strict';

const express = require('express');
const { requireIngestionKey } = require('../middleware/auth');
const { ingestionRateLimiter } = require('../middleware/security');
const { parseIngestionPayload } = require('../services/ingestionParser');
const { checkAbuseLimit } = require('../services/eventStore');
const { getDb } = require('../adapters/DatabaseRegistry');
const { getSiteAdapter } = require('../adapters/SiteAdapterRegistry');
const { resolvePlaceholders } = require('../services/siteSecretStore');
const logger = require('../utils/logger');

const router = express.Router();

function ingestionAuth() {
  return requireIngestionKey(async (rawKey) => getDb().lookupSiteByApiKey(rawKey));
}

// POST /api/v1/events
router.post('/',
  ingestionRateLimiter,
  ingestionAuth(),
  async (req, res) => {
    const site = req.site;

    // Origin check against registered domain
    const origin = req.headers['origin'];
    if (site.domain && origin) {
      let originHost;
      try { originHost = new URL(origin).host; }
      catch { return res.status(403).json({ error: 'Invalid origin.' }); }
      if (originHost !== site.domain && !originHost.endsWith(`.${site.domain}`)) {
        logger.warn('INGESTION_ORIGIN_MISMATCH', { siteId: site.id, expected: site.domain, received: originHost });
        return res.status(403).json({ error: 'Origin not allowed for this site.' });
      }
    }

    if (!checkAbuseLimit(site.id)) {
      logger.warn('INGESTION_ABUSE_LIMIT', { siteId: site.id });
      return res.status(429).json({ error: 'Event rate limit exceeded for this site.' });
    }

    const result = parseIngestionPayload(req.body, site.id);
    if (!result.ok) return res.status(422).json({ error: result.error });

    // Use site-specific DB adapter if configured, else platform default
    const siteDb = await getSiteAdapter(site.id);
    // Resolve placeholders in metadata server-side (real values never leave backend)
    const resolvedEvent = result.event.metadata
      ? { ...result.event, metadata: resolvePlaceholders(site.id, result.event.metadata) }
      : result.event;
    const event = await siteDb.insertEvent(resolvedEvent);
    return res.status(201).json({ id: event.id, received: true });
  }
);

// POST /api/v1/events/batch
router.post('/batch',
  ingestionRateLimiter,
  ingestionAuth(),
  async (req, res) => {
    const site = req.site;
    const raw = req.body?.events;
    if (!Array.isArray(raw) || raw.length === 0) return res.status(422).json({ error: 'events array required.' });
    if (raw.length > 20) return res.status(422).json({ error: 'Max 20 events per batch.' });
    if (!checkAbuseLimit(site.id)) return res.status(429).json({ error: 'Event rate limit exceeded for this site.' });

    const db = getDb();
    const results = [], errors = [];
    for (let i = 0; i < raw.length; i++) {
      const parsed = parseIngestionPayload(raw[i], site.id);
      if (!parsed.ok) { errors.push({ index: i, error: parsed.error }); continue; }
      const siteDb = await getSiteAdapter(site.id);
      const resolvedEvent = parsed.event.metadata
        ? { ...parsed.event, metadata: resolvePlaceholders(site.id, parsed.event.metadata) }
        : parsed.event;
      const event = await siteDb.insertEvent(resolvedEvent);
      results.push({ index: i, id: event.id });
    }
    return res.status(207).json({ accepted: results.length, rejected: errors.length, results, ...(errors.length ? { errors } : {}) });
  }
);

module.exports = router;
