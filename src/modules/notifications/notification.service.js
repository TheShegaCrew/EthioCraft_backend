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

async function clearReadNotifications(userId) {
  const result = await notificationRepository.deleteReadByUser(userId);
  return { deletedCount: result.count };
}

async function notifyAdmins(payload) {
  const admins = await notificationRepository.getActiveAdmins();
  if (!admins || admins.length === 0) {
    return { count: 0 };
  }

  const notifications = admins.map((admin) => ({
    ...payload,
    userId: admin.id,
  }));

  return notificationRepository.createManyNotifications(notifications);
}

module.exports = {
  createNotification,
  createManyNotifications,
  getUserNotifications,
  markNotificationAsRead,
  clearReadNotifications,
  notifyAdmins,
};
