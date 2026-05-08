const prisma = require("../../config/prisma");
const { publicUserSelect } = require("../../constants/db-selects");

function findAuthUserByEmail(email) {
  return prisma.user.findUnique({
    where: {
      email: email.toLowerCase(),
    },
    include: {
      artisanProfile: true,
    },
  });
}

function createUser(data) {
  return prisma.user.create({
    data,
    select: publicUserSelect,
  });
}

function findAuthUserById(id) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      artisanProfile: true,
    },
  });
}

function findPublicUserById(id) {
  return prisma.user.findUnique({
    where: { id },
    select: publicUserSelect,
  });
}

function upsertEmailOtp({ userId, codeHash, purpose, expiresAt }) {
  return prisma.emailOtp.upsert({
    where: {
      userId_purpose: {
        userId,
        purpose,
      },
    },
    update: {
      codeHash,
      expiresAt,
      attempts: 0,
      lastSentAt: new Date(),
    },
    create: {
      userId,
      codeHash,
      purpose,
      expiresAt,
    },
  });
}

function findEmailOtp(userId, purpose) {
  return prisma.emailOtp.findUnique({
    where: {
      userId_purpose: {
        userId,
        purpose,
      },
    },
  });
}

function updateEmailOtpById(id, data) {
  return prisma.emailOtp.update({
    where: { id },
    data,
  });
}

function deleteEmailOtpById(id) {
  return prisma.emailOtp.delete({
    where: { id },
  });
}

function markUserEmailVerified(userId) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      isEmailVerified: true,
    },
    select: publicUserSelect,
  });
}

function updateUserPassword(userId, passwordHash) {
  return prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
}

function createAuthAuditLog({ actorId = null, description, metadata = null }) {
  return prisma.adminAuditLog.create({
    data: {
      actorId,
      action: "OTHER",
      entityType: "AUTH",
      entityId: actorId,
      description,
      metadata,
    },
  });
}

module.exports = {
  findAuthUserByEmail,
  createUser,
  findAuthUserById,
  findPublicUserById,
  upsertEmailOtp,
  findEmailOtp,
  updateEmailOtpById,
  deleteEmailOtpById,
  markUserEmailVerified,
  updateUserPassword,
  createAuthAuditLog,
};
