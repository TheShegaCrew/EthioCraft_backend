const express = require("express");
const { authenticate } = require("../../middlewares/auth.middleware");
const validate = require("../../middlewares/validate.middleware");
const orderController = require("./order.controller");
const { createOrderSchema, updateOrderStatusSchema } = require("./order.validation");

const router = express.Router();

router.use(authenticate);

router.post("/", validate(createOrderSchema), orderController.createOrder);
router.get("/", orderController.listOrders);
router.get("/:orderId", orderController.getOrderById);
router.get("/:orderId/tracking", orderController.getOrderTracking);
router.patch("/:orderId/status", validate(updateOrderStatusSchema), orderController.updateOrderStatus);

module.exports = router;
