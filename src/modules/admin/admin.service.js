const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const { getPagination } = require("../../utils/pagination");
const adminRepository = require("./admin.repository");
const orderRepository = require("../orders/order.repository");

function decimalToNumber(value) {
  return value === null || value === undefined ? 0 : Number(value);
}

function parseDateRange(query = {}) {
  const fallbackFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const dateFrom = query.dateFrom ? new Date(query.dateFrom) : fallbackFrom;
  const dateTo = query.dateTo ? new Date(query.dateTo) : new Date();

  if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime())) {
    throw new ApiError(400, "Invalid date range.");
  }

  if (dateFrom > dateTo) {
    throw new ApiError(400, "dateFrom cannot be after dateTo.");
  }

  return { dateFrom, dateTo };
}

function mapCountRows(rows) {
  return rows.map((row) => ({
    key: Object.values(row)[0],
    count: row._count._all,
  }));
}

async function getDashboardOverview(query) {
  const { dateFrom, dateTo } = parseDateRange(query);

  const [usersByRole, productsByStatus, draftsByStatus, ordersByStatus, revenue, aiUsage] = await Promise.all([
    adminRepository.listUsersByRole(),
    adminRepository.listProductsByStatus(),
    adminRepository.listDraftsByStatus(),
    adminRepository.listOrdersByStatus(dateFrom, dateTo),
    adminRepository.aggregateRevenue(dateFrom, dateTo),
    Promise.all([
      prisma.chatSession.count({
        where: {
          createdAt: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
      }),
      prisma.reportJob.count({
        where: {
          createdAt: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
      }),
    ]),
  ]);

  return {
    range: {
      from: dateFrom,
      to: dateTo,
    },
    users: mapCountRows(usersByRole),
    products: mapCountRows(productsByStatus),
    drafts: mapCountRows(draftsByStatus),
    orders: mapCountRows(ordersByStatus),
    revenue: {
      successfulPayments: revenue._count._all,
      amount: decimalToNumber(revenue._sum.amount),
    },
    aiUsage: {
      chatSessions: aiUsage[0],
      reportJobs: aiUsage[1],
    },
    futureExtensions: {
      riskAlerts: null,
      artisanCohortHealth: null,
    },
  };
}

async function getDashboardRevenue(query) {
  const { dateFrom, dateTo } = parseDateRange(query);
  const [aggregate, payments] = await Promise.all([
    adminRepository.aggregateRevenue(dateFrom, dateTo),
    adminRepository.listRevenuePayments(dateFrom, dateTo),
  ]);

  const byDayMap = new Map();
  const byProviderMap = new Map();

  for (const payment of payments) {
    const day = payment.createdAt.toISOString().slice(0, 10);
    byDayMap.set(day, (byDayMap.get(day) || 0) + decimalToNumber(payment.amount));

    const providerKey = payment.provider;
    if (!byProviderMap.has(providerKey)) {
      byProviderMap.set(providerKey, { provider: providerKey, amount: 0, count: 0 });
    }

    const providerItem = byProviderMap.get(providerKey);
    providerItem.amount += decimalToNumber(payment.amount);
    providerItem.count += 1;
  }

  return {
    range: {
      from: dateFrom,
      to: dateTo,
    },
    totals: {
      successfulPayments: aggregate._count._all,
      amount: decimalToNumber(aggregate._sum.amount),
    },
    byProvider: [...byProviderMap.values()].sort((a, b) => b.amount - a.amount),
    byDay: [...byDayMap.entries()].map(([day, amount]) => ({ day, amount })),
    futureExtensions: {
      anomalyDetection: null,
      exchangeRateImpact: null,
    },
  };
}

async function getVerificationQueue(query) {
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 100);
  const pending = await adminRepository.listPendingVerifications(limit);

  return {
    count: pending.length,
    items: pending,
    futureExtensions: {
      aiImageQualityScore: null,
      reviewerLoadBalancing: null,
    },
  };
}

async function getPendingSamples(query) {
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 5, 1), 50);
  const samples = await adminRepository.listSamplesByStatus("SUBMITTED", limit);

  return {
    count: samples.length,
    items: samples,
  };
}

async function getRecentOrders(query) {
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 100);
  const orders = await adminRepository.listRecentOrders(limit);

  return {
    items: orders,
  };
}

async function getTopArtisans(query) {
  const { dateFrom, dateTo } = parseDateRange(query);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 10, 1), 50);

  const groups = await adminRepository.groupTopArtisans(dateFrom, dateTo, limit);
  const artisans = await adminRepository.listArtisansByIds(groups.map((group) => group.artisanId));
  const artisanById = new Map(artisans.map((artisan) => [artisan.id, artisan]));

  return {
    range: {
      from: dateFrom,
      to: dateTo,
    },
    items: groups.map((group) => ({
      artisanId: group.artisanId,
      artisan: artisanById.get(group.artisanId) || null,
      revenue: decimalToNumber(group._sum.lineTotal),
      unitsSold: decimalToNumber(group._sum.quantity),
      orderItems: group._count._all,
    })),
  };
}

