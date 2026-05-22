const prisma = require("../../config/prisma");
const { orderInclude } = require("../../constants/db-selects");
const ApiError = require("../../utils/apiError");
const { getPagination } = require("../../utils/pagination");
const notificationService = require("../notifications/notification.service");
const adminService = require("../admin/admin.service");
const orderRepository = require("./order.repository");

const ORDER_TRANSITIONS = {
  PENDING_PAYMENT: ["CANCELLED"],
  PAID: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

function assertOrderAccess(user, order) {
  if (user.role === "ADMIN") {
    return;
  }

  if (user.role === "CUSTOMER" && order.customerId === user.id) {
    return;
  }

  if (user.role === "ARTISAN" && order.items.some((item) => item.artisanId === user.id)) {
    return;
  }

  throw new ApiError(404, "Order was not found.");
}

function buildTimeline(order) {
  return [
    { status: "PENDING_PAYMENT", timestamp: order.createdAt, location: null, description: "Order pending payment", note: null },
    ...(order.paidAt ? [{ status: "PAID", timestamp: order.paidAt, location: null, description: "Payment received", note: null }] : []),
    ...(order.shippedAt ? [{ status: "SHIPPED", timestamp: order.shippedAt, location: null, description: "Order shipped", note: null }] : []),
    ...(order.deliveredAt ? [{ status: "DELIVERED", timestamp: order.deliveredAt, location: null, description: "Order delivered", note: null }] : []),
    ...(order.cancelledAt ? [{ status: "CANCELLED", timestamp: order.cancelledAt, location: null, description: "Order cancelled", note: null }] : []),
  ];
}

async function createAuditLog(payload) {
  try {
    await adminService.createAuditLog(payload);
  } catch (_error) {
    // Do not block order flow when audit logging fails.
  }
}

async function createOrder(customerId, payload) {
  const address = await prisma.address.findFirst({
    where: {
      id: payload.addressId,
      userId: customerId,
    },
  });

  if (!address) {
    throw new ApiError(400, "Shipping address was not found for this customer.");
  }

  const productIds = payload.items.map((item) => item.productId);
  const uniqueIds = new Set(productIds);

  if (uniqueIds.size !== productIds.length) {
    throw new ApiError(400, "Each product may only appear once in an order payload.");
  }

  const products = await prisma.product.findMany({
    where: {
      id: {
        in: productIds,
      },
      status: "PUBLISHED",
    },
  });

  if (products.length !== productIds.length) {
    throw new ApiError(400, "One or more selected products are not available for ordering.");
  }

  const productsById = new Map(products.map((product) => [product.id, product]));
  let subtotalAmount = 0;
  const orderItems = payload.items.map((item) => {
    const product = productsById.get(item.productId);

    if (product.stock < item.quantity) {
      throw new ApiError(409, `Only ${product.stock} units remain for ${product.title}.`);
    }

    const unitPrice = Number(product.price);
    const lineTotal = unitPrice * item.quantity;
    subtotalAmount += lineTotal;

    return {
      productId: product.id,
      artisanId: product.artisanId,
      productName: product.title,
      unitPrice,
      quantity: item.quantity,
      lineTotal,
    };
  });

  const shippingFee = subtotalAmount >= 3000 ? 0 : 150;
  const totalAmount = subtotalAmount + shippingFee;

  const order = await prisma.$transaction(async (tx) => {
    const createdOrder = await tx.order.create({
      data: {
        customerId,
        addressId: payload.addressId,
        status: "PENDING_PAYMENT",
        subtotalAmount,
        shippingFee,
        taxAmount: 0,
        totalAmount,
        currency: "ETB",
        notes: payload.notes || null,
        items: {
          create: orderItems,
        },
      },
      include: orderInclude,
    });

    for (const item of orderItems) {
      await tx.product.update({
        where: { id: item.productId },
        data: {
          stock: {
            decrement: item.quantity,
          },
        },
      });
    }

    return createdOrder;
  });

  const artisanIds = [...new Set(orderItems.map((item) => item.artisanId))];

  await notificationService.createManyNotifications([
    {
      userId: customerId,
      type: "ORDER_PLACED",
      title: "Order placed",
      message: `Order ${order.id} has been placed and is awaiting payment.`,
      metadata: { orderId: order.id },
    },
    ...artisanIds.map((artisanId) => ({
      userId: artisanId,
      type: "ORDER_PLACED",
      title: "New order received",
      message: `Order ${order.id} includes one or more of your products.`,
      metadata: { orderId: order.id },
    })),
  ]);

  return order;
}

async function listOrders(user, query) {
  const pagination = getPagination(query);
  let where = {};

  if (user.role === "CUSTOMER") {
    where = { customerId: user.id };
  } else if (user.role === "ARTISAN") {
    where = {
      items: {
        some: {
          artisanId: user.id,
        },
      },
    };
  } else if (user.role !== "ADMIN") {
    throw new ApiError(403, "This role cannot access order history.");
  }

  const { items, total } = await orderRepository.listOrders(where, pagination);

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

async function getOrderById(user, orderId) {
  const order = await orderRepository.findOrderById(orderId);

  if (!order) {
    throw new ApiError(404, "Order was not found.");
  }

  assertOrderAccess(user, order);
  return order;
}

async function getOrderTracking(user, orderId) {
  const order = await getOrderById(user, orderId);

  return {
    orderId: order.id,
    shipmentStatus: order.status,
    carrier: null,
    trackingNumber: null,
    estimatedDeliveryDate: order.estimatedDeliveryDate || null,
    shippedAt: order.shippedAt || null,
    deliveredAt: order.deliveredAt || null,
    events: buildTimeline(order),
  };
}

async function updateOrderStatus(user, orderId, nextStatus) {
  const order = await orderRepository.findOrderById(orderId);

  if (!order) {
    throw new ApiError(404, "Order was not found.");
  }

  assertOrderAccess(user, order);

  const allowedStatusesForRole = user.role === "CUSTOMER" ? ["CANCELLED"] : ["PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];

  if (!allowedStatusesForRole.includes(nextStatus)) {
    throw new ApiError(403, "Your role cannot set this order status.");
  }

  if (!ORDER_TRANSITIONS[order.status]?.includes(nextStatus)) {
    throw new ApiError(409, `Order cannot move from ${order.status} to ${nextStatus}.`);
  }

  const now = new Date();
  let updatedOrder;

  if (nextStatus === "CANCELLED") {
    updatedOrder = await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              increment: item.quantity,
            },
          },
        });
      }

      return tx.order.update({
        where: { id: orderId },
        data: {
          status: "CANCELLED",
          cancelledAt: now,
        },
        include: orderInclude,
      });
    });
  } else {
    updatedOrder = await orderRepository.updateOrder(orderId, {
      status: nextStatus,
      ...(nextStatus === "SHIPPED" ? { shippedAt: now } : {}),
      ...(nextStatus === "DELIVERED" ? { deliveredAt: now } : {}),
    });
  }

  if (nextStatus === "SHIPPED") {
    await notificationService.createNotification({
      userId: order.customerId,
      type: "ORDER_SHIPPED",
      title: "Order shipped",
      message: `Order ${order.id} has been marked as shipped.`,
      metadata: { orderId: order.id },
    });
  }

  await createAuditLog({
    actorId: user.id,
    action: "UPDATE_ORDER_STATUS",
    entityType: "ORDER",
    entityId: order.id,
    description: `Order ${order.id} moved from ${order.status} to ${nextStatus}.`,
    metadata: {
      previousStatus: order.status,
      nextStatus,
      actorRole: user.role,
    },
  });

  return updatedOrder;
}

module.exports = {
  createOrder,
  listOrders,
  getOrderById,
  getOrderTracking,
  updateOrderStatus,
};
