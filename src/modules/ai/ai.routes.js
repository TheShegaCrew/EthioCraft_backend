/**
 * ai.routes.js
 *
 * Route definitions for the EthioCraft AI assistant module.
 *
 * Changes in v2:
 *  - Added PATCH /chat/sessions/:sessionId/close  (close a session)
 *  - Added GET  /status                          (admin-only provider health)
 */

const express = require('express');
const roles = require('../../constants/roles');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const aiController = require('./ai.controller');
const {
  createChatSessionSchema,
  createChatMessageSchema,
  createReportJobSchema,
} = require('./ai.validation');

const router = express.Router();

// All AI routes require authentication (set globally in routes/index.js too,
// but we re-apply here for clarity and defence-in-depth).
router.use(authenticate);

// ─── Chat Sessions ─────────────────────────────────────────────────────────────
router.get('/chat/sessions', aiController.listChatSessions);
router.post('/chat/sessions', validate(createChatSessionSchema), aiController.createChatSession);
router.get('/chat/sessions/:sessionId', aiController.getChatSession);
router.patch('/chat/sessions/:sessionId/close', aiController.closeChatSession);
router.post(
  '/chat/sessions/:sessionId/messages',
  validate(createChatMessageSchema),
  aiController.createChatMessage
);

// ─── Reports ───────────────────────────────────────────────────────────────────
router.post(
  '/reports/jobs',
  authorize(roles.ADMIN, roles.VERIFICATION_AGENT, roles.ARTISAN),
  validate(createReportJobSchema),
  aiController.createReportJob
);
router.get(
  '/reports/jobs',
  authorize(roles.ADMIN, roles.VERIFICATION_AGENT, roles.ARTISAN),
  aiController.listReportJobs
);
router.get(
  '/reports/jobs/:jobId',
  authorize(roles.ADMIN, roles.VERIFICATION_AGENT, roles.ARTISAN),
  aiController.getReportJob
);

// ─── Provider Health (Admin only) ─────────────────────────────────────────────
router.get('/status', authorize(roles.ADMIN), aiController.getAIStatus);

module.exports = router;
