const xss = require("xss");
const prisma = require("../../config/prisma");
const bcrypt = require("bcryptjs");
const ApiError = require("../../utils/apiError");
const { getPagination } = require("../../utils/pagination");
const adminRepository = require("./admin.repository");
const orderRepository = require("../orders/order.repository");
const notificationService = require("../notifications/notification.service");
const { deepMerge, readSettings, writeSettings } = require("./admin.settings.store");

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
  return rows.map((row) => {
    const groupKeys = Object.keys(row).filter((k) => k !== '_count');
    let key = '';
    if (groupKeys.length === 1) {
      const v = row[groupKeys[0]];
      key = v == null ? '' : String(v);
    } else if (groupKeys.length > 1) {
      key = groupKeys.map((k) => String(row[k] ?? '')).join(' · ');
    }
    return {
      key,
      count: row._count?._all ?? 0,
    };
  });
}

async function getDashboardOverview(query) {
  const { dateFrom, dateTo } = parseDateRange(query);

  const [usersByRole, productsByStatus, draftsByStatus, ordersByStatus, revenue, aiUsage, totalUsers, activeArtisans, pendingSamples] = await Promise.all([
    adminRepository.groupUsersByRole(),
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
    prisma.user.count(),
    prisma.user.count({ where: { role: "ARTISAN", status: "ACTIVE" } }),
    prisma.sample.count({ where: { status: "SUBMITTED" } }),
  ]);

  return {
    range: {
      from: dateFrom,
      to: dateTo,
    },
    counts: {
      totalUsers,
      activeArtisans,
      pendingSamples,
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

async function getAgentMetrics() {
  const agents = await prisma.user.findMany({
    where: { role: "VERIFICATION_AGENT" },
    include: {
      assignedSamples: {
        select: {
          id: true,
          status: true,
          createdAt: true,
          reviewedAt: true,
        },
      },
    },
  });

  const totalAgents = agents.length;
  const activeAgents = agents.filter((a) => a.status === "ACTIVE").length;
  const inactiveAgents = totalAgents - activeAgents;

  let totalAssigned = 0;
  let totalCompleted = 0;
  let totalTaskTimeMs = 0;
  let completedWithTime = 0;

  for (const agent of agents) {
    totalAssigned += agent.assignedSamples.length;
    for (const sample of agent.assignedSamples) {
      if (sample.status === "APPROVED" || sample.status === "REJECTED") {
        totalCompleted += 1;
        if (sample.reviewedAt && sample.createdAt) {
          const duration = sample.reviewedAt.getTime() - sample.createdAt.getTime();
          if (duration > 0) {
            totalTaskTimeMs += duration;
            completedWithTime += 1;
          }
        }
      }
    }
  }

  const avgCompletionRate = totalAssigned > 0 ? (totalCompleted / totalAssigned) * 100 : 0;
  const avgTaskTimeHours = completedWithTime > 0 ? totalTaskTimeMs / (1000 * 60 * 60 * completedWithTime) : 0;

  return {
    totalAgents,
    activeAgents,
    inactiveAgents,
    avgCompletionRate: Number.parseFloat(avgCompletionRate.toFixed(1)),
    avgTaskTimeHours: Number.parseFloat(avgTaskTimeHours.toFixed(1)),
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

function roleLabel(role) {
  const map = {
    CUSTOMER: "Customer",
    ARTISAN: "Artisan",
    ADMIN: "Admin",
    VERIFICATION_AGENT: "Agent",
  };
  return map[role] || String(role);
}

function orderStatusLabel(status) {
  const map = {
    PENDING_PAYMENT: "Pending",
    PAID: "Paid",
    PROCESSING: "Processing",
    SHIPPED: "Shipped",
    DELIVERED: "Completed",
    CANCELLED: "Cancelled",
  };
  return map[status] || String(status);
}

function userStatusLabel(status) {
  return status === "ACTIVE" ? "Active" : "Suspended";
}

function artisanRowStatus(userStatus, verificationStatus) {
  if (userStatus === "SUSPENDED") return "Suspended";
  if (verificationStatus === "APPROVED") return "Active";
  if (verificationStatus === "REJECTED") return "Suspended";
  return "Pending";
}

async function getDashboardReports(query) {
  const { type } = query;
  const { dateFrom, dateTo } = parseDateRange(query);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 200, 1), 500);
  const rangeEndStr = dateTo.toISOString().slice(0, 10);

  if (type === "orders") {
    const { items } = await orderRepository.listOrders(
      {
        createdAt: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
      { skip: 0, limit },
    );

    const rows = items.map((order) => ({
      id: order.id,
      name: `${order.customer?.firstName || ""} ${order.customer?.lastName || ""}`.trim() || order.customer?.email || "—",
      status: orderStatusLabel(order.status),
      amount: decimalToNumber(order.totalAmount),
      date: order.createdAt.toISOString().slice(0, 10),
      region: order.shippingAddress?.region || "—",
      role: "Customer",
    }));

    return {
      range: { from: dateFrom, to: dateTo },
      type,
      rows,
    };
  }

  if (type === "revenue" || type === "artisans") {
    const groups = await adminRepository.groupTopArtisans(dateFrom, dateTo, limit);
    const artisans = await adminRepository.listArtisansByIds(groups.map((group) => group.artisanId));
    const artisanById = new Map(artisans.map((artisan) => [artisan.id, artisan]));

    const rows = groups.map((group) => {
      const artisan = artisanById.get(group.artisanId);
      const shop = artisan?.artisanProfile?.shopName;
      const name = shop || `${artisan?.firstName || ""} ${artisan?.lastName || ""}`.trim() || "—";
      const verificationStatus = artisan?.artisanProfile?.verificationStatus;

      return {
        id: group.artisanId,
        name,
        status: artisanRowStatus(artisan?.status, verificationStatus),
        amount: decimalToNumber(group._sum.lineTotal),
        date: rangeEndStr,
        region: artisan?.artisanProfile?.region || "—",
        role: "Artisan",
      };
    });

    return {
      range: { from: dateFrom, to: dateTo },
      type,
      rows,
    };
  }

  if (type === "users") {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
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
            region: true,
          },
        },
        _count: {
          select: { customerOrders: true },
        },
      },
    });

    const rows = users.map((u) => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName}`.trim() || u.email,
      status: userStatusLabel(u.status),
      amount: u._count.customerOrders,
      date: u.createdAt.toISOString().slice(0, 10),
      region: u.artisanProfile?.region || "—",
      role: roleLabel(u.role),
    }));

    return {
      range: { from: dateFrom, to: dateTo },
      type,
      rows,
    };
  }

  if (type === "agents") {
    const agents = await prisma.user.findMany({
      where: { role: "VERIFICATION_AGENT" },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        status: true,
        createdAt: true,
        assignedSamples: {
          where: {
            createdAt: {
              gte: dateFrom,
              lte: dateTo,
            },
          },
          select: {
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    const rows = agents.map((a) => {
      const lastSample = a.assignedSamples[0];
      return {
        id: a.id,
        name: `${a.firstName} ${a.lastName}`.trim() || a.email || "—",
        status: userStatusLabel(a.status),
        amount: a.assignedSamples.length,
        date: lastSample ? lastSample.createdAt.toISOString().slice(0, 10) : a.createdAt.toISOString().slice(0, 10),
        region: "—",
        role: "Agent",
      };
    });

    return {
      range: { from: dateFrom, to: dateTo },
      type,
      rows,
    };
  }

  throw new ApiError(400, "Invalid report type.");
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
    adminRepository.listUsersByRolePaginated(role, pagination, search),
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

async function createUser(payload, actorId) {
  const existingUser = await prisma.user.findUnique({ where: { email: payload.email } });
  if (existingUser) {
    throw new ApiError(400, "User with this email already exists.");
  }

  const passwordHash = await bcrypt.hash(payload.password, 12);

  const newUser = await prisma.user.create({
    data: {
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      phone: payload.phone || null,
      passwordHash,
      role: payload.role,
      status: "ACTIVE",
    },
  });

  await adminRepository.createAuditLog({
    actorId,
    action: "OTHER",
    entityType: "USER",
    entityId: newUser.id,
    description: `Admin created new user with role ${payload.role}`,
    metadata: { email: payload.email, role: payload.role },
  });

  return newUser;
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

async function getSettings() {
  return readSettings();
}

async function updateSettings(payload, actorId) {
  const current = await readSettings();
  const merged = deepMerge(current, payload || {});
  await writeSettings(merged);

  await adminRepository.createAuditLog({
    actorId,
    action: "OTHER",
    entityType: "SYSTEM",
    entityId: "ADMIN_SETTINGS",
    description: "Updated admin settings",
    metadata: { updatedKeys: Object.keys(payload || {}) },
  });

  return merged;
}

async function testIntegration(payload) {
  const settings = await readSettings();
  const provider = String(payload?.provider || "").toLowerCase();
  const webhookUrl = payload?.webhookUrl || settings.integrations.webhookUrl;
  const connected = Boolean(settings.integrations.connected?.[provider]);

  return {
    provider,
    connected,
    webhookConfigured: Boolean(webhookUrl),
    status: connected && webhookUrl ? "ok" : "warning",
    message: connected && webhookUrl ? "Integration looks healthy." : "Provider is not connected or webhook URL is missing.",
  };
}

async function regenerateIntegrationKey(actorId) {
  const settings = await readSettings();
  const nextKey = `ec_live_${Math.random().toString(36).slice(2, 14)}${Date.now().toString(36).slice(-6)}`;
  const merged = deepMerge(settings, {
    integrations: {
      apiKey: nextKey,
    },
  });

  await writeSettings(merged);

  await adminRepository.createAuditLog({
    actorId,
    action: "OTHER",
    entityType: "SYSTEM",
    entityId: "ADMIN_SETTINGS",
    description: "Regenerated integrations API key",
    metadata: null,
  });

  return {
    apiKey: nextKey,
  };
}

async function notifyUser(userId, payload, actorId) {
  const targetUser = await adminRepository.getUserById(userId);
  if (!targetUser) {
    throw new ApiError(404, "Target user was not found.");
  }

  const safeTitle = payload.title ? xss(payload.title) : undefined;
  const safeMessage = payload.message ? xss(payload.message) : undefined;

  const notification = await notificationService.createNotification({
    userId,
    type: payload.type || "GENERAL",
    title: safeTitle,
    message: safeMessage,
    metadata: { sentByAdminId: actorId },
  });

  await adminRepository.createAuditLog({
    actorId,
    action: "OTHER",
    entityType: "USER",
    entityId: userId,
    description: `Admin sent manual notification to user`,
    metadata: { title: payload.title, type: payload.type },
  });

  return notification;
}

async function reverifySample(sampleId, payload, actorId) {
  const sample = await prisma.sample.findUnique({ where: { id: sampleId } });
  if (!sample) {
    throw new ApiError(404, "Product sample was not found.");
  }

  const updatedSample = await prisma.$transaction(async (tx) => {
    const updated = await tx.sample.update({
      where: { id: sampleId },
      data: { status: "MORE_INFO_REQUESTED" },
    });

    const safeMessage = payload.message ? xss(payload.message) : undefined;

    await tx.notification.create({
      data: {
        userId: sample.artisanId,
        type: "GENERAL",
        title: "Sample Re-verification Required",
        message: safeMessage,
        metadata: { sampleId, sentByAdminId: actorId },
      },
    });

    return updated;
  });

  await adminRepository.createAuditLog({
    actorId,
    action: "OTHER",
    entityType: "SAMPLE",
    entityId: sampleId,
    description: `Admin requested re-verification for sample`,
    metadata: { message: payload.message },
  });

  return updatedSample;
}

async function generateDashboardPdf(query) {
  // gather the same data the UI uses; tolerate individual failures
  const [overviewRes, revenueRes, ordersRes, auditRes] = await Promise.allSettled([
    getDashboardOverview(query),
    getDashboardRevenue(query),
    getRecentOrders(query),
    getAuditLogs(query),
  ]);

  const overview = overviewRes.status === 'fulfilled' ? overviewRes.value : null;
  const revenue = revenueRes.status === 'fulfilled' ? revenueRes.value : null;
  const orders = ordersRes.status === 'fulfilled' ? ordersRes.value : null;
  const audit = auditRes.status === 'fulfilled' ? auditRes.value : null;

  // small helpers for HTML composition
  const esc = (s) => String(s ?? '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const renderKeyCountTable = (rows) => {
    if (!Array.isArray(rows) || rows.length === 0) return `<p class="placeholder">No data</p>`;
    return `
      <table class="kv">
        <thead><tr><th style="text-align:left">Name</th><th style="text-align:right">Count</th></tr></thead>
        <tbody>
          ${rows.map((r) => `<tr><td>${esc(r.key ?? r.name ?? r.status ?? '')}</td><td style="text-align:right">${Number(r.count ?? (r._count?._all ?? 0))}</td></tr>`).join('')}
        </tbody>
      </table>
    `;
  };

  const makeBarSvg = (items, width = 600, height = 90) => {
    if (!Array.isArray(items) || items.length === 0) return "<div class=\"placeholder\">No chart data</div>";
    const values = items.map((i) => Math.max(0, Number(i.amount || 0)));
    const max = Math.max(...values, 1);
    const barW = Math.max(6, Math.floor(width / values.length));
    const inner = items.map((it, idx) => {
      const v = Number(it.amount || 0);
      const h = Math.round((v / max) * (height - 20));
      const x = idx * barW + 2;
      const y = height - h - 10;
      const label = esc(String((it.day || '').slice(5)));
      return `<g><rect x="${x}" y="${y}" width="${barW - 4}" height="${h}" fill="#C6A75E"></rect><text x="${x + (barW - 4) / 2}" y="${height}" font-size="10" text-anchor="middle" fill="#444">${label}</text></g>`;
    }).join('');
    return `<svg width="${width}" height="${height + 10}" viewBox="0 0 ${width} ${height + 10}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
  };

  const buildOverviewHtml = (o) => {
    if (!o) return `<p class="placeholder">Overview data not available</p>`;
    const totalUsers = o.counts?.totalUsers ?? '—';
    const activeArtisans = o.counts?.activeArtisans ?? '—';
    const pendingSamples = o.counts?.pendingSamples ?? '—';
    const revenueAmount = o.revenue?.amount ?? '—';
    return `
      <div class="summary">
        <div class="card"><div class="label">Total users</div><div class="value">${esc(totalUsers)}</div></div>
        <div class="card"><div class="label">Active artisans</div><div class="value">${esc(activeArtisans)}</div></div>
        <div class="card"><div class="label">Pending samples</div><div class="value">${esc(pendingSamples)}</div></div>
        <div class="card"><div class="label">Revenue (ETB)</div><div class="value">${typeof revenueAmount === 'number' ? 'ETB ' + revenueAmount.toLocaleString() : esc(revenueAmount)}</div></div>
      </div>
      <h3>Products by status</h3>
      ${renderKeyCountTable(o.products ?? [])}
      <h3>Drafts by status</h3>
      ${renderKeyCountTable(o.drafts ?? [])}
      <h3>Orders by status</h3>
      ${renderKeyCountTable(o.orders ?? [])}
    `;
  };

  const buildRevenueHtml = (r) => {
    if (!r) return `<p class="placeholder">Revenue data not available</p>`;
    const total = r.totals?.amount ?? r.amount ?? 0;
    const payments = r.totals?.successfulPayments ?? r.successfulPayments ?? 0;
    const byProvider = Array.isArray(r.byProvider) ? r.byProvider : [];
    const byDay = Array.isArray(r.byDay) ? r.byDay : [];
    return `
      <div class="rev-summary"><div>Total: <strong>ETB ${Number(total).toLocaleString()}</strong></div><div>Payments: <strong>${Number(payments).toLocaleString()}</strong></div></div>
      <h4>Revenue by provider</h4>
      ${byProvider.length ? `<table class="kv"><thead><tr><th>Provider</th><th style="text-align:right">Amount</th><th style="text-align:right">Count</th></tr></thead><tbody>${byProvider.map((p) => `<tr><td>${esc(p.provider || p.name || '')}</td><td style="text-align:right">ETB ${Number(p.amount || 0).toLocaleString()}</td><td style="text-align:right">${Number(p.count || 0)}</td></tr>`).join('')}</tbody></table>` : '<p class="placeholder">No provider breakdown</p>'}
      <h4>Revenue trend</h4>
      ${makeBarSvg(byDay, 700, 90)}
    `;
  };

  const buildOrdersHtml = (obj) => {
    const items = obj?.items || obj?.rows || obj || [];
    if (!Array.isArray(items) || items.length === 0) return `<p class="placeholder">Orders data not available</p>`;
    const rowsHtml = items.slice(0, 50).map((it) => {
      const id = it.id || it.orderId || it._id || '';
      const name = it.customer ? `${it.customer.firstName || ''} ${it.customer.lastName || ''}`.trim() || it.customer.email : it.name || it.customerName || '';
      const status = it.status || it.orderStatus || '';
      const amount = it.totalAmount ?? it.amount ?? it.lineTotal ?? 0;
      const date = it.createdAt ? (new Date(it.createdAt)).toISOString().slice(0,10) : (it.date || '');
      const region = (it.shippingAddress && it.shippingAddress.region) || it.region || '';
      return `<tr><td>${esc(id)}</td><td>${esc(name)}</td><td>${esc(status)}</td><td style="text-align:right">ETB ${Number(amount).toLocaleString()}</td><td>${esc(region)}</td><td>${esc(date)}</td></tr>`;
    }).join('');
    return `
      <table class="full">
        <thead><tr><th>Order ID</th><th>Customer</th><th>Status</th><th style="text-align:right">Amount</th><th>Region</th><th>Date</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `;
  };

  const buildAuditHtml = (a) => {
    const items = a?.items || a || [];
    if (!Array.isArray(items) || items.length === 0) return `<p class="placeholder">Audit logs service unavailable</p>`;
    const rows = items.slice(0, 100).map((log) => {
      const ts = log.createdAt ? new Date(log.createdAt).toISOString().slice(0,10) : (log.date || '');
      const actor = (log.actor && (log.actor.email || log.actor.name)) || log.actorId || 'system';
      const action = log.action || (log.type || 'OTHER');
      const entity = `${log.entityType || log.target || log.entity || ''} ${log.entityId || ''}`.trim();
      const desc = log.description || (log.message || '');
      const low = String(action).toLowerCase();
      const cls = low.includes('delete') || String(desc).toLowerCase().includes('deleted') ? 'hl-delete' : low.includes('create') || low.includes('approve') || String(desc).toLowerCase().includes('approved') ? 'hl-create' : low.includes('update') ? 'hl-update' : '';
      return `<tr class="${cls}"><td>${esc(ts)}</td><td>${esc(actor)}</td><td>${esc(action)}</td><td>${esc(entity)}</td><td>${esc(desc)}</td></tr>`;
    }).join('');
    return `
      <table class="full">
        <thead><tr><th>Date</th><th>Actor</th><th>Action</th><th>Entity</th><th>Description</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  };

  const now = new Date().toISOString();

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>EthioCraft Admin Report</title><style>
    body{font-family:Inter,Arial,Helvetica,sans-serif;padding:24px;color:#111;background:#f6f6f4}
    .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
    h1{margin:0;font-size:20px}
    h2{margin:8px 0 12px;font-size:16px;color:#111}
    .section{margin-bottom:18px;padding:14px;border-radius:8px;border:1px solid #eee;background:#fff}
    .placeholder{color:#b91c1c;font-weight:700}
    .summary{display:flex;gap:12px;margin-bottom:12px}
    .card{flex:1;padding:8px;border-radius:8px;background:#fafafa;border:1px solid #efefef}
    .card .label{font-size:11px;color:#666}
    .card .value{font-size:16px;font-weight:700;margin-top:6px}
    table.kv{width:100%;border-collapse:collapse;margin-top:8px}
    table.kv th, table.kv td{padding:6px 8px;border-bottom:1px solid #f0f0f0}
    table.full{width:100%;border-collapse:collapse;margin-top:8px;font-size:12px}
    table.full th, table.full td{padding:8px 10px;border-bottom:1px solid #eee}
    .hl-delete{background:#fee2e2}
    .hl-create{background:#ecfdf5}
    .hl-update{background:#fffbeb}
    pre{background:#f7f7f7;padding:10px;border-radius:6px;overflow:auto;white-space:pre-wrap;word-break:break-word}
    .rev-summary{display:flex;gap:18px;margin-bottom:8px}
    @media print{ body{background:#fff} .section{page-break-inside:avoid} }
  </style></head><body>` +
    `<div class="header"><h1>EthioCraft Admin Report</h1><div>${esc(now)}</div></div>` +
    `<div class="section"><h2>Overview</h2>${buildOverviewHtml(overview)}</div>` +
    `<div class="section"><h2>Revenue</h2>${buildRevenueHtml(revenue)}</div>` +
    `<div class="section"><h2>Recent Orders</h2>${buildOrdersHtml(orders)}</div>` +
    `<div class="section"><h2>Audit Logs</h2>${buildAuditHtml(audit)}</div>` +
    `</body></html>`;

  // render PDF using puppeteer
  let browser = null;
  try {
    // lazy require to avoid loading unless needed
    // eslint-disable-next-line global-require
    const puppeteer = require('puppeteer');
    browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const buffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' } });
    await page.close();
    await browser.close();
    return buffer;
  } catch (e) {
    if (browser) {
      try { await browser.close(); } catch (_) {}
    }
    throw e;
  }
}

module.exports = {
  getDashboardOverview,
  getDashboardRevenue,
  getVerificationQueue,
  getRecentOrders,
  getTopArtisans,
  getDashboardReports,
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
  getAgentMetrics,
  createUser,
  getSettings,
  updateSettings,
  testIntegration,
  regenerateIntegrationKey,
  notifyUser,
  reverifySample,
  generateDashboardPdf,
};
