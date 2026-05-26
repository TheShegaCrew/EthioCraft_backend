const express = require("express");
const roles = require("../../constants/roles");
const { authenticate, authorize } = require("../../middlewares/auth.middleware");
const { rateLimit } = require("../../middlewares/rate-limit.middleware");
const validate = require("../../middlewares/validate.middleware");
const adminController = require("./admin.controller");
const { dateRangeQuerySchema, topArtisanQuerySchema, reportQuerySchema, userListQuerySchema, userParamsSchema, usersByRoleSchema, updateUserSchema, updateSampleSchema, sampleParamsSchema, orderListQuerySchema, orderParamsSchema, createUserSchema, notificationPayloadSchema, reverificationPayloadSchema } = require("./admin.validation");

const router = express.Router();

router.use(authenticate);
router.use(authorize(roles.ADMIN));

router.get("/dashboard/overview", validate(dateRangeQuerySchema), adminController.getDashboardOverview);
router.get("/dashboard/revenue", validate(dateRangeQuerySchema), adminController.getDashboardRevenue);
router.get("/dashboard/verifications", validate(dateRangeQuerySchema), adminController.getVerificationQueue);
router.get("/dashboard/orders", validate(dateRangeQuerySchema), adminController.getRecentOrders);
router.get("/dashboard/artisans/top", validate(topArtisanQuerySchema), adminController.getTopArtisans);
router.get("/dashboard/reports", validate(reportQuerySchema), adminController.getDashboardReports);
router.get("/reports/pdf", validate(dateRangeQuerySchema), adminController.getDashboardPdf);
router.get("/audit-logs", validate(dateRangeQuerySchema), adminController.getAuditLogs);
router.get("/users", validate(userListQuerySchema), adminController.getUsers);
router.get("/users/role/:role", validate(usersByRoleSchema), adminController.getUsersByRole);
router.get("/users/:userId", validate(userParamsSchema), adminController.getUser);
router.post("/users", validate(createUserSchema), adminController.createUser);
router.patch("/users/:userId", validate(updateUserSchema), adminController.updateUser);
router.get("/settings", adminController.getSettings);
router.put("/settings", adminController.updateSettings);
router.post("/settings/integrations/test", adminController.testIntegration);
router.post("/settings/integrations/regenerate-key", adminController.regenerateIntegrationKey);
router.get("/samples/pending", adminController.getPendingSamples);
router.get("/agents/metrics", adminController.getAgentMetrics);
router.patch("/samples/:sampleId", validate(updateSampleSchema), adminController.updateSample);
router.delete("/samples/:sampleId", validate(sampleParamsSchema), adminController.deleteSample);

// Orders
router.get("/orders", validate(orderListQuerySchema), adminController.getOrders);
router.get("/orders/:orderId", validate(orderParamsSchema), adminController.getOrder);

// Notifications & Reverification
const notifyLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, keyPrefix: 'admin-notify', message: 'Too many notification requests' });

router.post("/users/:userId/notify", validate(notificationPayloadSchema), notifyLimiter, adminController.notifyUser);
router.post("/samples/:sampleId/re-verify", validate(reverificationPayloadSchema), notifyLimiter, adminController.reverifySample);

module.exports = router;
