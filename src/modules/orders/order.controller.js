const asyncHandler = require("../../utils/asyncHandler");
const orderService = require("./order.service");

const createOrder = asyncHandler(async (req, res) => {
  const order = await orderService.createOrder(req.user.id, req.validated.body);

  res.status(201).json({
    message: "Order created successfully.",
    data: order,
  });
});

const listOrders = asyncHandler(async (req, res) => {
  const result = await orderService.listOrders(req.user, req.query);

  res.status(200).json({
    message: "Orders fetched successfully.",
    data: result,
  });
});

const getOrderById = asyncHandler(async (req, res) => {
  const order = await orderService.getOrderById(req.user, req.params.orderId);

  res.status(200).json({
    message: "Order fetched successfully.",
    data: order,
  });
});

const getOrderTracking = asyncHandler(async (req, res) => {
  const tracking = await orderService.getOrderTracking(req.user, req.params.orderId);

  res.status(200).json({
    message: "Order tracking fetched successfully.",
    data: tracking,
  });
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await orderService.updateOrderStatus(req.user, req.params.orderId, req.validated.body.status);

  res.status(200).json({
    message: "Order status updated successfully.",
    data: order,
  });
});

module.exports = {
  createOrder,
  listOrders,
  getOrderById,
  getOrderTracking,
  updateOrderStatus,
};
