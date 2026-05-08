const prisma = require("../../config/prisma");
const { wishlistItemInclude } = require("../../constants/db-selects");

function findWishlistItem(userId, productId) {
  return prisma.wishlistItem.findUnique({
    where: {
      userId_productId: { userId, productId },
    },
    include: wishlistItemInclude,
  });
}

async function listWishlistItems(userId, pagination) {
  const where = { userId };

  const [items, total] = await Promise.all([
    prisma.wishlistItem.findMany({
      where,
      include: wishlistItemInclude,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.wishlistItem.count({ where }),
  ]);

  return { items, total };
}

function createWishlistItem(userId, productId) {
  return prisma.wishlistItem.create({
    data: { userId, productId },
    include: wishlistItemInclude,
  });
}

function deleteWishlistItem(userId, productId) {
  return prisma.wishlistItem.delete({
    where: {
      userId_productId: { userId, productId },
    },
  });
}

function countWishlistItems(userId) {
  return prisma.wishlistItem.count({ where: { userId } });
}

function clearWishlist(userId) {
  return prisma.wishlistItem.deleteMany({ where: { userId } });
}

module.exports = {
  findWishlistItem,
  listWishlistItems,
  createWishlistItem,
  deleteWishlistItem,
  countWishlistItems,
  clearWishlist,
};
