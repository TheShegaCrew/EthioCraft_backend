const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const { getPagination } = require("../../utils/pagination");
const wishlistRepository = require("./wishlist.repository");

async function assertProductExists(productId) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, status: true },
  });

  if (!product || product.status !== "PUBLISHED") {
    throw new ApiError(404, "Product not found or not available.");
  }

  return product;
}

async function listWishlistItems(userId, query) {
  const pagination = getPagination(query);
  const { items, total } = await wishlistRepository.listWishlistItems(userId, pagination);

  return {
    items,
    meta: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit) || 1,
    },
  };
}

async function addToWishlist(userId, productId) {
  await assertProductExists(productId);

  const existing = await wishlistRepository.findWishlistItem(userId, productId);

  if (existing) {
    throw new ApiError(409, "Product is already in your wishlist.");
  }

  return wishlistRepository.createWishlistItem(userId, productId);
}

async function removeFromWishlist(userId, productId) {
  const existing = await wishlistRepository.findWishlistItem(userId, productId);

  if (!existing) {
    throw new ApiError(404, "Product is not in your wishlist.");
  }

  await wishlistRepository.deleteWishlistItem(userId, productId);
}

async function toggleWishlistItem(userId, productId) {
  await assertProductExists(productId);

  const existing = await wishlistRepository.findWishlistItem(userId, productId);

  if (existing) {
    await wishlistRepository.deleteWishlistItem(userId, productId);
    return { action: "removed" };
  }

  const item = await wishlistRepository.createWishlistItem(userId, productId);
  return { action: "added", item };
}

async function checkWishlistItem(userId, productId) {
  const item = await wishlistRepository.findWishlistItem(userId, productId);
  return { inWishlist: !!item };
}

async function getWishlistCount(userId) {
  const count = await wishlistRepository.countWishlistItems(userId);
  return { count };
}

async function clearWishlist(userId) {
  await wishlistRepository.clearWishlist(userId);
}

module.exports = {
  listWishlistItems,
  addToWishlist,
  removeFromWishlist,
  toggleWishlistItem,
  checkWishlistItem,
  getWishlistCount,
  clearWishlist,
};
