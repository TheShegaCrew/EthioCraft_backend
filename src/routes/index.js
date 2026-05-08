const express = require("express");
const { authenticate } = require("../middlewares/auth.middleware");
const authRoutes = require("../modules/auth/auth.routes");
const userRoutes = require("../modules/users/user.routes");
const productRoutes = require("../modules/products/product.routes");
const marketplaceRoutes = require("../modules/marketplace/marketplace.routes");
const orderRoutes = require("../modules/orders/order.routes");
const paymentRoutes = require("../modules/payments/payment.routes");
const notificationRoutes = require("../modules/notifications/notification.routes");
const aiRoutes = require("../modules/ai/ai.routes");
const adminRoutes = require("../modules/admin/admin.routes");
const wishlistRoutes = require("../modules/wishlist/wishlist.routes");
const cartRoutes = require("../modules/cart/cart.routes");

const router = express.Router();

// Public Routes
router.use("/auth", authRoutes);
router.use("/marketplace", marketplaceRoutes);

// Protected Routes
router.use("/users", authenticate, userRoutes);
router.use("/orders", authenticate, orderRoutes);
router.use("/payments", authenticate, paymentRoutes);
router.use("/notifications", authenticate, notificationRoutes);
router.use("/ai", authenticate, aiRoutes);
router.use("/admin", authenticate, adminRoutes);
router.use("/wishlist", authenticate, wishlistRoutes);
router.use("/cart", authenticate, cartRoutes);

// Public Root/Fallback Routes
router.use("/", productRoutes);

module.exports = router;
