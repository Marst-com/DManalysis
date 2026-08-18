'use strict';

/**
 * DatabaseAdapter — abstract interface.
 *
 * All analytics storage goes through this interface.
 * Backend code never calls Firebase or Supabase directly.
 * Swap adapters by changing one config line.
 *
 * Concrete adapters must implement every method.
 * Calling an unimplemented method throws NotImplementedError.
 */

class NotImplementedError extends Error {
  constructor(method) {
    super(`DatabaseAdapter: ${method}() not implemented.`);
    this.name = 'NotImplementedError';
    this.status = 500;
  }
}

class DatabaseAdapter {
  // ─── Health ──────────────────────────────────────────────────────────────
  /** Returns { ok: boolean, latencyMs: number } */
  async ping() { throw new NotImplementedError('ping'); }

  // ─── Sites ───────────────────────────────────────────────────────────────
  async createSite(site)            { throw new NotImplementedError('createSite'); }
  async getSiteById(id)             { throw new NotImplementedError('getSiteById'); }
  async getSiteBySlug(slug)         { throw new NotImplementedError('getSiteBySlug'); }
  async getUserSites(userId)        { throw new NotImplementedError('getUserSites'); }
  async updateSite(id, patch)       { throw new NotImplementedError('updateSite'); }
  async deleteSite(id)              { throw new NotImplementedError('deleteSite'); }

  // ─── Site Access (RBAC) ──────────────────────────────────────────────────
  async grantSiteAccess(record)           { throw new NotImplementedError('grantSiteAccess'); }
  async revokeSiteAccess(userId, siteId)  { throw new NotImplementedError('revokeSiteAccess'); }
  async getSiteAccess(userId, siteId)     { throw new NotImplementedError('getSiteAccess'); }
  async getSiteMembers(siteId)            { throw new NotImplementedError('getSiteMembers'); }

  // ─── API Keys ─────────────────────────────────────────────────────────────
  async createApiKey(record)              { throw new NotImplementedError('createApiKey'); }
  async lookupSiteByApiKey(keyHash)       { throw new NotImplementedError('lookupSiteByApiKey'); }
  async revokeApiKey(keyId, siteId)       { throw new NotImplementedError('revokeApiKey'); }
  async getSiteApiKeys(siteId)            { throw new NotImplementedError('getSiteApiKeys'); }

  // ─── Users ────────────────────────────────────────────────────────────────
  async createUser(user)                  { throw new NotImplementedError('createUser'); }
  async findUserByEmail(email)            { throw new NotImplementedError('findUserByEmail'); }
  async findUserById(id)                  { throw new NotImplementedError('findUserById'); }
  async updateUserRefreshToken(id, hash)  { throw new NotImplementedError('updateUserRefreshToken'); }

  // ─── Events ───────────────────────────────────────────────────────────────
  async insertEvent(event)                { throw new NotImplementedError('insertEvent'); }

  // ─── Analytics Queries ────────────────────────────────────────────────────
  async getEvents({ siteId, eventName, from, to, limit })
    { throw new NotImplementedError('getEvents'); }

  async getVisitorTimeSeries(siteId, fromMs, toMs)
    { throw new NotImplementedError('getVisitorTimeSeries'); }

  async getUniqueSessionCount(siteId, fromMs, toMs)
    { throw new NotImplementedError('getUniqueSessionCount'); }

  async getEventCounts(siteId, fromMs, toMs)
    { throw new NotImplementedError('getEventCounts'); }

  async getTotalEventCount(siteId)
    { throw new NotImplementedError('getTotalEventCount'); }
}

module.exports = { DatabaseAdapter, NotImplementedError };
