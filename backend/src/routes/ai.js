'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../middleware/auth');
const { requireSiteRole } = require('../services/rbac');
const { handleValidationErrors } = require('../utils/validate');
const { analyzeComment } = require('../services/aiService');
const logger = require('../utils/logger');

const router = express.Router();
router.use(requireAuth);

// AI 분석은 비용이 발생하므로 별도 rate limit 적용
const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => `${req.user?.userId}:${req.params.siteId}`,
  handler: (req, res) => res.status(429).json({ error: 'AI rate limit exceeded. Max 30 requests/min.' }),
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/v1/ai/:siteId/analyze-comment
router.post('/:siteId/analyze-comment',
  aiRateLimiter,
  [
    param('siteId').isUUID(),
    body('text').isString().isLength({ min: 1, max: 2000 }).withMessage('Comment text required (max 2000 chars).'),
    body('provider').optional().isIn(['openai', 'gemini']).withMessage('Provider must be openai or gemini.'),
    body('apiKeyPlaceholder').optional().matches(/^[A-Z0-9_]{1,64}$/).withMessage('Invalid placeholder format.'),
  ],
  handleValidationErrors,
  requireSiteRole('ANALYST'),
  async (req, res, next) => {
    try {
      const result = await analyzeComment(
        req.params.siteId,
        req.body.text,
        {
          provider: req.body.provider,
          apiKeyPlaceholder: req.body.apiKeyPlaceholder,
        }
      );

      logger.audit('AI_ANALYZE_COMMENT', {
        userId: req.user.userId,
        siteId: req.params.siteId,
        sentiment: result.sentiment,
        cached: result.cached,
      });

      return res.json({ result });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/ai/:siteId/analyze-batch
// 여러 댓글을 한 번에 분석
router.post('/:siteId/analyze-batch',
  aiRateLimiter,
  [
    param('siteId').isUUID(),
    body('comments').isArray({ min: 1, max: 20 }).withMessage('comments array required (max 20).'),
    body('comments.*.text').isString().isLength({ min: 1, max: 2000 }),
    body('provider').optional().isIn(['openai', 'gemini']),
    body('apiKeyPlaceholder').optional().matches(/^[A-Z0-9_]{1,64}$/),
  ],
  handleValidationErrors,
  requireSiteRole('ANALYST'),
  async (req, res, next) => {
    try {
      const { comments, provider, apiKeyPlaceholder } = req.body;
      const results = [];
      const errors = [];

      for (let i = 0; i < comments.length; i++) {
        try {
          const result = await analyzeComment(req.params.siteId, comments[i].text, { provider, apiKeyPlaceholder });
          results.push({ index: i, result });
        } catch (err) {
          errors.push({ index: i, error: err.message });
        }
      }

      return res.status(207).json({
        analyzed: results.length,
        failed: errors.length,
        results,
        ...(errors.length ? { errors } : {}),
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
