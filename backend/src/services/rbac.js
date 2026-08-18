'use strict';

const { getDb } = require('../adapters/DatabaseRegistry');

const ROLE_LEVELS = Object.freeze({ OWNER: 4, ADMIN: 3, ANALYST: 2, VIEWER: 1 });

function roleAtLeast(userRole, requiredRole) {
  return (ROLE_LEVELS[userRole] || 0) >= (ROLE_LEVELS[requiredRole] || 999);
}

function requireGlobalRole(minRole) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
    if (!roleAtLeast(req.user.role, minRole)) return res.status(403).json({ error: 'Insufficient permissions.' });
    next();
  };
}

function requireSiteRole(minRole = 'VIEWER') {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
    const siteId = req.params.siteId || req.body?.siteId;
    if (!siteId) return res.status(400).json({ error: 'siteId required.' });
    try {
      const access = await getDb().getSiteAccess(req.user.userId, siteId);
      if (!access) return res.status(403).json({ error: 'Access denied.' });
      if (!roleAtLeast(access.role, minRole)) return res.status(403).json({ error: 'Insufficient site permissions.' });
      req.siteAccess = access;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { ROLE_LEVELS, roleAtLeast, requireGlobalRole, requireSiteRole };
