'use strict';

/**
 * In-memory site store. Replaced by DatabaseAdapter in STEP 7.
 *
 * Site: { id, name, slug, domain, ownerId, active, createdAt, updatedAt }
 * SiteAccess: { userId, siteId, role }  — per-site RBAC
 * ApiKey: { id, siteId, keyHash, label, active, createdAt, expiresAt }
 */

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// Map<siteId, site>
const sites = new Map();
// Map<slug, siteId>
const slugIndex = new Map();
// Map<`${userId}:${siteId}`, accessRecord>
const siteAccess = new Map();
// Map<keyHash, apiKeyRecord>
const apiKeys = new Map();
// Map<siteId, Set<keyHash>>  — reverse index
const siteKeyIndex = new Map();

// ─── Sites ────────────────────────────────────────────────────────────────

function createSite({ name, slug, domain, ownerId }) {
  if (slugIndex.has(slug)) {
    throw Object.assign(new Error('Slug already in use.'), { status: 409 });
  }
  const id = uuidv4();
  const now = new Date().toISOString();
  const site = { id, name, slug, domain: domain || '', ownerId, active: true, createdAt: now, updatedAt: now };
  sites.set(id, site);
  slugIndex.set(slug, id);

  // Owner automatically gets OWNER access on this site
  grantSiteAccess({ userId: ownerId, siteId: id, role: 'OWNER' });
  return site;
}

function getSiteById(id) {
  return sites.get(id) || null;
}

function getSiteBySlug(slug) {
  const id = slugIndex.get(slug);
  return id ? sites.get(id) || null : null;
}

function getSitesByOwner(ownerId) {
  return [...sites.values()].filter((s) => s.ownerId === ownerId);
}

function getAllSites() {
  return [...sites.values()];
}

function updateSite(id, patch) {
  const site = sites.get(id);
  if (!site) return null;
  const allowed = ['name', 'domain', 'active'];
  for (const key of allowed) {
    if (patch[key] !== undefined) site[key] = patch[key];
  }
  site.updatedAt = new Date().toISOString();
  return site;
}

function deleteSite(id) {
  const site = sites.get(id);
  if (!site) return false;
  sites.delete(id);
  slugIndex.delete(site.slug);
  // Cascade: remove access records and API keys
  for (const [k] of siteAccess) {
    if (k.endsWith(`:${id}`)) siteAccess.delete(k);
  }
  const keyHashes = siteKeyIndex.get(id);
  if (keyHashes) {
    for (const h of keyHashes) apiKeys.delete(h);
    siteKeyIndex.delete(id);
  }
  return true;
}

// ─── Site Access (per-site RBAC) ──────────────────────────────────────────

function grantSiteAccess({ userId, siteId, role }) {
  const key = `${userId}:${siteId}`;
  const record = { userId, siteId, role, grantedAt: new Date().toISOString() };
  siteAccess.set(key, record);
  return record;
}

function revokeSiteAccess({ userId, siteId }) {
  return siteAccess.delete(`${userId}:${siteId}`);
}

function getSiteAccess(userId, siteId) {
  return siteAccess.get(`${userId}:${siteId}`) || null;
}

function getSiteMembers(siteId) {
  return [...siteAccess.values()].filter((a) => a.siteId === siteId);
}

function getUserSites(userId) {
  return [...siteAccess.values()]
    .filter((a) => a.userId === userId)
    .map((a) => ({ ...sites.get(a.siteId), accessRole: a.role }))
    .filter(Boolean);
}

// ─── API Keys ─────────────────────────────────────────────────────────────

/**
 * Generate a new ingestion API key.
 * Returns { rawKey, record } — rawKey shown ONCE, never stored.
 * Only the SHA-256 hash is persisted.
 */
function createApiKey({ siteId, label, expiresInDays }) {
  const raw = `dm_${uuidv4().replace(/-/g, '')}${uuidv4().replace(/-/g, '')}`;
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const id = uuidv4();
  const now = new Date().toISOString();
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
    : null;

  const record = { id, siteId, keyHash: hash, label: label || 'Default', active: true, createdAt: now, expiresAt };
  apiKeys.set(hash, record);

  if (!siteKeyIndex.has(siteId)) siteKeyIndex.set(siteId, new Set());
  siteKeyIndex.get(siteId).add(hash);

  return { rawKey: raw, record: sanitizeKey(record) };
}

function lookupSiteByApiKey(rawKey) {
  const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const keyRecord = apiKeys.get(hash);
  if (!keyRecord || !keyRecord.active) return null;
  if (keyRecord.expiresAt && new Date(keyRecord.expiresAt) < new Date()) return null;
  const site = sites.get(keyRecord.siteId);
  return site && site.active ? { ...site, keyId: keyRecord.id } : null;
}

function revokeApiKey(keyId, siteId) {
  for (const [hash, rec] of apiKeys) {
    if (rec.id === keyId && rec.siteId === siteId) {
      rec.active = false;
      return true;
    }
  }
  return false;
}

function getSiteApiKeys(siteId) {
  const hashes = siteKeyIndex.get(siteId) || new Set();
  return [...hashes].map((h) => apiKeys.get(h)).filter(Boolean).map(sanitizeKey);
}

function sanitizeKey(rec) {
  // Never return keyHash to callers
  const { keyHash, ...safe } = rec;
  return safe;
}

module.exports = {
  createSite, getSiteById, getSiteBySlug, getSitesByOwner, getAllSites, updateSite, deleteSite,
  grantSiteAccess, revokeSiteAccess, getSiteAccess, getSiteMembers, getUserSites,
  createApiKey, lookupSiteByApiKey, revokeApiKey, getSiteApiKeys,
};
