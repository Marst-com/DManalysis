'use strict';

const { DatabaseAdapter } = require('../DatabaseAdapter');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');

/**
 * SupabaseAdapter — implements DatabaseAdapter using Supabase (PostgreSQL).
 *
 * Required env vars:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   ← Backend only. Never expose to frontend.
 *
 * Table layout:
 *   users, sites, site_access, api_keys, events
 */

class SupabaseAdapter extends DatabaseAdapter {
  constructor() {
    super();
    this._client = null;
  }

  async connect() {
    const { createClient } = require('@supabase/supabase-js');

    const url = this._requireEnv('SUPABASE_URL');
    const key = this._requireEnv('SUPABASE_SERVICE_ROLE_KEY');

    // service_role key — server-side only, bypasses RLS
    this._client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    await this.ping();
    logger.info('SupabaseAdapter connected', { url });
  }

  _requireEnv(name) {
    const val = process.env[name];
    if (!val) throw new Error(`[SupabaseAdapter] Missing env var: ${name}`);
    return val;
  }

  _db() {
    if (!this._client) throw new Error('SupabaseAdapter not connected.');
    return this._client;
  }

  async _check(res) {
    if (res.error) throw Object.assign(new Error(res.error.message), { status: 500 });
    return res.data;
  }

  // ─── Health ──────────────────────────────────────────────────────────────

  async ping() {
    const start = Date.now();
    await this._check(await this._db().from('users').select('id').limit(1));
    return { ok: true, latencyMs: Date.now() - start };
  }

  // ─── Users ───────────────────────────────────────────────────────────────

  async createUser({ id, email, passwordHash, role }) {
    const now = new Date().toISOString();
    const user = { id, email: email.toLowerCase(), password_hash: passwordHash, role, active: true, created_at: now, updated_at: now, refresh_token_hash: null };
    await this._check(await this._db().from('users').insert(user));
    return this._sanitizeUser({ ...user, passwordHash, refreshTokenHash: null });
  }

  async findUserByEmail(email) {
    const data = await this._check(await this._db().from('users').select('*').eq('email', email.toLowerCase().trim()).limit(1));
    if (!data?.length) return null;
    return this._mapUser(data[0]);
  }

  async findUserById(id) {
    const data = await this._check(await this._db().from('users').select('*').eq('id', id).limit(1));
    if (!data?.length) return null;
    return this._mapUser(data[0]);
  }

  async updateUserRefreshToken(id, hash) {
    await this._check(await this._db().from('users').update({ refresh_token_hash: hash, updated_at: new Date().toISOString() }).eq('id', id));
  }

  _mapUser(row) {
    return {
      id: row.id, email: row.email,
      passwordHash: row.password_hash,
      refreshTokenHash: row.refresh_token_hash,
      role: row.role, active: row.active,
      createdAt: row.created_at, updatedAt: row.updated_at,
    };
  }

  _sanitizeUser(user) {
    const { passwordHash, refreshTokenHash, ...safe } = user;
    return safe;
  }

  // ─── Sites ───────────────────────────────────────────────────────────────

  async createSite({ id, name, slug, domain, ownerId }) {
    const existing = await this.getSiteBySlug(slug);
    if (existing) throw Object.assign(new Error('Slug already in use.'), { status: 409 });
    const now = new Date().toISOString();
    const site = { id, name, slug, domain: domain || '', owner_id: ownerId, active: true, created_at: now, updated_at: now };
    await this._check(await this._db().from('sites').insert(site));
    await this.grantSiteAccess({ userId: ownerId, siteId: id, role: 'OWNER' });
    return this._mapSite(site);
  }

  async getSiteById(id) {
    const data = await this._check(await this._db().from('sites').select('*').eq('id', id).limit(1));
    return data?.length ? this._mapSite(data[0]) : null;
  }

  async getSiteBySlug(slug) {
    const data = await this._check(await this._db().from('sites').select('*').eq('slug', slug).limit(1));
    return data?.length ? this._mapSite(data[0]) : null;
  }

