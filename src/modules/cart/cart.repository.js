const prisma = require("../../config/prisma");
const { cartItemInclude } = require("../../constants/db-selects");

function findCartItem(userId, productId) {
  return prisma.cartItem.findUnique({
    where: {
      userId_productId: { userId, productId },
    },
    include: cartItemInclude,
  });
}

async function listCartItems(userId) {
  const items = await prisma.cartItem.findMany({
    where: { userId },
    include: cartItemInclude,
    orderBy: { createdAt: "desc" },
  });

  return items;
}

function createCartItem(userId, productId, quantity) {
  return prisma.cartItem.create({
    data: { userId, productId, quantity },
    include: cartItemInclude,
  });
}

function updateCartItemQuantity(userId, productId, quantity) {
  return prisma.cartItem.update({
    where: {
      userId_productId: { userId, productId },
    },
    data: { quantity },
    include: cartItemInclude,
  });
}

function deleteCartItem(userId, productId) {
  return prisma.cartItem.delete({
    where: {
      userId_productId: { userId, productId },
    },
  });
}

function countCartItems(userId) {
  return prisma.cartItem.count({ where: { userId } });
}

function clearCart(userId) {
  return prisma.cartItem.deleteMany({ where: { userId } });
}

module.exports = {
  findCartItem,
  listCartItems,
  createCartItem,
  updateCartItemQuantity,
  deleteCartItem,
  countCartItems,
  clearCart,
};
