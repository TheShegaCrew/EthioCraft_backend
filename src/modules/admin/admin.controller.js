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

module.exports = {
  getDashboardOverview,
  getDashboardRevenue,
  getVerificationQueue,
  getRecentOrders,
  getTopArtisans,
  getAuditLogs,
  getUsers,
};