  async getUserSites(userId) {
    const access = await this._check(await this._db().from('site_access').select('site_id, role').eq('user_id', userId));
    if (!access?.length) return [];
    const siteIds = access.map((a) => a.site_id);
    const roleMap = Object.fromEntries(access.map((a) => [a.site_id, a.role]));
    const sites = await this._check(await this._db().from('sites').select('*').in('id', siteIds));
    return (sites || []).map((s) => ({ ...this._mapSite(s), accessRole: roleMap[s.id] }));
  }

  async updateSite(id, patch) {
    const allowed = {};
    if (patch.name !== undefined)   allowed.name = patch.name;
    if (patch.domain !== undefined) allowed.domain = patch.domain;
    if (patch.active !== undefined) allowed.active = patch.active;
    allowed.updated_at = new Date().toISOString();
    await this._check(await this._db().from('sites').update(allowed).eq('id', id));
    return this.getSiteById(id);
  }

  async deleteSite(id) {
    await this._check(await this._db().from('site_access').delete().eq('site_id', id));
    await this._check(await this._db().from('api_keys').delete().eq('site_id', id));
    await this._check(await this._db().from('events').delete().eq('site_id', id));
    await this._check(await this._db().from('sites').delete().eq('id', id));
    return true;
  }

  _mapSite(row) {
    return {
      id: row.id, name: row.name, slug: row.slug,
      domain: row.domain, ownerId: row.owner_id,
      active: row.active, createdAt: row.created_at, updatedAt: row.updated_at,
    };
  }

  // ─── Site Access ─────────────────────────────────────────────────────────

  async grantSiteAccess({ userId, siteId, role }) {
    const now = new Date().toISOString();
    const record = { user_id: userId, site_id: siteId, role, granted_at: now };
    await this._check(await this._db().from('site_access').upsert(record, { onConflict: 'user_id,site_id' }));
    return { userId, siteId, role, grantedAt: now };
  }

  async revokeSiteAccess(userId, siteId) {
    await this._check(await this._db().from('site_access').delete().eq('user_id', userId).eq('site_id', siteId));
    return true;
  }

  async getSiteAccess(userId, siteId) {
    const data = await this._check(await this._db().from('site_access').select('*').eq('user_id', userId).eq('site_id', siteId).limit(1));
    if (!data?.length) return null;
    return { userId: data[0].user_id, siteId: data[0].site_id, role: data[0].role, grantedAt: data[0].granted_at };
  }

  async getSiteMembers(siteId) {
    const data = await this._check(await this._db().from('site_access').select('*').eq('site_id', siteId));
    return (data || []).map((r) => ({ userId: r.user_id, siteId: r.site_id, role: r.role, grantedAt: r.granted_at }));
  }

  // ─── API Keys ─────────────────────────────────────────────────────────────

