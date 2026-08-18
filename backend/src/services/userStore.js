'use strict';

/**
 * Temporary in-memory user store.
 * Replaced by DatabaseAdapter in STEP 7.
 * Passwords are NEVER stored in plaintext — only bcrypt hashes.
 */

const { v4: uuidv4 } = require('uuid');

// Map<userId, userRecord>
const users = new Map();

// Map<email, userId>  — for fast lookup
const emailIndex = new Map();

function createUser({ email, passwordHash, role = 'VIEWER' }) {
  const id = uuidv4();
  const now = new Date().toISOString();
  const user = {
    id,
    email: email.toLowerCase().trim(),
    passwordHash,
    role,
    active: true,
    createdAt: now,
    updatedAt: now,
    // For refresh token rotation: store a hashed version of the current refresh token
    refreshTokenHash: null,
  };
  users.set(id, user);
  emailIndex.set(user.email, id);
  return sanitize(user);
}

function findByEmail(email) {
  const id = emailIndex.get(email.toLowerCase().trim());
  if (!id) return null;
  return users.get(id) || null;
}

function findById(id) {
  return users.get(id) || null;
}

function updateRefreshTokenHash(userId, hash) {
  const user = users.get(userId);
  if (!user) return false;
  user.refreshTokenHash = hash;
  user.updatedAt = new Date().toISOString();
  return true;
}

function clearRefreshToken(userId) {
  return updateRefreshTokenHash(userId, null);
}

/** Return user without sensitive fields */
function sanitize(user) {
  if (!user) return null;
  const { passwordHash, refreshTokenHash, ...safe } = user;
  return safe;
}

module.exports = {
  createUser,
  findByEmail,
  findById,
  updateRefreshTokenHash,
  clearRefreshToken,
  sanitize,
};
