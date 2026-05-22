const asyncHandler = require("../../utils/asyncHandler");
const notificationService = require("./notification.service");

const listNotifications = asyncHandler(async (req, res) => {
  const notifications = await notificationService.getUserNotifications(req.user.id);

  res.status(200).json({
    message: "Notifications fetched successfully.",
    data: notifications,
  });
});

const markAsRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.markNotificationAsRead(req.user.id, req.params.notificationId);

  res.status(200).json({
    message: "Notification marked as read.",
    data: notification,
  });
});

const clearRead = asyncHandler(async (req, res) => {
  const result = await notificationService.clearReadNotifications(req.user.id);

  res.status(200).json({
    message: "Read notifications cleared successfully.",
    data: result,
  });
});

module.exports = {
  listNotifications,
  markAsRead,
  clearRead,
};
