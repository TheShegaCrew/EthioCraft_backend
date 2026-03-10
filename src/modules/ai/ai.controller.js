const asyncHandler = require("../../utils/asyncHandler");
const aiService = require("./ai.service");

const createChatSession = asyncHandler(async (req, res) => {
  const session = await aiService.createChatSession(req.user.id, req.validated.body);

  res.status(201).json({
    message: "Chat session created successfully.",
    data: session,
  });
});

const listChatSessions = asyncHandler(async (req, res) => {
  const sessions = await aiService.listChatSessions(req.user);

  res.status(200).json({
    message: "Chat sessions fetched successfully.",
    data: sessions,
  });
});

const getChatSession = asyncHandler(async (req, res) => {
  const session = await aiService.getChatSession(req.user, req.params.sessionId);

  res.status(200).json({
    message: "Chat session fetched successfully.",
    data: session,
  });
});

const createChatMessage = asyncHandler(async (req, res) => {
  const session = await aiService.createChatMessage(req.user, req.params.sessionId, req.validated.body.message);

  res.status(201).json({
    message: "Chat message processed successfully.",
    data: session,
  });
});

const createReportJob = asyncHandler(async (req, res) => {
  const job = await aiService.createReportJob(req.user, req.validated.body);

  res.status(201).json({
    message: "Report job created successfully.",
    data: job,
  });
});

const listReportJobs = asyncHandler(async (req, res) => {
  const jobs = await aiService.listReportJobs(req.user, req.query);

  res.status(200).json({
    message: "Report jobs fetched successfully.",
    data: jobs,
  });
});

const getReportJob = asyncHandler(async (req, res) => {
  const job = await aiService.getReportJob(req.user, req.params.jobId);

  res.status(200).json({
    message: "Report job fetched successfully.",
    data: job,
  });
});

module.exports = {
  createChatSession,
  listChatSessions,
  getChatSession,
  createChatMessage,
  createReportJob,
  listReportJobs,
  getReportJob,
};
