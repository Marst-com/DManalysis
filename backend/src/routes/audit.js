'use strict';

const express = require('express');
const { param, query } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { requireGlobalRole, requireSiteRole } = require('../services/rbac');
const { handleValidationErrors } = require('../utils/validate');
const auditStore = require('../services/auditStore');

const router = express.Router();
router.use(requireAuth);

// GET /api/v1/audit/:siteId  — site-level audit log (ADMIN+)
router.get('/:siteId',
  [
    param('siteId').isUUID(),
    query('limit').optional().isInt({ min: 1, max: 500 }),
    query('action').optional().isString().isLength({ max: 64 }),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
  ],
  handleValidationErrors,
  requireSiteRole('ADMIN'),
  (req, res) => {
    const entries = auditStore.querySite(req.params.siteId, {
      limit:  parseInt(req.query.limit || '50', 10),
      action: req.query.action,
      from:   req.query.from,
      to:     req.query.to,
    });
    return res.json({ siteId: req.params.siteId, entries, count: entries.length });
  }
);

// GET /api/v1/audit  — global audit log (OWNER only)
router.get('/',
  [
    query('limit').optional().isInt({ min: 1, max: 1000 }),
    query('action').optional().isString().isLength({ max: 64 }),
    query('actorId').optional().isUUID(),
    query('siteId').optional().isUUID(),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
  ],
  handleValidationErrors,
  requireGlobalRole('OWNER'),
  (req, res) => {
    const entries = auditStore.queryGlobal({
      limit:   parseInt(req.query.limit || '100', 10),
      action:  req.query.action,
      actorId: req.query.actorId,
      siteId:  req.query.siteId,
      from:    req.query.from,
      to:      req.query.to,
    });
    return res.json({ entries, count: entries.length });
  }
);

module.exports = router;
