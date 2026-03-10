const express = require("express");
const authRoutes = require("../modules/auth/auth.routes");
const userRoutes = require("../modules/users/user.routes");
const productRoutes = require("../modules/products/product.routes");
const marketplaceRoutes = require("../modules/marketplace/marketplace.routes");
const orderRoutes = require("../modules/orders/order.routes");
const paymentRoutes = require("../modules/payments/payment.routes");
const notificationRoutes = require("../modules/notifications/notification.routes");
const aiRoutes = require("../modules/ai/ai.routes");
const adminRoutes = require("../modules/admin/admin.routes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/", productRoutes);
router.use("/marketplace", marketplaceRoutes);
router.use("/orders", orderRoutes);
router.use("/payments", paymentRoutes);
router.use("/notifications", notificationRoutes);
router.use("/ai", aiRoutes);
router.use("/admin", adminRoutes);

module.exports = router;