async function getAuditLogs(query) {
  const pagination = getPagination(query);
  const [items, total] = await Promise.all([adminRepository.listAuditLogs(pagination), adminRepository.countAuditLogs()]);

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

async function getUsers(query) {
  const pagination = getPagination(query);

  const where = {};
  if (query.role) {
    where.role = query.role;
  }

  if (query.search) {
    where.OR = [
      { firstName: { contains: query.search, mode: "insensitive" } },
      { lastName: { contains: query.search, mode: "insensitive" } },
      { email: { contains: query.search, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    adminRepository.listUsers(pagination, where),
    adminRepository.countUsers(where),
  ]);

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

async function getUser(userId) {
  const user = await adminRepository.getUserById(userId);

  if (!user) {
    throw new ApiError(404, "User was not found.");
  }

  if (user.role === "CUSTOMER") {
    user.customerSummary = await adminRepository.getCustomerSummary(userId);
  }

  if (user.role === "ARTISAN") {
    const [productTotal, approvedProducts, pendingSamples] = await Promise.all([
      prisma.product.count({ where: { artisanId: userId } }),
      prisma.product.count({ where: { artisanId: userId, status: { in: ["APPROVED", "PUBLISHED"] } } }),
      prisma.sample.count({ where: { artisanId: userId, status: "SUBMITTED" } }),
    ]);

    user.artisanProfile = user.artisanProfile || {};
    user.artisanProfile.extensionData = {
      ...(user.artisanProfile.extensionData || {}),
      productStats: {
        total: productTotal,
        approved: approvedProducts,
      },
      sampleStats: {
        pending: pendingSamples,
      },
    };
  }

  if (user.role === "VERIFICATION_AGENT") {
    const [assignedSamples, approvedSamples, rejectedSamples] = await Promise.all([
      prisma.sample.count({ where: { assignedVerifierId: userId } }),
      prisma.sample.count({ where: { assignedVerifierId: userId, status: "APPROVED" } }),
      prisma.sample.count({ where: { assignedVerifierId: userId, status: "REJECTED" } }),
    ]);

    user.agentSummary = {
      assignedSamples,
      approvedSamples,
      rejectedSamples,
    };
  }

  return user;
}

async function getUsersByRole(role, query) {
  const pagination = getPagination(query);
  const search = query?.search;

  const [items, total] = await Promise.all([
    adminRepository.listUsersByRole(role, pagination, search),
    adminRepository.countUsersByRole(role, search),
  ]);

  return {
    role,
    items,
    meta: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit) || 1,
    },
  };
}

async function getOrders(query) {
  const pagination = getPagination(query);

  const where = {};

  if (query.userId)   where.customerId = query.userId;
  if (query.status)   where.status     = query.status;

  if (query.dateFrom || query.dateTo) {
    where.createdAt = {};
    if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
    if (query.dateTo)   where.createdAt.lte = new Date(query.dateTo);
  }

  // search: try to match order id or customer name/email
  if (query.search) {
    where.OR = [
      { id: { contains: query.search, mode: "insensitive" } },
      { customer: { email:     { contains: query.search, mode: "insensitive" } } },
      { customer: { firstName: { contains: query.search, mode: "insensitive" } } },
      { customer: { lastName:  { contains: query.search, mode: "insensitive" } } },
    ];
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

async function getOrder(orderId) {
  const order = await orderRepository.findOrderById(orderId);
  if (!order) throw new ApiError(404, "Order was not found.");
  return order;
}

async function updateUser(userId, payload, actorId) {
  const user = await adminRepository.getUserById(userId);
  if (!user) {
    throw new ApiError(404, "User was not found.");
  }

  let updateData = { ...payload };
  if (updateData.artisanProfile) {
    const profileUpdates = updateData.artisanProfile;
    delete updateData.artisanProfile;
    updateData.artisanProfile = {
      upsert: {
        create: {
          shopName: profileUpdates.shopName || "New Artisan Shop",
          bio: profileUpdates.bio,
          region: profileUpdates.region,
          city: profileUpdates.city,
        },
        update: profileUpdates
      }
    };
  }

  const updatedUser = await adminRepository.updateUser(userId, updateData);

  await adminRepository.createAuditLog({
    actorId,
    action: "OTHER",
    entityType: "USER",
    entityId: userId,
    description: `Updated properties for user ${userId}`,
    metadata: { payload },
  });

  return updatedUser;
}

async function updateSample(sampleId, payload, actorId) {
  // If caller is assigning a verifier, ensure the user exists and has the right role
  if (payload.assignedVerifierId) {
    const verifier = await prisma.user.findUnique({
      where: { id: payload.assignedVerifierId },
      select: { id: true, role: true },
    });
    if (!verifier) {
      throw new ApiError(404, "Assigned verifier user was not found.");
    }
    if (verifier.role !== "VERIFICATION_AGENT") {
      throw new ApiError(400, "The assigned user is not a verification agent.");
    }
  }

  const updatedSample = await adminRepository.updateSample(sampleId, payload);

  const isAgentAssignment = payload.assignedVerifierId !== undefined;
  await adminRepository.createAuditLog({
    actorId,
    action: "OTHER",
    entityType: "SAMPLE",
    entityId: sampleId,
    description: isAgentAssignment
      ? `Admin assigned verifier ${payload.assignedVerifierId} to sample ${sampleId}`
      : `Updated properties for sample ${sampleId}`,
    metadata: { payload },
  });

  return updatedSample;
}

async function deleteSample(sampleId, actorId) {
  const sample = await prisma.sample.findUnique({ where: { id: sampleId } });
  if (!sample) {
    throw new ApiError(404, "Product sample was not found.");
  }

  await prisma.sample.delete({ where: { id: sampleId } });

  await adminRepository.createAuditLog({
    actorId,
    action: "OTHER",
    entityType: "SAMPLE",
    entityId: sampleId,
    description: `Deleted sample ${sample.title}`,
    metadata: null,
  });

  return true;
}

function createAuditLog(payload) {
  return adminRepository.createAuditLog(payload);
}

module.exports = {
  getDashboardOverview,
  getDashboardRevenue,
  getVerificationQueue,
  getRecentOrders,
  getTopArtisans,
  getAuditLogs,
  getUsers,
  getUser,
  getUsersByRole,
  updateUser,
  updateSample,
  deleteSample,
  createAuditLog,
  getOrders,
  getOrder,
  getPendingSamples,
};
