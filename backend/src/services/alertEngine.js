'use strict';

/**
 * Alert Engine.
 *
 * Users define rules per site. Engine evaluates rules on a schedule
 * and triggers notifications (Dashboard, Email, Webhook).
 *
 * Security:
 *   - Webhook calls use HMAC signature (replay protection)
 *   - Webhook URL validated (SSRF protection — no private IPs)
 *   - Alert payloads never include raw secrets
 *   - Rules are DATA only — never eval'd
 */

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const logger = require('../utils/logger');

// Map<siteId, Map<ruleId, rule>>
const rules = new Map();
// Map<siteId, alert[]>  — recent triggered alerts
const alertHistory = new Map();
const MAX_HISTORY = 100;

// ─── Rule management ──────────────────────────────────────────────────────

const VALID_METRICS = new Set([
  'visitors', 'events', 'error_rate', 'unique_sessions',
]);
const VALID_OPERATORS = new Set(['>', '<', '>=', '<=', '==']);
const VALID_CHANNELS = new Set(['dashboard', 'webhook']);

function createRule(siteId, { name, metric, operator, threshold, windowMinutes, channels, webhookUrl }) {
  _validateRule({ metric, operator, threshold, windowMinutes, channels, webhookUrl });

  const id = uuidv4();
  const now = new Date().toISOString();
  const rule = {
    id, siteId, name: String(name).slice(0, 100),
    metric, operator, threshold, windowMinutes,
    channels: channels.filter((c) => VALID_CHANNELS.has(c)),
    webhookUrl: webhookUrl || null,
    active: true, createdAt: now, updatedAt: now,
    lastTriggeredAt: null,
  };

  if (!rules.has(siteId)) rules.set(siteId, new Map());
  rules.get(siteId).set(id, rule);
  return rule;
}

function getRules(siteId) {
  return [...(rules.get(siteId)?.values() || [])];
}

function updateRule(siteId, ruleId, patch) {
  const rule = rules.get(siteId)?.get(ruleId);
  if (!rule) throw Object.assign(new Error('Rule not found.'), { status: 404 });
  if (patch.name !== undefined) rule.name = String(patch.name).slice(0, 100);
  if (patch.active !== undefined) rule.active = Boolean(patch.active);
  if (patch.threshold !== undefined) rule.threshold = Number(patch.threshold);
  rule.updatedAt = new Date().toISOString();
  return rule;
}

function deleteRule(siteId, ruleId) {
  return rules.get(siteId)?.delete(ruleId) ?? false;
}

function getAlertHistory(siteId, limit = 50) {
  const history = alertHistory.get(siteId) || [];
  return history.slice(-Math.min(limit, MAX_HISTORY));
}

// ─── Evaluation ───────────────────────────────────────────────────────────

/**
 * Evaluate all active rules for a site.
 * Called periodically by the scheduler.
 */
async function evaluateRules(siteId, getMetricFn) {
  const siteRules = rules.get(siteId);
  if (!siteRules) return;

  for (const rule of siteRules.values()) {
    if (!rule.active) continue;
    try {
      const value = await getMetricFn(rule.metric, rule.windowMinutes);
      const triggered = _evaluate(value, rule.operator, rule.threshold);
      if (triggered) await _triggerAlert(rule, value);
    } catch (err) {
      logger.error('ALERT_EVAL_ERROR', { siteId, ruleId: rule.id, error: err.message });
    }
  }
}

function _evaluate(value, operator, threshold) {
  switch (operator) {
    case '>':  return value > threshold;
    case '<':  return value < threshold;
    case '>=': return value >= threshold;
    case '<=': return value <= threshold;
    case '==': return value === threshold;
    default:   return false;
  }
}

