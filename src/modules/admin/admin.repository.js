const prisma = require("../../config/prisma");

function listUsersByRole() {
  return prisma.user.groupBy({
    by: ["role"],
    _count: {
      _all: true,
    },
  });
}

function listProductsByStatus() {
  return prisma.product.groupBy({
    by: ["status"],
    _count: {
      _all: true,
    },
  });
}

function listDraftsByStatus() {
  return prisma.productDraft.groupBy({
    by: ["status"],
    _count: {
      _all: true,
    },
  });
}

function listOrdersByStatus(dateFrom, dateTo) {
  return prisma.order.groupBy({
    by: ["status"],
    where: {
      createdAt: {
        gte: dateFrom,
        lte: dateTo,
      },
    },
    _count: {
      _all: true,
    },
  });
}

function aggregateRevenue(dateFrom, dateTo) {
  return prisma.payment.aggregate({
    where: {
      status: "SUCCESS",
      createdAt: {
        gte: dateFrom,
        lte: dateTo,
      },
    },
    _count: {
      _all: true,
    },
    _sum: {
      amount: true,
    },
  });
}

function listRevenuePayments(dateFrom, dateTo) {
  return prisma.payment.findMany({
    where: {
      status: "SUCCESS",
      createdAt: {
        gte: dateFrom,
        lte: dateTo,
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      amount: true,
      provider: true,
      createdAt: true,
      orderId: true,
    },
  });
}

function listPendingVerifications(limit) {
  return prisma.productDraft.findMany({
    where: {
      status: "SUBMITTED",
    },
    orderBy: {
      submittedAt: "asc",
    },
    take: limit,
    include: {
      artisan: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          artisanProfile: {
            select: {
              shopName: true,
              region: true,
            },
          },
        },
      },
    },
  });
}

function listRecentOrders(limit) {
  return prisma.order.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
    include: {
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      items: {
        select: {
          id: true,
          productName: true,
          artisanId: true,
          quantity: true,
          lineTotal: true,
        },
      },
      payments: {
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
    },
  });
}

function groupTopArtisans(dateFrom, dateTo, limit) {
  return prisma.orderItem.groupBy({
    by: ["artisanId"],
    where: {
      order: {
        status: {
          in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"],
        },
        createdAt: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
    },
    _sum: {
      lineTotal: true,
      quantity: true,
    },
    _count: {
      _all: true,
    },
    orderBy: {
      _sum: {
        lineTotal: "desc",
      },
    },
    take: limit,
  });
}

function listArtisansByIds(ids) {
  return prisma.user.findMany({
    where: {
      id: {
        in: ids,
      },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      artisanProfile: {
        select: {
          shopName: true,
          region: true,
          culturalMetadata: true,
        },
      },
    },
  });
}

function listUsers(pagination, where) {
  return prisma.user.findMany({
    where: where || {},
    orderBy: {
      createdAt: "desc",
    },
    skip: pagination.skip,
    take: pagination.limit,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      artisanProfile: {
        select: {
          shopName: true,
          region: true,
        },
      },
    },
  });
}

function countUsers(where) {
  return prisma.user.count({
    where: where || {},
  });
}

function listAuditLogs(pagination) {
  return prisma.adminAuditLog.findMany({
    orderBy: {
      createdAt: "desc",
    },
    skip: pagination.skip,
    take: pagination.limit,
    include: {
      actor: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
          email: true,
        },
      },
    },
  });
}

function countAuditLogs() {
  return prisma.adminAuditLog.count();
}

function createAuditLog(data) {
  return prisma.adminAuditLog.create({
    data,
  });
}

module.exports = {
  listUsersByRole,
  listProductsByStatus,
  listDraftsByStatus,
  listOrdersByStatus,
  aggregateRevenue,
  listRevenuePayments,
  listPendingVerifications,
  listRecentOrders,
  groupTopArtisans,
  listArtisansByIds,
  listAuditLogs,
  countAuditLogs,
  createAuditLog,
  listUsers,
  countUsers,
};
