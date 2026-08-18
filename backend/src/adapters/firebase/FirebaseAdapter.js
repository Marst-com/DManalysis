'use strict';

const { DatabaseAdapter } = require('../DatabaseAdapter');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');

/**
 * FirebaseAdapter — implements DatabaseAdapter using Firestore.
 *
 * Firestore collection layout:
 *   users/{userId}
 *   sites/{siteId}
 *   siteAccess/{userId_siteId}
 *   apiKeys/{keyHash}
 *   events/{siteId}/records/{eventId}
 *
 * Credentials: loaded from environment variables ONLY.
 * firebase-admin is initialized once and reused.
 */

class FirebaseAdapter extends DatabaseAdapter {
  constructor() {
    super();
    this._db = null;
    this._admin = null;
  }

  /**
   * Initialize firebase-admin from env vars.
   * Called once at startup via DatabaseRegistry.
   * Throws if required env vars are missing.
   */
  async connect() {
    const admin = require('firebase-admin');

    const projectId    = this._requireEnv('FIREBASE_PROJECT_ID');
    const clientEmail  = this._requireEnv('FIREBASE_CLIENT_EMAIL');
    // Handle both escaped \n and real newlines (Render env var variations)
    let privateKey = this._requireEnv('FIREBASE_PRIVATE_KEY');
    // Replace literal \n with real newlines if needed
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    // Avoid re-initializing if already done (hot reload safety)
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
        // databaseURL only needed for Realtime Database, not Firestore
      });
    }

    this._admin = admin;
    this._db = admin.firestore();

    // Verify connection
    await this.ping();
    logger.info('FirebaseAdapter connected', { projectId });
  }

  _requireEnv(name) {
    const val = process.env[name];
    if (!val) throw new Error(`[FirebaseAdapter] Missing env var: ${name}`);
    return val;
  }

  _db_() {
    if (!this._db) throw new Error('FirebaseAdapter not connected. Call connect() first.');
    return this._db;
  }

  // ─── Health ──────────────────────────────────────────────────────────────

  async ping() {
    const start = Date.now();
    try {
      // Lightweight Firestore connectivity check
      await this._db_().collection('_health').limit(1).get();
    } catch (err) {
      // Collection not existing is fine — just means DB is empty
      if (!err.code || err.code !== 5) { // 5 = NOT_FOUND is ok
        throw err;
      }
    }
    return { ok: true, latencyMs: Date.now() - start };
  }

  // ─── Users ───────────────────────────────────────────────────────────────

  async createUser({ id, email, passwordHash, role }) {
    const now = new Date().toISOString();
    const user = { id, email: email.toLowerCase(), passwordHash, role, active: true, createdAt: now, updatedAt: now, refreshTokenHash: null };
    await this._db_().collection('users').doc(id).set(user);
    return this._sanitizeUser(user);
  }

  async findUserByEmail(email) {
    const snap = await this._db_().collection('users')
      .where('email', '==', email.toLowerCase().trim())
      .limit(1)
      .get();
    if (snap.empty) return null;
    return snap.docs[0].data();
  }

  async findUserById(id) {
    const doc = await this._db_().collection('users').doc(id).get();
    return doc.exists ? doc.data() : null;
  }

  async updateUserRefreshToken(id, hash) {
    await this._db_().collection('users').doc(id).update({
      refreshTokenHash: hash,
      updatedAt: new Date().toISOString(),
    });
  }

  _sanitizeUser(user) {
    const { passwordHash, refreshTokenHash, ...safe } = user;
    return safe;
  }

  // ─── Sites ───────────────────────────────────────────────────────────────

  async createSite({ id, name, slug, domain, ownerId }) {
    // Check slug uniqueness
    const existing = await this.getSiteBySlug(slug);
    if (existing) throw Object.assign(new Error('Slug already in use.'), { status: 409 });

    const now = new Date().toISOString();
    const site = { id, name, slug, domain: domain || '', ownerId, active: true, createdAt: now, updatedAt: now };
    await this._db_().collection('sites').doc(id).set(site);

    // Auto-grant OWNER access
    await this.grantSiteAccess({ userId: ownerId, siteId: id, role: 'OWNER' });
    return site;
  }

  async getSiteById(id) {
    const doc = await this._db_().collection('sites').doc(id).get();
    return doc.exists ? doc.data() : null;
  }

  async getSiteBySlug(slug) {
    const snap = await this._db_().collection('sites')
      .where('slug', '==', slug)
      .limit(1)
      .get();
    return snap.empty ? null : snap.docs[0].data();
  }

  async getUserSites(userId) {
    // Get all access records for this user
    const snap = await this._db_().collection('siteAccess')
      .where('userId', '==', userId)
      .get();
    if (snap.empty) return [];

    // Fetch each site
    const siteIds = snap.docs.map((d) => d.data().siteId);
    const roleMap = Object.fromEntries(snap.docs.map((d) => [d.data().siteId, d.data().role]));

    // Firestore 'in' query: max 30 items per query
    const results = [];
    for (let i = 0; i < siteIds.length; i += 30) {
      const chunk = siteIds.slice(i, i + 30);
      const sitesSnap = await this._db_().collection('sites')
        .where('id', 'in', chunk)
        .get();
      sitesSnap.docs.forEach((d) => {
        results.push({ ...d.data(), accessRole: roleMap[d.data().id] });
      });
    }
    return results;
  }

  async updateSite(id, patch) {
    const allowed = {};
    if (patch.name !== undefined)   allowed.name = patch.name;
    if (patch.domain !== undefined) allowed.domain = patch.domain;
    if (patch.active !== undefined) allowed.active = patch.active;
    allowed.updatedAt = new Date().toISOString();
    await this._db_().collection('sites').doc(id).update(allowed);
    return this.getSiteById(id);
  }

  async deleteSite(id) {
    const db = this._db_();
    const batch = db.batch();
    batch.delete(db.collection('sites').doc(id));

    // Cascade: access records
    const accessSnap = await db.collection('siteAccess').where('siteId', '==', id).get();
    accessSnap.docs.forEach((d) => batch.delete(d.ref));

    // Cascade: api keys
    const keySnap = await db.collection('apiKeys').where('siteId', '==', id).get();
    keySnap.docs.forEach((d) => batch.delete(d.ref));

    await batch.commit();
    return true;
  }

  // ─── Site Access ─────────────────────────────────────────────────────────

  async grantSiteAccess({ userId, siteId, role }) {
    const key = `${userId}_${siteId}`;
    const record = { userId, siteId, role, grantedAt: new Date().toISOString() };
    await this._db_().collection('siteAccess').doc(key).set(record);
    return record;
  }

  async revokeSiteAccess(userId, siteId) {
    await this._db_().collection('siteAccess').doc(`${userId}_${siteId}`).delete();
    return true;
  }

  async getSiteAccess(userId, siteId) {
    const doc = await this._db_().collection('siteAccess').doc(`${userId}_${siteId}`).get();
    return doc.exists ? doc.data() : null;
  }

  async getSiteMembers(siteId) {
    const snap = await this._db_().collection('siteAccess').where('siteId', '==', siteId).get();
    return snap.docs.map((d) => d.data());
  }

  // ─── API Keys ─────────────────────────────────────────────────────────────

  async createApiKey({ siteId, label, expiresInDays }) {
    const raw = `dm_${uuidv4().replace(/-/g, '')}${uuidv4().replace(/-/g, '')}`;
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    const id = uuidv4();
    const now = new Date().toISOString();
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
      : null;

    const record = { id, siteId, keyHash: hash, label: label || 'Default', active: true, createdAt: now, expiresAt };
    // Store by hash as doc ID for O(1) lookup
    await this._db_().collection('apiKeys').doc(hash).set(record);
    return { rawKey: raw, record: this._sanitizeKey(record) };
  }

  async lookupSiteByApiKey(rawKey) {
    const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const doc = await this._db_().collection('apiKeys').doc(hash).get();
    if (!doc.exists) return null;

    const keyRecord = doc.data();
    if (!keyRecord.active) return null;
    if (keyRecord.expiresAt && new Date(keyRecord.expiresAt) < new Date()) return null;

    const site = await this.getSiteById(keyRecord.siteId);
    return site && site.active ? { ...site, keyId: keyRecord.id } : null;
  }

  async revokeApiKey(keyId, siteId) {
    const snap = await this._db_().collection('apiKeys')
      .where('id', '==', keyId)
      .where('siteId', '==', siteId)
      .limit(1)
      .get();
    if (snap.empty) return false;
    await snap.docs[0].ref.update({ active: false });
    return true;
  }

  async getSiteApiKeys(siteId) {
    const snap = await this._db_().collection('apiKeys')
      .where('siteId', '==', siteId)
      .get();
    return snap.docs.map((d) => this._sanitizeKey(d.data()));
  }

  _sanitizeKey(rec) {
    const { keyHash, ...safe } = rec;
    return safe;
  }

  // ─── Events ───────────────────────────────────────────────────────────────

  async insertEvent(event) {
    const id = uuidv4();
    const record = { ...event, id, receivedAt: new Date().toISOString() };
    // Sub-collection per site keeps queries fast and data isolated
    await this._db_()
      .collection('events')
      .doc(event.siteId)
      .collection('records')
      .doc(id)
      .set(record);
    return record;
  }

  // ─── Analytics Queries ────────────────────────────────────────────────────

  async getEvents({ siteId, eventName, from, to, limit = 100 }) {
    let q = this._db_()
      .collection('events').doc(siteId).collection('records')
      .orderBy('timestamp', 'desc')
      .limit(Math.min(limit, 1000));

    if (eventName) q = q.where('eventName', '==', eventName);
    if (from) q = q.where('timestamp', '>=', from);
    if (to) q = q.where('timestamp', '<=', to);

    const snap = await q.get();
    return snap.docs.map((d) => d.data());
  }

  async getVisitorTimeSeries(siteId, fromMs, toMs) {
    const snap = await this._db_()
      .collection('events').doc(siteId).collection('records')
      .where('timestamp', '>=', fromMs)
      .where('timestamp', '<=', toMs)
      .get();

    const buckets = {};
    snap.docs.forEach((d) => {
      const ts = d.data().timestamp;
      const hour = new Date(Math.floor(ts / 3_600_000) * 3_600_000).toISOString();
      buckets[hour] = (buckets[hour] || 0) + 1;
    });

    return Object.entries(buckets)
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour.localeCompare(b.hour));
  }

  async getUniqueSessionCount(siteId, fromMs, toMs) {
    const snap = await this._db_()
      .collection('events').doc(siteId).collection('records')
      .where('timestamp', '>=', fromMs)
      .where('timestamp', '<=', toMs)
      .select('sessionId')
      .get();

    const sessions = new Set(
      snap.docs.map((d) => d.data().sessionId).filter(Boolean)
    );
    return sessions.size;
  }

  async getEventCounts(siteId, fromMs, toMs) {
    const snap = await this._db_()
      .collection('events').doc(siteId).collection('records')
      .where('timestamp', '>=', fromMs)
      .where('timestamp', '<=', toMs)
      .select('eventName')
      .get();

    const counts = {};
    snap.docs.forEach((d) => {
      const name = d.data().eventName;
      counts[name] = (counts[name] || 0) + 1;
    });
    return counts;
  }

  async getTotalEventCount(siteId) {
    // Firestore doesn't have cheap COUNT — use aggregation query (v9.4+)
    try {
      const snap = await this._db_()
        .collection('events').doc(siteId).collection('records')
        .count()
        .get();
      return snap.data().count;
    } catch {
      // Fallback for older SDK versions
      const snap = await this._db_()
        .collection('events').doc(siteId).collection('records')
        .select()
        .get();
      return snap.size;
    }
  }
}

module.exports = FirebaseAdapter;

// Allow connecting with explicit credentials (for per-site adapters)
// instead of reading from process.env
FirebaseAdapter.prototype.connectWithCredentials = async function(credentials) {
  const admin = require('firebase-admin');
  const appName = `site-${require('crypto').randomBytes(4).toString('hex')}`;
  if (!admin.apps.find(a => a?.name === appName)) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId:   credentials.projectId,
        clientEmail: credentials.clientEmail,
        privateKey:  (credentials.privateKey || '').replace(/\\n/g, '\n'),
      }),
    }, appName);
  }
  const app = admin.app(appName);
  this._admin = admin;
  this._db = app.firestore();
  await this.ping();
};