async function _triggerAlert(rule, value) {
  const alert = {
    id: uuidv4(),
    ruleId: rule.id,
    siteId: rule.siteId,
    ruleName: rule.name,
    metric: rule.metric,
    operator: rule.operator,
    threshold: rule.threshold,
    actualValue: value,
    triggeredAt: new Date().toISOString(),
    channels: rule.channels,
  };

  // Store in history
  if (!alertHistory.has(rule.siteId)) alertHistory.set(rule.siteId, []);
  const history = alertHistory.get(rule.siteId);
  history.push(alert);
  if (history.length > MAX_HISTORY) history.shift();

  rule.lastTriggeredAt = alert.triggeredAt;

  logger.audit('ALERT_TRIGGERED', {
    siteId: rule.siteId, ruleId: rule.id, ruleName: rule.name,
    metric: rule.metric, actualValue: value, threshold: rule.threshold,
  });

  // Send to channels
  for (const channel of rule.channels) {
    if (channel === 'webhook' && rule.webhookUrl) {
      await _sendWebhook(rule.webhookUrl, alert).catch((err) => {
        logger.error('WEBHOOK_SEND_FAILED', { ruleId: rule.id, error: err.message });
      });
    }
    // 'dashboard' channel: stored in history above (frontend polls)
  }
}

// ─── Webhook (secure) ─────────────────────────────────────────────────────

const PRIVATE_IP_REGEX = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.|localhost|::1|0\.0\.0\.0)/i;

async function _sendWebhook(url, payload) {
  // SSRF protection: reject private/loopback URLs
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid webhook URL.');
  }

  if (parsed.protocol !== 'https:') throw new Error('Webhook URL must use HTTPS.');
  if (PRIVATE_IP_REGEX.test(parsed.hostname)) throw new Error('Webhook URL must not point to private network.');

  const body = JSON.stringify({
    event: 'alert.triggered',
    timestamp: Date.now(),
    data: {
      ruleId: payload.ruleId,
      ruleName: payload.ruleName,
      metric: payload.metric,
      actualValue: payload.actualValue,
      threshold: payload.threshold,
      triggeredAt: payload.triggeredAt,
    },
  });

  // HMAC signature for webhook authenticity
  const webhookSecret = process.env.WEBHOOK_SECRET || 'default-insecure-secret-replace-me';
  const sig = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-DuoMarst-Signature': `sha256=${sig}`,
      'X-DuoMarst-Timestamp': String(Date.now()),
    },
    body,
    signal: AbortSignal.timeout(10_000), // 10s timeout
  });

  if (!res.ok) throw new Error(`Webhook responded with ${res.status}`);
}

// ─── Validation ───────────────────────────────────────────────────────────

function _validateRule({ metric, operator, threshold, windowMinutes, channels, webhookUrl }) {
  if (!VALID_METRICS.has(metric)) throw Object.assign(new Error(`Invalid metric: ${metric}`), { status: 400 });
  if (!VALID_OPERATORS.has(operator)) throw Object.assign(new Error(`Invalid operator: ${operator}`), { status: 400 });
  if (typeof threshold !== 'number' || threshold < 0) throw Object.assign(new Error('threshold must be a non-negative number.'), { status: 400 });
  if (!Number.isInteger(windowMinutes) || windowMinutes < 1 || windowMinutes > 1440) {
    throw Object.assign(new Error('windowMinutes must be 1–1440.'), { status: 400 });
  }
  if (!Array.isArray(channels) || channels.length === 0) throw Object.assign(new Error('At least one channel required.'), { status: 400 });
  if (channels.includes('webhook')) {
    if (!webhookUrl) throw Object.assign(new Error('webhookUrl required when channel includes webhook.'), { status: 400 });
    let parsed;
    try { parsed = new URL(webhookUrl); } catch { throw Object.assign(new Error('Invalid webhookUrl.'), { status: 400 }); }
    if (parsed.protocol !== 'https:') throw Object.assign(new Error('Webhook URL must use HTTPS.'), { status: 400 });
    if (PRIVATE_IP_REGEX.test(parsed.hostname)) throw Object.assign(new Error('Webhook URL must not point to private network.'), { status: 400 });
  }
}

module.exports = { createRule, getRules, updateRule, deleteRule, evaluateRules, getAlertHistory };
