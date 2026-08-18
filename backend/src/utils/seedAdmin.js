'use strict';

const authService = require('../services/authService');
const { getDb } = require('../adapters/DatabaseRegistry');
const logger = require('./logger');

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    if (process.env.NODE_ENV === 'development') {
      logger.warn('SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — skipping seed.');
    }
    return;
  }

  const existing = await getDb().findUserByEmail(email);
  if (existing) { logger.info('Admin account already exists — skipping seed.'); return; }

  await authService.register({ email, password, role: 'OWNER' });
  logger.info('Initial OWNER account seeded.', { email });
}

module.exports = seedAdmin;
