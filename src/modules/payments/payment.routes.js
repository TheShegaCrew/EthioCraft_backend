const express = require("express");
const { authenticate } = require("../../middlewares/auth.middleware");
const validate = require("../../middlewares/validate.middleware");
const paymentController = require("./payment.controller");
const { initializePaymentSchema, confirmPaymentSchema, webhookPayloadSchema } = require("./payment.validation");
const router = express.Router();

// --- Public Routes (No Token Required) ---
router.post("/webhooks/telebirr", validate(webhookPayloadSchema), paymentController.telebirrWebhook);
router.post("/webhooks/chapa", validate(webhookPayloadSchema), paymentController.chapaWebhook);
router.get("/callback", paymentController.handleCallback);
// --- Protected Routes (Token Required) ---
router.use(authenticate);

router.post("/initialize", validate(initializePaymentSchema), paymentController.initializePayment);
router.get("/:paymentId", paymentController.getPayment);
router.post("/:paymentId/confirm", validate(confirmPaymentSchema), paymentController.confirmPayment);

module.exports = router; // adjust path if needed