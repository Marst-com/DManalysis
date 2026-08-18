'use strict';

/**
 * In-memory event store. Replaced by DatabaseAdapter in STEP 7.
 *
 * Event: {
 *   id, siteId, eventName, sessionId,
 *   deviceCategory, browser, os, regionCoarse, referrer,
 *   timestamp, receivedAt, metadata
 * }
 */

const { v4: uuidv4 } = require('uuid');

// Array for time-ordered storage (DB will use indexed collection)
const events = [];

// Simple abuse tracker: Map<siteId, { count, windowStart }>
const abuseTracker = new Map();
const ABUSE_WINDOW_MS = 60_000;
const ABUSE_MAX_PER_WINDOW = 2000;

/**
 * Record an ingestion event.
 * All fields are sanitized BEFORE reaching here (in the route).
 */
function insertEvent(event) {
  const record = {
    id: uuidv4(),
    siteId: event.siteId,
    eventName: event.eventName,
    sessionId: event.sessionId || null,
    deviceCategory: event.deviceCategory || null,
    browser: event.browser || null,
    os: event.os || null,
    regionCoarse: event.regionCoarse || null,
    referrer: event.referrer || null,
    timestamp: event.timestamp,
    receivedAt: new Date().toISOString(),
    metadata: event.metadata || null,
  };
  events.push(record);
  return record;
}

/**
 * Check per-site event rate (abuse detection).
 * Returns true if within limit, false if exceeded.
 */
function checkAbuseLimit(siteId) {
  const now = Date.now();
  const tracker = abuseTracker.get(siteId);

  if (!tracker || now - tracker.windowStart > ABUSE_WINDOW_MS) {
    abuseTracker.set(siteId, { count: 1, windowStart: now });
    return true;
  }

  tracker.count += 1;
  if (tracker.count > ABUSE_MAX_PER_WINDOW) return false;
  return true;
}

/**
 * Get events for a site (with basic filters).
 * In DB layer this becomes a proper indexed query.
 */
function getEvents({ siteId, eventName, from, to, limit = 100 }) {
  return events
    .filter((e) => {
      if (e.siteId !== siteId) return false;
      if (eventName && e.eventName !== eventName) return false;
      if (from && e.timestamp < from) return false;
      if (to && e.timestamp > to) return false;
      return true;
    })
    .slice(-Math.min(limit, 1000)); // cap at 1000
}

/**
 * Aggregate visitor counts by hour for a site.
 */
function getVisitorTimeSeries(siteId, fromMs, toMs) {
  const buckets = {};
  for (const e of events) {
    if (e.siteId !== siteId) continue;
    const ts = new Date(e.timestamp).getTime();
    if (ts < fromMs || ts > toMs) continue;
    // Round to hour
    const hour = new Date(Math.floor(ts / 3_600_000) * 3_600_000).toISOString();
    buckets[hour] = (buckets[hour] || 0) + 1;
  }
  return Object.entries(buckets)
    .map(([hour, count]) => ({ hour, count }))
    .sort((a, b) => a.hour.localeCompare(b.hour));
}

/**
 * Count unique sessionIds for a site.
 */
function getUniqueSessionCount(siteId, fromMs, toMs) {
  const sessions = new Set();
  for (const e of events) {
    if (e.siteId !== siteId) continue;
    const ts = new Date(e.timestamp).getTime();
    if (ts < fromMs || ts > toMs) continue;
    if (e.sessionId) sessions.add(e.sessionId);
  }
  return sessions.size;
}

/**
 * Count events grouped by eventName for a site.
 */
function getEventCounts(siteId, fromMs, toMs) {
  const counts = {};
  for (const e of events) {
    if (e.siteId !== siteId) continue;
    const ts = new Date(e.timestamp).getTime();
    if (ts < fromMs || ts > toMs) continue;
    counts[e.eventName] = (counts[e.eventName] || 0) + 1;
  }
  return counts;
}

/**
 * Total event count for a site.
 */
function getTotalEventCount(siteId) {
  return events.filter((e) => e.siteId === siteId).length;
}

module.exports = {
  insertEvent,
  checkAbuseLimit,
  getEvents,
  getVisitorTimeSeries,
  getUniqueSessionCount,
  getEventCounts,
  getTotalEventCount,
};
