const prisma = require("../../config/prisma");
const { publicUserSelect } = require("../../constants/db-selects");

function findProfileById(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: publicUserSelect,
  });
}

function findUserWithArtisanProfile(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      artisanProfile: true,
      artisanBankDetail: true,
    },
  });
}

function updateProfile(userId, data) {
  const { artisanProfile, artisanBankDetail, ...userData } = data;

  return prisma.user.update({
    where: { id: userId },
    data: {
      ...userData,
      ...(artisanProfile
        ? {
            artisanProfile: {
              upsert: {
                create: artisanProfile,
                update: artisanProfile,
              },
            },
          }
        : {}),
      ...(artisanBankDetail
        ? {
            artisanBankDetail: {
              upsert: {
                create: artisanBankDetail,
                update: artisanBankDetail,
              },
            },
          }
        : {}),
    },
    select: publicUserSelect,
  });
}

function listAddresses(userId) {
  return prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
}

function findAddressById(addressId) {
  return prisma.address.findUnique({
    where: { id: addressId },
  });
}

function clearDefaultAddresses(userId, excludeAddressId) {
  return prisma.address.updateMany({
    where: {
      userId,
      ...(excludeAddressId
        ? {
            NOT: {
              id: excludeAddressId,
            },
          }
        : {}),
    },
    data: {
      isDefault: false,
    },
  });
}

function createAddress(data) {
  return prisma.address.create({
    data,
  });
}

function updateAddress(addressId, data) {
  return prisma.address.update({
    where: { id: addressId },
    data,
  });
}

function deleteAddress(addressId) {
  return prisma.address.delete({
    where: { id: addressId },
  });
}

module.exports = {
  findProfileById,
  findUserWithArtisanProfile,
  updateProfile,
  listAddresses,
  findAddressById,
  clearDefaultAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
};
