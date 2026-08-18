'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { requireSiteRole } = require('../services/rbac');
const { handleValidationErrors } = require('../utils/validate');
const siteSecretStore = require('../services/siteSecretStore');
const siteAdapterRegistry = require('../adapters/SiteAdapterRegistry');
const logger = require('../utils/logger');

const router = express.Router({ mergeParams: true });
router.use(requireAuth);

// ─── Secrets ──────────────────────────────────────────────────────────────

// GET /api/v1/sites/:siteId/secrets  — list (metadata only, no values)
router.get('/secrets',
  [param('siteId').isUUID()],
  handleValidationErrors,
  requireSiteRole('ADMIN'),
  (req, res) => {
    const secrets = siteSecretStore.listSecrets(req.params.siteId);
    // Double-check: strip any field that looks like a value
    const safe = secrets.map(({ id, siteId, placeholder, label, createdAt, updatedAt }) => ({
      id, siteId, placeholder, label, createdAt, updatedAt,
    }));
    return res.json({ secrets: safe });
  }
);

// PUT /api/v1/sites/:siteId/secrets/:placeholder  — create or update
router.put('/secrets/:placeholder',
  [
    param('siteId').isUUID(),
    // Placeholder validated in siteSecretStore — extra check here too
    param('placeholder').matches(/^[A-Z0-9_]{1,64}$/).withMessage('Placeholder: uppercase letters, numbers, underscores only.'),
    body('value').isString().isLength({ min: 1, max: 4096 }).withMessage('Secret value required (max 4096).'),
    body('label').optional().isString().trim().isLength({ max: 64 }),
  ],
  handleValidationErrors,
  requireSiteRole('ADMIN'),
  (req, res) => {
    try {
      siteSecretStore.setSecret(
        req.params.siteId,
        req.params.placeholder,
        req.body.value,
        req.body.label,
      );
      logger.audit('SITE_SECRET_SET', {
        userId: req.user.userId,
        siteId: req.params.siteId,
        placeholder: req.params.placeholder,
        // Never log the value
      });
      return res.json({ message: 'Secret saved.', placeholder: req.params.placeholder });
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }
  }
);

// DELETE /api/v1/sites/:siteId/secrets/:placeholder
router.delete('/secrets/:placeholder',
  [param('siteId').isUUID(), param('placeholder').matches(/^[A-Z0-9_]{1,64}$/)],
  handleValidationErrors,
  requireSiteRole('ADMIN'),
  (req, res) => {
    const deleted = siteSecretStore.deleteSecret(req.params.siteId, req.params.placeholder);
    if (!deleted) return res.status(404).json({ error: 'Secret not found.' });
    logger.audit('SITE_SECRET_DELETE', { userId: req.user.userId, siteId: req.params.siteId, placeholder: req.params.placeholder });
    return res.json({ message: 'Secret deleted.' });
  }
);

// POST /api/v1/sites/:siteId/secrets/resolve  — server-side resolve test (OWNER only)
// Resolves a placeholder to confirm it works. Result logged but NOT returned to client.
router.post('/secrets/resolve',
  [
    param('siteId').isUUID(),
    body('placeholder').matches(/^[A-Z0-9_]{1,64}$/),
  ],
  handleValidationErrors,
  requireSiteRole('OWNER'),
  (req, res) => {
    const value = siteSecretStore.resolveSecret(req.params.siteId, req.body.placeholder);
    // Never return the real value — only confirm it exists
    if (value === null) return res.status(404).json({ error: 'Placeholder not found.' });
    logger.audit('SITE_SECRET_RESOLVE_TEST', { userId: req.user.userId, siteId: req.params.siteId, placeholder: req.body.placeholder });
    return res.json({ resolved: true, placeholder: req.body.placeholder, hint: `${value.slice(0, 4)}...` });
  }
);

// ─── Site DB Config ───────────────────────────────────────────────────────

// GET /api/v1/sites/:siteId/db-config  — metadata only
router.get('/db-config',
  [param('siteId').isUUID()],
  handleValidationErrors,
  requireSiteRole('ADMIN'),
  (req, res) => {
    const meta = siteAdapterRegistry.getSiteDbConfigMeta(req.params.siteId);
    return res.json({ config: meta });
  }
);

// PUT /api/v1/sites/:siteId/db-config
router.put('/db-config',
  [
    param('siteId').isUUID(),
    body('type').isIn(['firebase', 'supabase', 'memory']).withMessage('type must be firebase, supabase, or memory.'),
    body('credentials').isObject().withMessage('credentials object required.'),
  ],
  handleValidationErrors,
  requireSiteRole('OWNER'),
  async (req, res) => {
    try {
      // Validate credentials shape per type (no actual connection test here — lazy init)
      const { type, credentials } = req.body;
      _validateCredentials(type, credentials);

      siteAdapterRegistry.setSiteDbConfig(req.params.siteId, type, credentials);
      logger.audit('SITE_DB_CONFIG_SET', { userId: req.user.userId, siteId: req.params.siteId, type });
      return res.json({ message: 'DB config saved.', type });
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }
  }
);

// DELETE /api/v1/sites/:siteId/db-config
router.delete('/db-config',
  [param('siteId').isUUID()],
  handleValidationErrors,
  requireSiteRole('OWNER'),
  (req, res) => {
    siteAdapterRegistry.removeSiteDbConfig(req.params.siteId);
    return res.json({ message: 'Site DB config removed. Platform default will be used.' });
  }
);

// ─── Helpers ──────────────────────────────────────────────────────────────

function _validateCredentials(type, creds) {
  if (type === 'firebase') {
    const required = ['projectId', 'clientEmail', 'privateKey'];
    for (const key of required) {
      if (!creds[key] || typeof creds[key] !== 'string') {
        throw Object.assign(new Error(`Firebase credentials missing: ${key}`), { status: 400 });
      }
    }
  } else if (type === 'supabase') {
    const required = ['url', 'serviceRoleKey'];
    for (const key of required) {
      if (!creds[key] || typeof creds[key] !== 'string') {
        throw Object.assign(new Error(`Supabase credentials missing: ${key}`), { status: 400 });
      }
    }
  }
  // 'memory' needs no credentials
}

module.exports = router;
