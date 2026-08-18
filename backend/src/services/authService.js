'use strict';

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../adapters/DatabaseRegistry');
const tokenService = require('./tokenService');
const logger = require('../utils/logger');

const BCRYPT_ROUNDS = 12;

async function register({ email, password, role = 'VIEWER' }) {
  if (!email || !password) throw Object.assign(new Error('Email and password required.'), { status: 400 });
  const db = getDb();
  const existing = await db.findUserByEmail(email);
  if (existing) throw Object.assign(new Error('Registration failed. Please try again.'), { status: 409 });
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const id = uuidv4();
  const user = await db.createUser({ id, email, passwordHash, role });
  logger.audit('USER_REGISTER', { userId: id, role });
  return user;
}

async function login({ email, password }) {
  if (!email || !password) throw Object.assign(new Error('Invalid credentials.'), { status: 401 });
  const db = getDb();
  const user = await db.findUserByEmail(email);
  const dummyHash = '$2a$12$dummyhashfortimingnoaccount000000000000000000000000000';
  const hashToCompare = user ? user.passwordHash : dummyHash;
  const valid = await bcrypt.compare(password, hashToCompare);
  if (!user || !user.active || !valid) {
    logger.warn('LOGIN_FAILED', { email: email.toLowerCase() });
    throw Object.assign(new Error('Invalid credentials.'), { status: 401 });
  }
  const accessToken = tokenService.issueAccessToken(user);
  const refreshToken = tokenService.issueRefreshToken();
  await db.updateUserRefreshToken(user.id, tokenService.hashRefreshToken(refreshToken));
  logger.audit('LOGIN_SUCCESS', { userId: user.id, role: user.role });
  const { passwordHash, refreshTokenHash, ...safeUser } = user;
  return { accessToken, refreshToken, user: safeUser };
}

async function refresh({ refreshToken, userId }) {
  if (!refreshToken || !userId) throw Object.assign(new Error('Refresh failed.'), { status: 401 });
  const db = getDb();
  const user = await db.findUserById(userId);
  if (!user || !user.active || !user.refreshTokenHash) throw Object.assign(new Error('Refresh failed.'), { status: 401 });
  const incomingHash = tokenService.hashRefreshToken(refreshToken);
  const stored = Buffer.from(user.refreshTokenHash);
  const incoming = Buffer.from(incomingHash);
  const match = stored.length === incoming.length && crypto.timingSafeEqual(stored, incoming);
  if (!match) {
    await db.updateUserRefreshToken(user.id, null);
    logger.warn('REFRESH_TOKEN_MISMATCH', { userId: user.id });
    throw Object.assign(new Error('Refresh failed.'), { status: 401 });
  }
  const newAccessToken = tokenService.issueAccessToken(user);
  const newRefreshToken = tokenService.issueRefreshToken();
  await db.updateUserRefreshToken(user.id, tokenService.hashRefreshToken(newRefreshToken));
  const { passwordHash, refreshTokenHash, ...safeUser } = user;
  return { accessToken: newAccessToken, refreshToken: newRefreshToken, user: safeUser };
}

async function logout(userId) {
  if (userId) {
    await getDb().updateUserRefreshToken(userId, null);
    logger.audit('LOGOUT', { userId });
  }
}

module.exports = { register, login, refresh, logout };
