'use strict';

const { validationResult } = require('express-validator');

/**
 * Function name whitelist: a-z A-Z 0-9 _ -
 * Max 64 chars. Prevents injection, eval abuse, path traversal.
 */
const FUNCTION_NAME_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

/**
 * Site slug: lowercase alphanumeric + hyphens
 */
const SITE_SLUG_REGEX = /^[a-z0-9-]{1,64}$/;

/**
 * Event name: same rule as function name
 */
const EVENT_NAME_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

function isValidFunctionName(name) {
  return typeof name === 'string' && FUNCTION_NAME_REGEX.test(name);
}

function isValidSiteSlug(slug) {
  return typeof slug === 'string' && SITE_SLUG_REGEX.test(slug);
}

function isValidEventName(name) {
  return typeof name === 'string' && EVENT_NAME_REGEX.test(name);
}

/**
 * Timestamp validation: reject timestamps too far in past/future (replay protection)
 * Allows ±5 minutes skew
 */
function isValidTimestamp(ts) {
  if (!ts) return false;
  const parsed = typeof ts === 'number' ? ts : parseInt(ts, 10);
  if (isNaN(parsed)) return false;
  const skewMs = 5 * 60 * 1000;
  const now = Date.now();
  return parsed >= now - skewMs && parsed <= now + skewMs;
}

/**
 * Express-validator result handler middleware
 * Returns 422 with field errors if validation fails
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      error: 'Validation failed',
      fields: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

module.exports = {
  isValidFunctionName,
  isValidSiteSlug,
  isValidEventName,
  isValidTimestamp,
  handleValidationErrors,
  FUNCTION_NAME_REGEX,
  EVENT_NAME_REGEX,
};
