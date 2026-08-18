'use strict';

/**
 * Function store.
 * A "Function" is a named event type the user registers for a site.
 * Analytics data is then grouped/queried by function name.
 *
 * Security:
 *   - Function names are DATA only — never executed
 *   - Strict whitelist validation (a-z A-Z 0-9 _ -)
 *   - eval/Function/dynamic execution strictly forbidden
 */

const { v4: uuidv4 } = require('uuid');
const { isValidFunctionName } = require('../utils/validate');

// Map<siteId, Map<functionName, functionRecord>>
const store = new Map();

function _siteMap(siteId) {
  if (!store.has(siteId)) store.set(siteId, new Map());
  return store.get(siteId);
}

function createFunction(siteId, { name, label, description }) {
  if (!isValidFunctionName(name)) {
    throw Object.assign(new Error('Function name: a-z A-Z 0-9 _ - only, max 64 chars.'), { status: 400 });
  }
  const map = _siteMap(siteId);
  if (map.has(name)) {
    throw Object.assign(new Error(`Function "${name}" already exists.`), { status: 409 });
  }
  const now = new Date().toISOString();
  const record = {
    id: uuidv4(),
    siteId,
    name,
    label: label || name,
    description: description || '',
    createdAt: now,
    updatedAt: now,
  };
  map.set(name, record);
  return record;
}

function getFunctions(siteId) {
  return [...(_siteMap(siteId).values())];
}

function getFunctionByName(siteId, name) {
  return _siteMap(siteId).get(name) || null;
}

function updateFunction(siteId, name, patch) {
  const record = _siteMap(siteId).get(name);
  if (!record) throw Object.assign(new Error('Function not found.'), { status: 404 });
  if (patch.label !== undefined) record.label = patch.label;
  if (patch.description !== undefined) record.description = patch.description;
  record.updatedAt = new Date().toISOString();
  return record;
}

function deleteFunction(siteId, name) {
  return _siteMap(siteId).delete(name);
}

module.exports = { createFunction, getFunctions, getFunctionByName, updateFunction, deleteFunction };
