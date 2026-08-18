'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { requireSiteRole } = require('../services/rbac');
const { handleValidationErrors, isValidFunctionName } = require('../utils/validate');
const functionStore = require('../services/functionStore');
const { getDb } = require('../adapters/DatabaseRegistry');
const logger = require('../utils/logger');

const router = express.Router();
router.use(requireAuth);

// ─── GET /api/v1/functions/:siteId  — list functions ─────────────────────
router.get('/:siteId',
  [param('siteId').isUUID()],
  handleValidationErrors,
  requireSiteRole('VIEWER'),
  async (req, res, next) => {
    try {
      const { siteId } = req.params;
      const functions = functionStore.getFunctions(siteId);

      // Enrich each function with aggregated stats
      const db = getDb();
      const now = Date.now();
      const from30d = now - 30 * 86_400_000;
      const fromToday = now - 86_400_000;

      const enriched = await Promise.all(functions.map(async (fn) => {
        const [totalCounts, todayCounts, sessions30d] = await Promise.all([
          db.getEventCounts(siteId, 0, now),
          db.getEventCounts(siteId, fromToday, now),
          db.getUniqueSessionCount(siteId, from30d, now),
        ]);
        return {
          ...fn,
          totalExecutions: totalCounts[fn.name] || 0,
          executionsToday: todayCounts[fn.name] || 0,
          // uniqueUsers approximated as unique sessions
          uniqueUsers: sessions30d,
        };
      }));

      return res.json({ siteId, functions: enriched });
    } catch (err) { next(err); }
  }
);

// ─── POST /api/v1/functions/:siteId  — create function ───────────────────
router.post('/:siteId',
  [
    param('siteId').isUUID(),
    body('name').isString().custom((v) => {
      if (!isValidFunctionName(v)) throw new Error('Function name: a-zA-Z0-9_- only, max 64 chars.');
      return true;
    }),
    body('label').optional().isString().trim().isLength({ max: 100 }),
    body('description').optional().isString().trim().isLength({ max: 500 }),
  ],
  handleValidationErrors,
  requireSiteRole('ADMIN'),
  (req, res, next) => {
    try {
      const fn = functionStore.createFunction(req.params.siteId, {
        name: req.body.name,
        label: req.body.label,
        description: req.body.description,
      });
      logger.audit('FUNCTION_CREATE', { userId: req.user.userId, siteId: req.params.siteId, name: fn.name });
      return res.status(201).json({ function: fn });
    } catch (err) { next(err); }
  }
);

// ─── GET /api/v1/functions/:siteId/:name  — function detail + timeseries ─
router.get('/:siteId/:name',
  [
    param('siteId').isUUID(),
    param('name').isString().custom((v) => {
      if (!isValidFunctionName(v)) throw new Error('Invalid function name.');
      return true;
    }),
  ],
  handleValidationErrors,
  requireSiteRole('VIEWER'),
  async (req, res, next) => {
    try {
      const { siteId, name } = req.params;
      const fn = functionStore.getFunctionByName(siteId, name);
      if (!fn) return res.status(404).json({ error: 'Function not found.' });

      const db = getDb();
      const now = Date.now();
      const from7d = now - 7 * 86_400_000;

      const [timeSeries, eventCounts, recentEvents] = await Promise.all([
        db.getVisitorTimeSeries(siteId, from7d, now),
        db.getEventCounts(siteId, from7d, now),
        db.getEvents({ siteId, eventName: name, from: from7d, to: now, limit: 20 }),
      ]);

      return res.json({
        function: fn,
        stats: {
          totalExecutions: eventCounts[name] || 0,
          executionsLast7d: eventCounts[name] || 0,
          timeSeries: timeSeries.filter((_, i) => i % 1 === 0), // all hours
          recentEvents,
        },
      });
    } catch (err) { next(err); }
  }
);

// ─── PATCH /api/v1/functions/:siteId/:name ────────────────────────────────
router.patch('/:siteId/:name',
  [
    param('siteId').isUUID(),
    param('name').isString(),
    body('label').optional().isString().trim().isLength({ max: 100 }),
    body('description').optional().isString().trim().isLength({ max: 500 }),
  ],
  handleValidationErrors,
  requireSiteRole('ADMIN'),
  (req, res, next) => {
    try {
      const updated = functionStore.updateFunction(req.params.siteId, req.params.name, req.body);
      logger.audit('FUNCTION_UPDATE', { userId: req.user.userId, siteId: req.params.siteId, name: req.params.name });
      return res.json({ function: updated });
    } catch (err) { next(err); }
  }
);

// ─── DELETE /api/v1/functions/:siteId/:name ───────────────────────────────
router.delete('/:siteId/:name',
  [param('siteId').isUUID(), param('name').isString()],
  handleValidationErrors,
  requireSiteRole('ADMIN'),
  (req, res, next) => {
    try {
      const deleted = functionStore.deleteFunction(req.params.siteId, req.params.name);
      if (!deleted) return res.status(404).json({ error: 'Function not found.' });
      logger.audit('FUNCTION_DELETE', { userId: req.user.userId, siteId: req.params.siteId, name: req.params.name });
      return res.json({ message: 'Function deleted.' });
    } catch (err) { next(err); }
  }
);

module.exports = router;
