'use strict';

/**
 * MemoryAdapter — wraps the existing in-memory stores.
 * Used in development / testing when no real DB is configured.
 * Drop-in replacement: same interface as FirebaseAdapter.
 */

const { DatabaseAdapter } = require('./DatabaseAdapter');
const userStore = require('../services/userStore');
const siteStore = require('../services/siteStore');
const eventStore = require('../services/eventStore');
const crypto = require('crypto');

class MemoryAdapter extends DatabaseAdapter {
  async ping() {
    return { ok: true, latencyMs: 0 };
  }

  // ─── Users ───────────────────────────────────────────────────────────────

  async createUser({ id, email, passwordHash, role }) {
    return userStore.createUser({ id, email, passwordHash, role });
  }

  async findUserByEmail(email) {
    return userStore.findByEmail(email);
  }

  async findUserById(id) {
    return userStore.findById(id);
  }

  async updateUserRefreshToken(id, hash) {
    userStore.updateRefreshTokenHash(id, hash);
  }

  // ─── Sites ───────────────────────────────────────────────────────────────

  async createSite({ id, name, slug, domain, ownerId }) {
    return siteStore.createSite({ name, slug, domain, ownerId });
  }

  async getSiteById(id) {
    return siteStore.getSiteById(id);
  }

  async getSiteBySlug(slug) {
    return siteStore.getSiteBySlug(slug);
  }

  async getUserSites(userId) {
    return siteStore.getUserSites(userId);
  }

  async updateSite(id, patch) {
    return siteStore.updateSite(id, patch);
  }

  async deleteSite(id) {
    return siteStore.deleteSite(id);
  }

  // ─── Site Access ─────────────────────────────────────────────────────────

  async grantSiteAccess(record) {
    return siteStore.grantSiteAccess(record);
  }

  async revokeSiteAccess(userId, siteId) {
    return siteStore.revokeSiteAccess({ userId, siteId });
  }

  async getSiteAccess(userId, siteId) {
    return siteStore.getSiteAccess(userId, siteId);
  }

  async getSiteMembers(siteId) {
    return siteStore.getSiteMembers(siteId);
  }

  // ─── API Keys ─────────────────────────────────────────────────────────────

  async createApiKey({ siteId, label, expiresInDays }) {
    return siteStore.createApiKey({ siteId, label, expiresInDays });
  }

  async lookupSiteByApiKey(rawKey) {
    return siteStore.lookupSiteByApiKey(rawKey);
  }

  async revokeApiKey(keyId, siteId) {
    return siteStore.revokeApiKey(keyId, siteId);
  }

  async getSiteApiKeys(siteId) {
    return siteStore.getSiteApiKeys(siteId);
  }

  // ─── Events ───────────────────────────────────────────────────────────────

  async insertEvent(event) {
    return eventStore.insertEvent(event);
  }

  // ─── Analytics ────────────────────────────────────────────────────────────

  async getEvents(opts) {
    return eventStore.getEvents(opts);
  }

  async getVisitorTimeSeries(siteId, fromMs, toMs) {
    return eventStore.getVisitorTimeSeries(siteId, fromMs, toMs);
  }

  async getUniqueSessionCount(siteId, fromMs, toMs) {
    return eventStore.getUniqueSessionCount(siteId, fromMs, toMs);
  }

  async getEventCounts(siteId, fromMs, toMs) {
    return eventStore.getEventCounts(siteId, fromMs, toMs);
  }

  async getTotalEventCount(siteId) {
    return eventStore.getTotalEventCount(siteId);
  }
}

module.exports = MemoryAdapter;
