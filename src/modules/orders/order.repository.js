const prisma = require("../../config/prisma");
const { orderInclude } = require("../../constants/db-selects");

function findOrderById(orderId) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: orderInclude,
  });
}

async function listOrders(where, pagination) {
  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: orderInclude,
      orderBy: {
        createdAt: "desc",
      },
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    items,
    total,
  };
}

function updateOrder(orderId, data) {
  return prisma.order.update({
    where: { id: orderId },
    data,
    include: orderInclude,
  });
}

module.exports = {
  findOrderById,
  listOrders,
  updateOrder,
};
