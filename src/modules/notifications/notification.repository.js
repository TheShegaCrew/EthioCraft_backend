const prisma = require("../../config/prisma");

function createNotification(data) {
  return prisma.notification.create({
    data,
  });
}

function createManyNotifications(data) {
  return prisma.notification.createMany({
    data,
  });
}

function findById(notificationId) {
  return prisma.notification.findUnique({
    where: { id: notificationId },
  });
}

function listByUser(userId) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: {
      createdAt: "desc",
    },
  });
}

function markAsRead(notificationId) {
  return prisma.notification.update({
    where: { id: notificationId },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
}

function deleteReadByUser(userId) {
  return prisma.notification.deleteMany({
    where: {
      userId,
      isRead: true,
    },
  });
}

function getActiveAdmins() {
  return prisma.user.findMany({
    where: { role: "ADMIN", status: "ACTIVE" },
    select: { id: true },
  });
}

module.exports = {
  createNotification,
  createManyNotifications,
  findById,
  listByUser,
  markAsRead,
  deleteReadByUser,
  getActiveAdmins,
};
