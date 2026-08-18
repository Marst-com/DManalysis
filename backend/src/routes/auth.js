'use strict';

const express = require('express');
const { body, cookie } = require('express-validator');
const { authRateLimiter } = require('../middleware/security');
const { requireAuth } = require('../middleware/auth');
const { handleValidationErrors } = require('../utils/validate');
const authService = require('../services/authService');
const { refreshCookieOptions } = require('../services/tokenService');
const logger = require('../utils/logger');

const router = express.Router();

// ─── POST /api/v1/auth/login ────────────────────────────────────────────────
router.post(
  '/login',
  authRateLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required.'),
    body('password').isString().isLength({ min: 1, max: 256 }).withMessage('Password required.'),
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { accessToken, refreshToken, user } = await authService.login({
        email: req.body.email,
        password: req.body.password,
      });

      // Refresh token → httpOnly cookie (not readable by JS)
      res.cookie('refreshToken', refreshToken, refreshCookieOptions());
      // userId in a separate httpOnly cookie (needed for /refresh without exposing in JS)
      res.cookie('userId', user.id, {
        ...refreshCookieOptions(),
        httpOnly: true,
      });

      return res.json({
        accessToken,
        user: { id: user.id, email: user.email, role: user.role },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/v1/auth/refresh ──────────────────────────────────────────────
router.post(
  '/refresh',
  // Lighter rate limit than login — this is called on every page load
  [
    cookie('refreshToken').isString().withMessage('Refresh token required.'),
    cookie('userId').isUUID().withMessage('User ID required.'),
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { refreshToken, userId } = req.cookies;
      const { accessToken, refreshToken: newRefreshToken, user } = await authService.refresh({
        refreshToken,
        userId,
      });

      // Rotate refresh token cookie
      res.cookie('refreshToken', newRefreshToken, refreshCookieOptions());
      res.cookie('userId', user.id, { ...refreshCookieOptions(), httpOnly: true });

      return res.json({
        accessToken,
        user: { id: user.id, email: user.email, role: user.role },
      });
    } catch (err) {
      // Clear cookies on refresh failure
      res.clearCookie('refreshToken', refreshCookieOptions());
      res.clearCookie('userId', refreshCookieOptions());
      next(err);
    }
  }
);

// ─── POST /api/v1/auth/logout ───────────────────────────────────────────────
router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    await authService.logout(req.user.userId);

    res.clearCookie('refreshToken', refreshCookieOptions());
    res.clearCookie('userId', refreshCookieOptions());

    return res.json({ message: '로그아웃 완료.' });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/v1/auth/me ────────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  // req.user is already sanitized (set by requireAuth)
  return res.json({ user: req.user });
});

module.exports = router;
