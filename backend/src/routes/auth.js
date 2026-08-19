'use strict';

const express = require('express');
const { body, cookie } = require('express-validator');
const { authRateLimiter } = require('../middleware/security');
const { requireAuth } = require('../middleware/auth');
const { handleValidationErrors } = require('../utils/validate');
const authService = require('../services/authService');
const { refreshCookieOptions } = require('../services/tokenService');
const { createGroup, joinGroup, getInviteCode, rotateInviteCode } = require('../services/groupService');
const { requireSiteRole } = require('../services/rbac');
const logger = require('../utils/logger');

const router = express.Router();

// ─── POST /api/v1/auth/register ─────────────────────────────────────────────
router.post(
  '/register',
  authRateLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('유효한 이메일을 입력하세요.'),
    body('password')
      .isString()
      .isLength({ min: 8, max: 256 })
      .withMessage('비밀번호는 8자 이상이어야 합니다.')
      .matches(/[A-Z]/).withMessage('대문자를 포함해야 합니다.')
      .matches(/[0-9]/).withMessage('숫자를 포함해야 합니다.'),
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      // 기본 역할: VIEWER (그룹 생성 시 OWNER로 승격)
      const user = await authService.register({
        email: req.body.email,
        password: req.body.password,
        role: 'VIEWER',
      });

      logger.audit('USER_REGISTER', { userId: user.id });

      return res.status(201).json({
        message: '회원가입 완료. 그룹을 만들거나 참여하세요.',
        userId: user.id,
      });
    } catch (err) {
      next(err);
    }
  }
);

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

      res.cookie('refreshToken', refreshToken, refreshCookieOptions());
      res.cookie('userId', user.id, { ...refreshCookieOptions(), httpOnly: true });

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

      res.cookie('refreshToken', newRefreshToken, refreshCookieOptions());
      res.cookie('userId', user.id, { ...refreshCookieOptions(), httpOnly: true });

      return res.json({
        accessToken,
        user: { id: user.id, email: user.email, role: user.role },
      });
    } catch (err) {
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
  return res.json({ user: req.user });
});

// ─── POST /api/v1/auth/group/create ─────────────────────────────────────────
router.post(
  '/group/create',
  requireAuth,
  [
    body('name').isString().trim().isLength({ min: 1, max: 100 }).withMessage('그룹 이름을 입력하세요.'),
    body('domain').optional().isString().trim().isLength({ max: 253 }),
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { site, inviteCode } = await createGroup({
        name: req.body.name,
        domain: req.body.domain || '',
        ownerId: req.user.userId,
      });

      return res.status(201).json({
        site,
        inviteCode,
        message: '그룹이 생성되었습니다. 초대코드를 멤버에게 공유하세요.',
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/v1/auth/group/join ───────────────────────────────────────────
router.post(
  '/group/join',
  requireAuth,
  authRateLimiter,
  [
    body('inviteCode')
      .isString()
      .isLength({ min: 10, max: 10 })
      .withMessage('초대코드는 10자리입니다.'),
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { site } = await joinGroup({
        inviteCode: req.body.inviteCode,
        userId: req.user.userId,
      });

      return res.json({
        site,
        message: `"${site.name}" 그룹에 참여했습니다.`,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/v1/auth/group/:siteId/invite ─ 초대코드 조회 (OWNER only) ────
router.get(
  '/group/:siteId/invite',
  requireAuth,
  requireSiteRole('OWNER'),
  (req, res) => {
    const code = getInviteCode(req.params.siteId);
    if (!code) return res.status(404).json({ error: '초대코드를 찾을 수 없습니다.' });
    return res.json({ inviteCode: code });
  }
);

// ─── POST /api/v1/auth/group/:siteId/invite/rotate ─ 초대코드 재발급 ────────
router.post(
  '/group/:siteId/invite/rotate',
  requireAuth,
  requireSiteRole('OWNER'),
  (req, res) => {
    const code = rotateInviteCode(req.params.siteId);
    logger.audit('INVITE_CODE_ROTATED', { userId: req.user.userId, siteId: req.params.siteId });
    return res.json({ inviteCode: code, message: '초대코드가 재발급되었습니다.' });
  }
);

module.exports = router;
