'use strict';

/**
 * Audit Log Store.
 * Records all significant actions: who, when, which site, what, success/fail.
 * Logs are append-only — never modified or deleted (integrity).
 *
 * In production: plugged into DB Adapter (Firestore/Supabase).
 * Here: in-memory ring buffer (last 10,000 entries per site).
 */

const { v4: uuidv4 } = require('uuid');

// Global log (cross-site, for OWNER)
const globalLog = [];
// Map<siteId, entry[]>
const siteLog = new Map();

const MAX_GLOBAL = 10_000;
const MAX_PER_SITE = 5_000;

/**
 * Append an audit entry.
 * Called by logger.audit() — not directly by routes.
 *
 * @param {object} entry
 *   { actorId, actorEmail, siteId, action, result, metadata }
 */
function append(entry) {
  const record = {
    id: uuidv4(),
    ts: new Date().toISOString(),
    actorId:    entry.actorId    || null,
    actorEmail: entry.actorEmail || null,
    siteId:     entry.siteId     || null,
    action:     entry.action,
    result:     entry.result     || 'SUCCESS',
    metadata:   entry.metadata   || {},
  };

  // Global ring buffer
  globalLog.push(record);
  if (globalLog.length > MAX_GLOBAL) globalLog.shift();

  // Per-site ring buffer
  if (record.siteId) {
    if (!siteLog.has(record.siteId)) siteLog.set(record.siteId, []);
    const sl = siteLog.get(record.siteId);
    sl.push(record);
    if (sl.length > MAX_PER_SITE) sl.shift();
  }

  return record;
}

/**
 * Query audit logs for a specific site.
 * @param {string} siteId
 * @param {{ limit, action, from, to }} opts
 */
function querySite(siteId, { limit = 50, action, from, to } = {}) {
  let entries = siteLog.get(siteId) || [];

  if (action) entries = entries.filter((e) => e.action === action);
  if (from)   entries = entries.filter((e) => e.ts >= from);
  if (to)     entries = entries.filter((e) => e.ts <= to);

  return entries
    .slice(-Math.min(limit, 500))
    .reverse(); // newest first
}

/**
 * Query global audit log (OWNER only).
 */
function queryGlobal({ limit = 100, action, actorId, siteId, from, to } = {}) {
  let entries = [...globalLog];

  if (action)  entries = entries.filter((e) => e.action === action);
  if (actorId) entries = entries.filter((e) => e.actorId === actorId);
  if (siteId)  entries = entries.filter((e) => e.siteId === siteId);
  if (from)    entries = entries.filter((e) => e.ts >= from);
  if (to)      entries = entries.filter((e) => e.ts <= to);

  return entries
    .slice(-Math.min(limit, 1000))
    .reverse();
}

module.exports = { append, querySite, queryGlobal };
