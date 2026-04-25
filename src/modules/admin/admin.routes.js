const express = require("express");
const roles = require("../../constants/roles");
const { authenticate, authorize } = require("../../middlewares/auth.middleware");
const validate = require("../../middlewares/validate.middleware");
const adminController = require("./admin.controller");
const { dateRangeQuerySchema, topArtisanQuerySchema, userListQuerySchema, userParamsSchema } = require("./admin.validation");

const router = express.Router();

router.use(authenticate);
router.use(authorize(roles.ADMIN));

router.get("/dashboard/overview", validate(dateRangeQuerySchema), adminController.getDashboardOverview);
router.get("/dashboard/revenue", validate(dateRangeQuerySchema), adminController.getDashboardRevenue);
router.get("/dashboard/verifications", validate(dateRangeQuerySchema), adminController.getVerificationQueue);
router.get("/dashboard/orders", validate(dateRangeQuerySchema), adminController.getRecentOrders);
router.get("/dashboard/artisans/top", validate(topArtisanQuerySchema), adminController.getTopArtisans);
router.get("/audit-logs", validate(dateRangeQuerySchema), adminController.getAuditLogs);
router.get("/users", validate(userListQuerySchema), adminController.getUsers);
router.get("/users/:userId", validate(userParamsSchema), adminController.getUser);

module.exports = router;
