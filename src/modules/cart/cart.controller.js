const asyncHandler = require("../../utils/asyncHandler");
const cartService = require("./cart.service");

const getCart = asyncHandler(async (req, res) => {
  const result = await cartService.getCart(req.user.id);

  res.status(200).json({
    message: "Cart fetched successfully.",
    data: result,
  });
});

const addToCart = asyncHandler(async (req, res) => {
  const { productId, quantity } = req.validated.body;
  const item = await cartService.addToCart(req.user.id, productId, quantity);

  res.status(201).json({
    message: "Product added to cart.",
    data: item,
  });
});

const updateCartItem = asyncHandler(async (req, res) => {
  const item = await cartService.updateCartItem(
    req.user.id,
    req.params.productId,
    req.validated.body.quantity,
  );

  res.status(200).json({
    message: "Cart item updated successfully.",
    data: item,
  });
});

const removeFromCart = asyncHandler(async (req, res) => {
  await cartService.removeFromCart(req.user.id, req.params.productId);

  res.status(200).json({
    message: "Product removed from cart.",
  });
});

const getCartCount = asyncHandler(async (req, res) => {
  const result = await cartService.getCartCount(req.user.id);

  res.status(200).json({
    message: "Cart count fetched successfully.",
    data: result,
  });
});

const clearCart = asyncHandler(async (req, res) => {
  await cartService.clearCart(req.user.id);

  res.status(200).json({
    message: "Cart cleared successfully.",
  });
});

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  getCartCount,
  clearCart,
};
