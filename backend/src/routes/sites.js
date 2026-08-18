'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { requireAuth } = require('../middleware/auth');
const { requireGlobalRole, requireSiteRole } = require('../services/rbac');
const { handleValidationErrors, isValidSiteSlug } = require('../utils/validate');
const { getDb } = require('../adapters/DatabaseRegistry');
const logger = require('../utils/logger');

const router = express.Router();
router.use(requireAuth);

// GET /api/v1/sites
router.get('/', async (req, res, next) => {
  try {
    const sites = await getDb().getUserSites(req.user.userId);
    return res.json({ sites });
  } catch (err) { next(err); }
});

// POST /api/v1/sites
router.post('/',
  requireGlobalRole('ADMIN'),
  [
    body('name').isString().trim().isLength({ min: 1, max: 100 }),
    body('slug').isString().trim().custom((v) => {
      if (!isValidSiteSlug(v)) throw new Error('Slug: lowercase letters, numbers, hyphens only.');
      return true;
    }),
    body('domain').optional().isString().trim().isLength({ max: 253 }),
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const site = await getDb().createSite({
        id: uuidv4(),
        name: req.body.name,
        slug: req.body.slug,
        domain: req.body.domain || '',
        ownerId: req.user.userId,
      });
      logger.audit('SITE_CREATE', { userId: req.user.userId, siteId: site.id, slug: site.slug });
      return res.status(201).json({ site });
    } catch (err) { next(err); }
  }
);

// GET /api/v1/sites/:siteId
router.get('/:siteId',
  [param('siteId').isUUID()],
  handleValidationErrors,
  requireSiteRole('VIEWER'),
  async (req, res, next) => {
    try {
      const site = await getDb().getSiteById(req.params.siteId);
      if (!site) return res.status(404).json({ error: 'Site not found.' });
      return res.json({ site });
    } catch (err) { next(err); }
  }
);

// PATCH /api/v1/sites/:siteId
router.patch('/:siteId',
  [param('siteId').isUUID(),
   body('name').optional().isString().trim().isLength({ min: 1, max: 100 }),
   body('domain').optional().isString().trim().isLength({ max: 253 }),
   body('active').optional().isBoolean()],
  handleValidationErrors,
  requireSiteRole('ADMIN'),
  async (req, res, next) => {
    try {
      const updated = await getDb().updateSite(req.params.siteId, req.body);
      if (!updated) return res.status(404).json({ error: 'Site not found.' });
      logger.audit('SITE_UPDATE', { userId: req.user.userId, siteId: req.params.siteId });
      return res.json({ site: updated });
    } catch (err) { next(err); }
  }
);

// DELETE /api/v1/sites/:siteId
router.delete('/:siteId',
  [param('siteId').isUUID()],
  handleValidationErrors,
  requireSiteRole('OWNER'),
  async (req, res, next) => {
    try {
      await getDb().deleteSite(req.params.siteId);
      logger.audit('SITE_DELETE', { userId: req.user.userId, siteId: req.params.siteId });
      return res.json({ message: 'Site deleted.' });
    } catch (err) { next(err); }
  }
);

// GET /api/v1/sites/:siteId/members
router.get('/:siteId/members',
  [param('siteId').isUUID()], handleValidationErrors, requireSiteRole('ADMIN'),
  async (req, res, next) => {
    try {
      const members = await getDb().getSiteMembers(req.params.siteId);
      return res.json({ members });
    } catch (err) { next(err); }
  }
);

// POST /api/v1/sites/:siteId/members
router.post('/:siteId/members',
  [param('siteId').isUUID(),
   body('userId').isUUID(),
   body('role').isIn(['OWNER', 'ADMIN', 'ANALYST', 'VIEWER'])],
  handleValidationErrors,
  requireSiteRole('OWNER'),
  async (req, res, next) => {
    try {
      const access = await getDb().grantSiteAccess({ userId: req.body.userId, siteId: req.params.siteId, role: req.body.role });
      logger.audit('SITE_GRANT_ACCESS', { actorId: req.user.userId, targetUserId: req.body.userId, siteId: req.params.siteId, role: req.body.role });
      return res.status(201).json({ access });
    } catch (err) { next(err); }
  }
);

// DELETE /api/v1/sites/:siteId/members/:userId
router.delete('/:siteId/members/:userId',
  [param('siteId').isUUID(), param('userId').isUUID()],
  handleValidationErrors,
  requireSiteRole('OWNER'),
  async (req, res, next) => {
    try {
      if (req.params.userId === req.user.userId) return res.status(400).json({ error: 'Cannot revoke your own owner access.' });
      await getDb().revokeSiteAccess(req.params.userId, req.params.siteId);
      logger.audit('SITE_REVOKE_ACCESS', { actorId: req.user.userId, targetUserId: req.params.userId, siteId: req.params.siteId });
      return res.json({ message: 'Access revoked.' });
    } catch (err) { next(err); }
  }
);

// GET /api/v1/sites/:siteId/keys
router.get('/:siteId/keys',
  [param('siteId').isUUID()], handleValidationErrors, requireSiteRole('ADMIN'),
  async (req, res, next) => {
    try {
      const keys = await getDb().getSiteApiKeys(req.params.siteId);
      return res.json({ keys });
    } catch (err) { next(err); }
  }
);

// POST /api/v1/sites/:siteId/keys
router.post('/:siteId/keys',
  [param('siteId').isUUID(),
   body('label').optional().isString().trim().isLength({ max: 64 }),
   body('expiresInDays').optional().isInt({ min: 1, max: 365 })],
  handleValidationErrors,
  requireSiteRole('ADMIN'),
  async (req, res, next) => {
    try {
      const { rawKey, record } = await getDb().createApiKey({ siteId: req.params.siteId, label: req.body.label, expiresInDays: req.body.expiresInDays });
      logger.audit('API_KEY_CREATE', { userId: req.user.userId, siteId: req.params.siteId, keyId: record.id });
      return res.status(201).json({ rawKey, key: record, warning: 'Save this key — it will not be shown again.' });
    } catch (err) { next(err); }
  }
);

// DELETE /api/v1/sites/:siteId/keys/:keyId
router.delete('/:siteId/keys/:keyId',
  [param('siteId').isUUID(), param('keyId').isUUID()],
  handleValidationErrors,
  requireSiteRole('ADMIN'),
  async (req, res, next) => {
    try {
      const revoked = await getDb().revokeApiKey(req.params.keyId, req.params.siteId);
      if (!revoked) return res.status(404).json({ error: 'Key not found.' });
      logger.audit('API_KEY_REVOKE', { userId: req.user.userId, siteId: req.params.siteId, keyId: req.params.keyId });
      return res.json({ message: 'Key revoked.' });
    } catch (err) { next(err); }
  }
);

module.exports = router;
