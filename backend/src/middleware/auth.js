'use strict';

const jwt = require('jsonwebtoken');
const securityConfig = require('../config/security');
const logger = require('../utils/logger');

/**
 * Roles hierarchy
 */
const ROLES = Object.freeze({
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  ANALYST: 'ANALYST',
  VIEWER: 'VIEWER',
});

const ROLE_LEVELS = {
  [ROLES.OWNER]: 4,
  [ROLES.ADMIN]: 3,
  [ROLES.ANALYST]: 2,
  [ROLES.VIEWER]: 1,
};

/**
 * Verify JWT access token from Authorization: Bearer <token> header.
 * Attaches decoded payload to req.user.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, securityConfig.jwt.secret, {
      algorithms: ['HS256'],
    });

    // Ensure required fields exist in token
    if (!decoded.userId || !decoded.role) {
      return res.status(401).json({ error: 'Invalid token structure.' });
    }

    req.user = {
      userId: decoded.userId,
      role: decoded.role,
      email: decoded.email,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    logger.warn('JWT verification failed', { reason: err.name });
    return res.status(401).json({ error: 'Invalid authentication token.' });
  }
}

/**
 * Require a minimum role level.
 * Usage: requireRole('ADMIN')
 */
function requireRole(minimumRole) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const userLevel = ROLE_LEVELS[req.user.role] || 0;
    const requiredLevel = ROLE_LEVELS[minimumRole] || 999;

    if (userLevel < requiredLevel) {
      logger.warn('Authorization denied: insufficient role', {
        userId: req.user.userId,
        userRole: req.user.role,
        requiredRole: minimumRole,
        path: req.path,
      });
      return res.status(403).json({ error: 'Insufficient permissions.' });
    }

    next();
  };
}

/**
 * Validate analytics ingestion API key.
 * Public ingestion key ≠ admin key.
 * Attach site info to req.site.
 *
 * NOTE: Actual key lookup against DB is injected via siteService.
 * This middleware calls the passed lookup function.
 */
function requireIngestionKey(lookupSiteByApiKey) {
  return async (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 10) {
      return res.status(401).json({ error: 'Valid API key required.' });
    }

    try {
      const site = await lookupSiteByApiKey(apiKey);
      if (!site || !site.active) {
        return res.status(401).json({ error: 'Invalid or inactive API key.' });
      }
      req.site = site;
      next();
    } catch (err) {
      logger.error('API key lookup failed', { error: err.message });
      return res.status(401).json({ error: 'Authentication failed.' });
    }
  };
}

/**
 * Verify that req.user has access to the requested site.
 * Prevents IDOR / Broken Access Control.
 *
 * siteId is read from req.params.siteId or req.body.siteId.
 * lookupUserSiteAccess(userId, siteId) must return the access record or null.
 */
function requireSiteAccess(lookupUserSiteAccess) {
  return async (req, res, next) => {
    const siteId = req.params.siteId || req.body.siteId;
    if (!siteId) {
      return res.status(400).json({ error: 'Site ID required.' });
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    // OWNER role bypasses site-level check only for their own sites
    // (site ownership is still verified in the service layer)
    try {
      const access = await lookupUserSiteAccess(req.user.userId, siteId);
      if (!access) {
        // Do not reveal whether the site exists
        return res.status(403).json({ error: 'Access denied.' });
      }
      req.siteAccess = access;
      next();
    } catch (err) {
      logger.error('Site access check failed', { error: err.message });
      return res.status(403).json({ error: 'Access denied.' });
    }
  };
}

module.exports = {
  ROLES,
  ROLE_LEVELS,
  requireAuth,
  requireRole,
  requireIngestionKey,
  requireSiteAccess,
};
