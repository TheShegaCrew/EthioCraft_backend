/**
 * ai.controller.js
 *
 * HTTP handlers for the EthioCraft AI assistant endpoints.
 *
 * Bug fix (v2): createChatSession previously passed `req.user.id` to the
 * service, but the service signature expects the full `req.user` object so it
 * can store the user's role in session metadata. Now passes `req.user`.
 */

const asyncHandler = require('../../utils/asyncHandler');
const aiService = require('./ai.service');
const { getProviderStatus } = require('./llmUtils');

// ─── Chat Sessions ────────────────────────────────────────────────────────────

const createChatSession = asyncHandler(async (req, res) => {
  // FIX: pass full req.user (not req.user.id) so service can access role
  const session = await aiService.createChatSession(req.user, req.validated.body);

  res.status(201).json({
    message: 'Chat session created successfully.',
    data: session,
  });
});

const listChatSessions = asyncHandler(async (req, res) => {
  const sessions = await aiService.listChatSessions(req.user);

  res.status(200).json({
    message: 'Chat sessions fetched successfully.',
    data: sessions,
  });
});

const getChatSession = asyncHandler(async (req, res) => {
  const session = await aiService.getChatSession(req.user, req.params.sessionId);

  res.status(200).json({
    message: 'Chat session fetched successfully.',
    data: session,
  });
});

const closeChatSession = asyncHandler(async (req, res) => {
  const session = await aiService.closeChatSession(req.user, req.params.sessionId);

  res.status(200).json({
    message: 'Chat session closed successfully.',
    data: session,
  });
});

const createChatMessage = asyncHandler(async (req, res) => {
  const result = await aiService.createChatMessage(
    req.user,
    req.params.sessionId,
    req.validated.body.message
  );

  res.status(201).json({
    message: 'Chat message processed successfully.',
    data: result,
  });
});

// ─── Reports ──────────────────────────────────────────────────────────────────

const createReportJob = asyncHandler(async (req, res) => {
  const job = await aiService.createReportJob(req.user, req.validated.body);

  res.status(201).json({
    message: 'Report job created successfully.',
    data: job,
  });
});

const listReportJobs = asyncHandler(async (req, res) => {
  const jobs = await aiService.listReportJobs(req.user, req.query);

  res.status(200).json({
    message: 'Report jobs fetched successfully.',
    data: jobs,
  });
});

const getReportJob = asyncHandler(async (req, res) => {
  const job = await aiService.getReportJob(req.user, req.params.jobId);

  res.status(200).json({
    message: 'Report job fetched successfully.',
    data: job,
  });
});

// ─── AI Provider Health ───────────────────────────────────────────────────────

/**
 * GET /api/v1/ai/status
 * Returns the current state of each LLM provider's circuit breaker.
 * Restricted to ADMIN role (enforced in ai.routes.js).
 */
const getAIStatus = asyncHandler(async (_req, res) => {
  const providerStatus = getProviderStatus();

  res.status(200).json({
    message: 'AI provider status fetched successfully.',
    data: {
      providers: providerStatus,
      timestamp: new Date().toISOString(),
    },
  });
});

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  createChatSession,
  listChatSessions,
  getChatSession,
  closeChatSession,
  createChatMessage,
  createReportJob,
  listReportJobs,
  getReportJob,
  getAIStatus,
};
