'use strict';

const express = require('express');
const { param, query } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { requireSiteRole } = require('../services/rbac');
const { handleValidationErrors } = require('../utils/validate');
const { getDb } = require('../adapters/DatabaseRegistry');

const router = express.Router();
router.use(requireAuth);

function parseRange(req) {
  const days = Math.min(Math.max(parseInt(req.query.days || '7', 10), 1), 90);
  const toMs = Date.now() + 1000; // +1s buffer for boundary events
  return { fromMs: toMs - days * 86_400_000, toMs };
}

// GET /api/v1/analytics/:siteId/summary
router.get('/:siteId/summary',
  [param('siteId').isUUID(), query('days').optional().isInt({ min: 1, max: 90 })],
  handleValidationErrors,
  requireSiteRole('VIEWER'),
  async (req, res, next) => {
    try {
      const { siteId } = req.params;
      const { fromMs, toMs } = parseRange(req);
      const db = getDb();
      const [uniqueSessions, eventCounts, totalEvents, timeSeries] = await Promise.all([
        db.getUniqueSessionCount(siteId, fromMs, toMs),
        db.getEventCounts(siteId, fromMs, toMs),
        db.getTotalEventCount(siteId),
        db.getVisitorTimeSeries(siteId, fromMs, toMs),
      ]);
      return res.json({ siteId, range: { fromMs, toMs }, uniqueSessions, totalEvents, eventCounts, timeSeries });
    } catch (err) { next(err); }
  }
);

// GET /api/v1/analytics/:siteId/events
router.get('/:siteId/events',
  [param('siteId').isUUID(),
   query('eventName').optional().isString().isLength({ max: 64 }),
   query('limit').optional().isInt({ min: 1, max: 1000 }),
   query('days').optional().isInt({ min: 1, max: 90 })],
  handleValidationErrors,
  requireSiteRole('ANALYST'),
  async (req, res, next) => {
    try {
      const { siteId } = req.params;
      const { fromMs, toMs } = parseRange(req);
      const events = await getDb().getEvents({
        siteId, eventName: req.query.eventName,
        from: fromMs, to: toMs,
        limit: parseInt(req.query.limit || '100', 10),
      });
      return res.json({ siteId, events, count: events.length });
    } catch (err) { next(err); }
  }
);

// GET /api/v1/analytics/:siteId/timeseries
router.get('/:siteId/timeseries',
  [param('siteId').isUUID(), query('days').optional().isInt({ min: 1, max: 90 })],
  handleValidationErrors,
  requireSiteRole('VIEWER'),
  async (req, res, next) => {
    try {
      const { fromMs, toMs } = parseRange(req);
      const series = await getDb().getVisitorTimeSeries(req.params.siteId, fromMs, toMs);
      return res.json({ siteId: req.params.siteId, series });
    } catch (err) { next(err); }
  }
);

module.exports = router;
