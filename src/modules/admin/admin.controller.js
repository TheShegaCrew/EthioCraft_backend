const asyncHandler = require("../../utils/asyncHandler");
const adminService = require("./admin.service");

const getDashboardOverview = asyncHandler(async (req, res) => {
  const data = await adminService.getDashboardOverview(req.query);

  res.status(200).json({
    message: "Dashboard overview fetched successfully.",
    data,
  });
});

const getDashboardRevenue = asyncHandler(async (req, res) => {
  const data = await adminService.getDashboardRevenue(req.query);

  res.status(200).json({
    message: "Revenue insights fetched successfully.",
    data,
  });
});

const getVerificationQueue = asyncHandler(async (req, res) => {
  const data = await adminService.getVerificationQueue(req.query);

  res.status(200).json({
    message: "Verification queue fetched successfully.",
    data,
  });
});

const getRecentOrders = asyncHandler(async (req, res) => {
  const data = await adminService.getRecentOrders(req.query);

  res.status(200).json({
    message: "Recent orders fetched successfully.",
    data,
  });
});

const getTopArtisans = asyncHandler(async (req, res) => {
  const data = await adminService.getTopArtisans(req.query);

  res.status(200).json({
    message: "Top artisan performance fetched successfully.",
    data,
  });
});

const getAuditLogs = asyncHandler(async (req, res) => {
  const data = await adminService.getAuditLogs(req.query);

  res.status(200).json({
    message: "Admin audit logs fetched successfully.",
    data,
  });
});

const getUsers = asyncHandler(async (req, res) => {
  const data = await adminService.getUsers(req.query);

  res.status(200).json({
    message: "Users fetched successfully.",
    data,
  });
});

const getUser = asyncHandler(async (req, res) => {
  const user = await adminService.getUser(req.params.userId);

  res.status(200).json({
    message: "User fetched successfully.",
    data: user,
  });
});

const updateUser = asyncHandler(async (req, res) => {
  const updatedUser = await adminService.updateUser(req.params.userId, req.body, req.user?.id);

  res.status(200).json({
    message: "User updated successfully.",
    data: updatedUser,
  });
});

const updateSample = asyncHandler(async (req, res) => {
  const updatedSample = await adminService.updateSample(req.params.sampleId, req.body, req.user?.id);

  res.status(200).json({
    message: "Sample updated successfully.",
    data: updatedSample,
  });
});

const deleteSample = asyncHandler(async (req, res) => {
  await adminService.deleteSample(req.params.sampleId, req.user?.id);

  res.status(200).json({
    message: "Sample deleted successfully.",
  });
});

const getUsersByRole = asyncHandler(async (req, res) => {
  const data = await adminService.getUsersByRole(req.params.role, req.query);

  res.status(200).json({
    message: `Users with role ${req.params.role} fetched successfully.`,
    data,
  });
});

const getOrders = asyncHandler(async (req, res) => {
  const data = await adminService.getOrders(req.query);

  res.status(200).json({
    message: "Orders fetched successfully.",
    data,
  });
});

const getOrder = asyncHandler(async (req, res) => {
  const data = await adminService.getOrder(req.params.orderId);

  res.status(200).json({
    message: "Order fetched successfully.",
    data,
  });
});

const getPendingSamples = asyncHandler(async (req, res) => {
  const data = await adminService.getPendingSamples(req.query);

  res.status(200).json({
    message: "Pending samples fetched successfully.",
    data,
  });
});

module.exports = {
  getDashboardOverview,
  getDashboardRevenue,
  getVerificationQueue,
  getRecentOrders,
  getTopArtisans,
  getAuditLogs,
  getUsers,
  getUser,
  getUsersByRole,
  updateUser,
  updateSample,
  deleteSample,
  getOrders,
  getOrder,
  getPendingSamples,
};
