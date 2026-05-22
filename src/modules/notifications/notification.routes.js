const express = require("express");
const { authenticate } = require("../../middlewares/auth.middleware");
const notificationController = require("./notification.controller");

const router = express.Router();

router.use(authenticate);

router.get("/me", notificationController.listNotifications);
router.delete("/read", notificationController.clearRead);
router.patch("/:notificationId/read", notificationController.markAsRead);

module.exports = router;
