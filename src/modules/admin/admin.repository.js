const prisma = require("../../config/prisma");
const { publicUserSelect } = require("../../constants/db-selects");

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
      status: { in: ["ADMIN_REVIEW", "AGENT_VERIFIED"] },
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

function listUsersByRole(role, pagination, search) {
  const where = { role };

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  return prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: pagination.skip,
    take: pagination.limit,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      createdAt: true,
      artisanProfile: {
        select: {
          shopName: true,
          region: true,
          city: true,
          verificationStatus: true,
        },
      },
    },
  });
}

function countUsersByRole(role, search) {
  const where = { role };

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  return prisma.user.count({ where });
}

function getUserById(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: publicUserSelect,
  });
}

function countUsers(where) {
  return prisma.user.count({
    where: where || {},
  });
}

function getCustomerSummary(userId) {
  return Promise.all([
    prisma.order.count({ where: { customerId: userId } }),
    prisma.order.aggregate({
      where: { customerId: userId, status: { not: "CANCELLED" } },
      _sum: { totalAmount: true }
    }),
    prisma.order.findFirst({
      where: { customerId: userId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true }
    })
  ]).then(([totalOrders, totalSpentResult, lastOrder]) => {
    return {
      totalOrders,
      totalSpent: totalSpentResult._sum.totalAmount ? Number(totalSpentResult._sum.totalAmount) : 0,
      lastOrderDate: lastOrder ? lastOrder.createdAt : null
    };
  });
}

function updateUser(userId, data) {
  return prisma.user.update({
    where: { id: userId },
    data,
    select: publicUserSelect,
  });
}

function updateSample(sampleId, data) {
  return prisma.sample.update({
    where: { id: sampleId },
    data,
    include: {
      assignedVerifier: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          status: true,
        },
      },
    },
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
  getUserById,
  updateUser,
  updateSample,
  listUsersByRole,
  countUsersByRole,
  getCustomerSummary,
};
