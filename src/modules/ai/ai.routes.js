const express = require("express");
const roles = require("../../constants/roles");
const { authenticate, authorize } = require("../../middlewares/auth.middleware");
const validate = require("../../middlewares/validate.middleware");
const aiController = require("./ai.controller");
const {
  createChatSessionSchema,
  createChatMessageSchema,
  createReportJobSchema,
} = require("./ai.validation");

const router = express.Router();

router.use(authenticate);

router.get("/chat/sessions", aiController.listChatSessions);
router.post("/chat/sessions", validate(createChatSessionSchema), aiController.createChatSession);
router.get("/chat/sessions/:sessionId", aiController.getChatSession);
router.post(
  "/chat/sessions/:sessionId/messages",
  validate(createChatMessageSchema),
  aiController.createChatMessage,
);

router.post(
  "/reports/jobs",
  authorize(roles.ADMIN, roles.VERIFICATION_AGENT, roles.ARTISAN),
  validate(createReportJobSchema),
  aiController.createReportJob,
);
router.get(
  "/reports/jobs",
  authorize(roles.ADMIN, roles.VERIFICATION_AGENT, roles.ARTISAN),
  aiController.listReportJobs,
);
router.get(
  "/reports/jobs/:jobId",
  authorize(roles.ADMIN, roles.VERIFICATION_AGENT, roles.ARTISAN),
  aiController.getReportJob,
);

module.exports = router;