  async createApiKey({ siteId, label, expiresInDays }) {
    const raw = `dm_${uuidv4().replace(/-/g, '')}${uuidv4().replace(/-/g, '')}`;
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    const id = uuidv4();
    const now = new Date().toISOString();
    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 86400000).toISOString() : null;
    const record = { id, site_id: siteId, key_hash: hash, label: label || 'Default', active: true, created_at: now, expires_at: expiresAt };
    await this._check(await this._db().from('api_keys').insert(record));
    return { rawKey: raw, record: { id, siteId, label: record.label, active: true, createdAt: now, expiresAt } };
  }

  async lookupSiteByApiKey(rawKey) {
    const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const data = await this._check(await this._db().from('api_keys').select('*').eq('key_hash', hash).limit(1));
    if (!data?.length) return null;
    const keyRecord = data[0];
    if (!keyRecord.active) return null;
    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) return null;
    const site = await this.getSiteById(keyRecord.site_id);
    return site && site.active ? { ...site, keyId: keyRecord.id } : null;
  }

  async revokeApiKey(keyId, siteId) {
    const res = await this._db().from('api_keys').update({ active: false }).eq('id', keyId).eq('site_id', siteId);
    await this._check(res);
    return true;
  }

  async getSiteApiKeys(siteId) {
    const data = await this._check(await this._db().from('api_keys').select('id, site_id, label, active, created_at, expires_at').eq('site_id', siteId));
    return (data || []).map((r) => ({ id: r.id, siteId: r.site_id, label: r.label, active: r.active, createdAt: r.created_at, expiresAt: r.expires_at }));
  }

  // ─── Events ───────────────────────────────────────────────────────────────

  async insertEvent(event) {
    const id = uuidv4();
    const now = new Date().toISOString();
    const row = {
      id, site_id: event.siteId, event_name: event.eventName,
      session_id: event.sessionId, device_category: event.deviceCategory,
      browser: event.browser, os: event.os,
      region_coarse: event.regionCoarse, referrer: event.referrer,
      timestamp: event.timestamp, received_at: now,
      metadata: event.metadata ? JSON.stringify(event.metadata) : null,
    };
    await this._check(await this._db().from('events').insert(row));
    return { ...event, id, receivedAt: now };
  }

  // ─── Analytics ────────────────────────────────────────────────────────────

  async getEvents({ siteId, eventName, from, to, limit = 100 }) {
    let q = this._db().from('events').select('*').eq('site_id', siteId).order('timestamp', { ascending: false }).limit(Math.min(limit, 1000));
    if (eventName) q = q.eq('event_name', eventName);
    if (from) q = q.gte('timestamp', from);
    if (to) q = q.lte('timestamp', to);
    const data = await this._check(await q);
    return (data || []).map(this._mapEvent);
  }

  async getVisitorTimeSeries(siteId, fromMs, toMs) {
    const data = await this._check(await this._db().from('events').select('timestamp').eq('site_id', siteId).gte('timestamp', fromMs).lte('timestamp', toMs));
    const buckets = {};
    (data || []).forEach(({ timestamp }) => {
      const hour = new Date(Math.floor(timestamp / 3_600_000) * 3_600_000).toISOString();
      buckets[hour] = (buckets[hour] || 0) + 1;
    });
    return Object.entries(buckets).map(([hour, count]) => ({ hour, count })).sort((a, b) => a.hour.localeCompare(b.hour));
  }

  async getUniqueSessionCount(siteId, fromMs, toMs) {
    const data = await this._check(await this._db().from('events').select('session_id').eq('site_id', siteId).gte('timestamp', fromMs).lte('timestamp', toMs).not('session_id', 'is', null));
    return new Set((data || []).map((r) => r.session_id)).size;
  }

  async getEventCounts(siteId, fromMs, toMs) {
    const data = await this._check(await this._db().from('events').select('event_name').eq('site_id', siteId).gte('timestamp', fromMs).lte('timestamp', toMs));
    const counts = {};
    (data || []).forEach(({ event_name }) => { counts[event_name] = (counts[event_name] || 0) + 1; });
    return counts;
  }

  async getTotalEventCount(siteId) {
    const data = await this._check(await this._db().from('events').select('id', { count: 'exact', head: true }).eq('site_id', siteId));
    return data?.count ?? 0;
  }

  _mapEvent(row) {
    return {
      id: row.id, siteId: row.site_id, eventName: row.event_name,
      sessionId: row.session_id, deviceCategory: row.device_category,
      browser: row.browser, os: row.os, regionCoarse: row.region_coarse,
      referrer: row.referrer, timestamp: row.timestamp, receivedAt: row.received_at,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
    };
  }
}

module.exports = SupabaseAdapter;

// Allow connecting with explicit credentials (for per-site adapters)
SupabaseAdapter.prototype.connectWithCredentials = async function(credentials) {
  const { createClient } = require('@supabase/supabase-js');
  this._client = createClient(credentials.url, credentials.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await this.ping();
};
