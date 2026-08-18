'use strict';

const express = require('express');
const { body, param, query } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { requireSiteRole } = require('../services/rbac');
const { handleValidationErrors } = require('../utils/validate');
const alertEngine = require('../services/alertEngine');
const { getDb } = require('../adapters/DatabaseRegistry');
const logger = require('../utils/logger');

const router = express.Router();
router.use(requireAuth);

// GET /api/v1/alerts/:siteId/rules
router.get('/:siteId/rules',
  [param('siteId').isUUID()],
  handleValidationErrors,
  requireSiteRole('VIEWER'),
  (req, res) => {
    return res.json({ rules: alertEngine.getRules(req.params.siteId) });
  }
);

// POST /api/v1/alerts/:siteId/rules
router.post('/:siteId/rules',
  [
    param('siteId').isUUID(),
    body('name').isString().trim().isLength({ min: 1, max: 100 }),
    body('metric').isIn(['visitors', 'events', 'error_rate', 'unique_sessions']),
    body('operator').isIn(['>', '<', '>=', '<=', '==']),
    body('threshold').isFloat({ min: 0 }),
    body('windowMinutes').isInt({ min: 1, max: 1440 }),
    body('channels').isArray({ min: 1 }),
    body('channels.*').isIn(['dashboard', 'webhook']),
    body('webhookUrl').optional().isURL({ protocols: ['https'] }),
  ],
  handleValidationErrors,
  requireSiteRole('ADMIN'),
  (req, res, next) => {
    try {
      const rule = alertEngine.createRule(req.params.siteId, {
        name: req.body.name,
        metric: req.body.metric,
        operator: req.body.operator,
        threshold: req.body.threshold,
        windowMinutes: req.body.windowMinutes,
        channels: req.body.channels,
        webhookUrl: req.body.webhookUrl,
      });
      logger.audit('ALERT_RULE_CREATE', { userId: req.user.userId, siteId: req.params.siteId, ruleId: rule.id });
      return res.status(201).json({ rule });
    } catch (err) { next(err); }
  }
);

// PATCH /api/v1/alerts/:siteId/rules/:ruleId
router.patch('/:siteId/rules/:ruleId',
  [
    param('siteId').isUUID(), param('ruleId').isUUID(),
    body('name').optional().isString().trim().isLength({ max: 100 }),
    body('active').optional().isBoolean(),
    body('threshold').optional().isFloat({ min: 0 }),
  ],
  handleValidationErrors,
  requireSiteRole('ADMIN'),
  (req, res, next) => {
    try {
      const updated = alertEngine.updateRule(req.params.siteId, req.params.ruleId, req.body);
      return res.json({ rule: updated });
    } catch (err) { next(err); }
  }
);

// DELETE /api/v1/alerts/:siteId/rules/:ruleId
router.delete('/:siteId/rules/:ruleId',
  [param('siteId').isUUID(), param('ruleId').isUUID()],
  handleValidationErrors,
  requireSiteRole('ADMIN'),
  (req, res, next) => {
    try {
      const deleted = alertEngine.deleteRule(req.params.siteId, req.params.ruleId);
      if (!deleted) return res.status(404).json({ error: 'Rule not found.' });
      logger.audit('ALERT_RULE_DELETE', { userId: req.user.userId, siteId: req.params.siteId, ruleId: req.params.ruleId });
      return res.json({ message: 'Rule deleted.' });
    } catch (err) { next(err); }
  }
);

// GET /api/v1/alerts/:siteId/history
router.get('/:siteId/history',
  [param('siteId').isUUID(), query('limit').optional().isInt({ min: 1, max: 100 })],
  handleValidationErrors,
  requireSiteRole('VIEWER'),
  (req, res) => {
    const limit = parseInt(req.query.limit || '50', 10);
    return res.json({ alerts: alertEngine.getAlertHistory(req.params.siteId, limit) });
  }
);

// POST /api/v1/alerts/:siteId/evaluate  — 수동 평가 트리거 (OWNER only)
router.post('/:siteId/evaluate',
  [param('siteId').isUUID()],
  handleValidationErrors,
  requireSiteRole('OWNER'),
  async (req, res, next) => {
    try {
      const { siteId } = req.params;
      const db = getDb();
      const now = Date.now();

      await alertEngine.evaluateRules(siteId, async (metric, windowMinutes) => {
        // Add 1 second buffer to avoid boundary timing issues
        const fromMs = now - windowMinutes * 60_000 - 1000;
        const toMs = now + 1000; // +1s buffer
        switch (metric) {
          case 'visitors':       return db.getUniqueSessionCount(siteId, fromMs, toMs);
          case 'events':         return db.getTotalEventCount(siteId);
          case 'unique_sessions':return db.getUniqueSessionCount(siteId, fromMs, toMs);
          case 'error_rate':     return 0; // placeholder — needs error event tracking
          default:               return 0;
        }
      });

      return res.json({ message: 'Rules evaluated.', triggeredCount: alertEngine.getAlertHistory(siteId, 5).length });
    } catch (err) { next(err); }
  }
);

module.exports = router;
