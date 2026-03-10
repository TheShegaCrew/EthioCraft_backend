const notificationRepository = require("./notification.repository");
const ApiError = require("../../utils/apiError");

function createNotification(payload) {
  return notificationRepository.createNotification(payload);
}

function createManyNotifications(payload) {
  if (!payload.length) {
    return { count: 0 };
  }

  return notificationRepository.createManyNotifications(payload);
}

function getUserNotifications(userId) {
  return notificationRepository.listByUser(userId);
}

async function markNotificationAsRead(userId, notificationId) {
  const notification = await notificationRepository.findById(notificationId);

  if (!notification || notification.userId !== userId) {
    throw new ApiError(404, "Notification was not found.");
  }

  return notificationRepository.markAsRead(notificationId);
}

module.exports = {
  createNotification,
  createManyNotifications,
  getUserNotifications,
  markNotificationAsRead,
};
