const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const cartRepository = require("./cart.repository");

async function assertProductAvailable(productId) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, status: true, stock: true, title: true },
  });

  if (!product || product.status !== "PUBLISHED") {
    throw new ApiError(404, "Product not found or not available.");
  }

  return product;
}

async function getCart(userId) {
  const items = await cartRepository.listCartItems(userId);

  let subtotal = 0;
  const enrichedItems = items.map((item) => {
    try {
      const unitPrice = Number(item.product.price);
      const lineTotal = unitPrice * item.quantity;
      subtotal += lineTotal;

      return {
        ...item,
        unitPrice,
        lineTotal,
      };
    } catch (e) {
      console.error("Error enriching cart item:", item, e);
      throw e;
    }
  });

  return {
    items: enrichedItems,
    summary: {
      itemCount: items.length,
      subtotal,
      currency: items.length > 0 ? items[0].product.currency : "ETB",
    },
  };
}

async function addToCart(userId, productId, quantity = 1) {
  const product = await assertProductAvailable(productId);

  if (product.stock < quantity) {
    throw new ApiError(409, `Only ${product.stock} units remain for ${product.title}.`);
  }

  const existing = await cartRepository.findCartItem(userId, productId);

  if (existing) {
    const newQuantity = existing.quantity + quantity;

    if (product.stock < newQuantity) {
      throw new ApiError(409, `Only ${product.stock} units remain for ${product.title}. You already have ${existing.quantity} in your cart.`);
    }

    return cartRepository.updateCartItemQuantity(userId, productId, newQuantity);
  }

  return cartRepository.createCartItem(userId, productId, quantity);
}

async function updateCartItem(userId, productId, quantity) {
  const product = await assertProductAvailable(productId);

  const existing = await cartRepository.findCartItem(userId, productId);

  if (!existing) {
    throw new ApiError(404, "Product is not in your cart.");
  }

  if (product.stock < quantity) {
    throw new ApiError(409, `Only ${product.stock} units remain for ${product.title}.`);
  }

  return cartRepository.updateCartItemQuantity(userId, productId, quantity);
}

async function removeFromCart(userId, productId) {
  const existing = await cartRepository.findCartItem(userId, productId);

  if (!existing) {
    throw new ApiError(404, "Product is not in your cart.");
  }

  await cartRepository.deleteCartItem(userId, productId);
}

async function getCartCount(userId) {
  const count = await cartRepository.countCartItems(userId);
  return { count };
}

async function clearCart(userId) {
  await cartRepository.clearCart(userId);
}

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  getCartCount,
  clearCart,
};
