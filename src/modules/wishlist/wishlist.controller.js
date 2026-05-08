const asyncHandler = require("../../utils/asyncHandler");
const wishlistService = require("./wishlist.service");

const listWishlistItems = asyncHandler(async (req, res) => {
  const result = await wishlistService.listWishlistItems(req.user.id, req.query);

  res.status(200).json({
    message: "Wishlist fetched successfully.",
    data: result,
  });
});

const addToWishlist = asyncHandler(async (req, res) => {
  const item = await wishlistService.addToWishlist(req.user.id, req.validated.body.productId);

  res.status(201).json({
    message: "Product added to wishlist.",
    data: item,
  });
});

const removeFromWishlist = asyncHandler(async (req, res) => {
  await wishlistService.removeFromWishlist(req.user.id, req.params.productId);

  res.status(200).json({
    message: "Product removed from wishlist.",
  });
});

const toggleWishlistItem = asyncHandler(async (req, res) => {
  const result = await wishlistService.toggleWishlistItem(req.user.id, req.validated.body.productId);

  res.status(200).json({
    message: result.action === "added" ? "Product added to wishlist." : "Product removed from wishlist.",
    data: result,
  });
});

const checkWishlistItem = asyncHandler(async (req, res) => {
  const result = await wishlistService.checkWishlistItem(req.user.id, req.params.productId);

  res.status(200).json({
    message: "Wishlist check completed.",
    data: result,
  });
});

const getWishlistCount = asyncHandler(async (req, res) => {
  const result = await wishlistService.getWishlistCount(req.user.id);

  res.status(200).json({
    message: "Wishlist count fetched successfully.",
    data: result,
  });
});

const clearWishlist = asyncHandler(async (req, res) => {
  await wishlistService.clearWishlist(req.user.id);

  res.status(200).json({
    message: "Wishlist cleared successfully.",
  });
});

module.exports = {
  listWishlistItems,
  addToWishlist,
  removeFromWishlist,
  toggleWishlistItem,
  checkWishlistItem,
  getWishlistCount,
  clearWishlist,
};
