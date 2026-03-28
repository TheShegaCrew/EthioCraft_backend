const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const aiRepository = require("./ai.repository");
const {generate, estimateTokens} = require("./llmUtils");
const { SYSTEM_PROMPTS, BLOCKED_PATTERNS, INTENT_CLASSIFICATION_PROMPT } = require("./ai.constants");
const { de } = require("zod/v4/locales");
const SUCCESS_ORDER_STATUSES = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"];

function decimalToNumber(value) {
  return value === null || value === undefined ? 0 : Number(value);
}

function parseDateRange(filters = {}) {
  const defaultDateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const dateFrom = filters.dateFrom ? new Date(filters.dateFrom) : defaultDateFrom;
  const dateTo = filters.dateTo ? new Date(filters.dateTo) : new Date();

  if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime())) {
    throw new ApiError(400, "Invalid report date range.");
  }

  if (dateFrom > dateTo) {
    throw new ApiError(400, "dateFrom cannot be after dateTo.");
  }

  return { dateFrom, dateTo };
}

function assertSessionAccess(user, session) {
  if (!session) {
    throw new ApiError(404, "Chat session was not found.");
  }

  if (user.role !== "ADMIN" && session.userId !== user.id) {
    throw new ApiError(404, "Chat session was not found.");
  }
}
function buildFallbackReply(message, user, intent) {
  const name = user?.firstName || 'there';
  const replies = {
    ORDER_ASSISTANCE: `Hi ${name}, I can help with your order. Please share your order ID and I'll look up the status, delivery timeline, and any required actions.`,
    PAYMENT_ASSISTANCE: `Hi ${name}, for payment issues please confirm your provider (TeleBirr or Chapa) and reference number. Common fixes include retrying the payment, checking your balance, or verifying the phone number on file.`,
    PRODUCT_HELP: `Hi ${name}, for product listing or verification, make sure you have: ✅ Clear product photos ✅ Cultural origin and craftsmanship details ✅ Accurate pricing in ETB. I can walk you through each step.`,
    ACCOUNT_HELP: `Hi ${name}, for account issues you can reset your password from the login page or update your profile in Settings. If you're locked out, contact support@ethiocraft.com.`,
    PLATFORM_INFO: `Hi ${name}, EthioCraft connects Ethiopian artisans with global buyers. Sellers can list handcrafted products, and buyers can purchase with TeleBirr or Chapa. Visit our FAQ for detailed platform policies.`,
    GREETING: `Selam ${name}! 👋 Welcome to EthioCraft. How can I help you today?`,
    GENERAL_SUPPORT: `Thanks ${name}! I'm here to help with orders, payments, products, or any marketplace questions. Could you tell me a bit more about what you need?`,
  };
  return replies[intent] || replies.GENERAL_SUPPORT;
}
async function classifyIntent(message) {
  try {
    const prompt = INTENT_CLASSIFICATION_PROMPT.replace('{message}', message.slice(0, 300));
    const { text } = await generate(prompt, {
      temperature: 0.1,
      max_new_tokens: 20,
    });
    const validIntents = [
      'ORDER_ASSISTANCE',
      'PAYMENT_ASSISTANCE',
      'PRODUCT_HELP',
      'ACCOUNT_HELP',
      'PLATFORM_INFO',
      'GREETING',
      'GENERAL_SUPPORT',
    ];
    const cleaned = text.toUpperCase().trim().replace(/[^A-Z_]/g, '');
    return validIntents.includes(cleaned) ? cleaned : 'GENERAL_SUPPORT';
  } catch {
    // If intent classification fails, don't block the response
    return 'GENERAL_SUPPORT';
  }
}
function buildConversationPrompt({ systemPrompt, history, currentMessage, maxContextTokens = 2000 }) {
  const messageParts = [];
  let tokenBudget = maxContextTokens;
  // Always include the current message
  const currentPart = `User: ${currentMessage}`;
  tokenBudget -= estimateTokens(currentPart);
  // Walk history backwards, adding recent messages first
  for (let i = history.length - 1; i >= 0 && tokenBudget > 0; i--) {
    const msg = history[i];
    const formatted =
      msg.role === 'USER' ? `User: ${msg.content}` : `Assistant: ${msg.content}`;
    const tokens = estimateTokens(formatted);
    if (tokens > tokenBudget) break;
    tokenBudget -= tokens;
    messageParts.unshift(formatted);
  }
  return [
    `### System\n${systemPrompt}`,
    '',
    '### Conversation',
    ...messageParts,
    currentPart,
    '',
    'Assistant:',
  ].join('\n');
}
function validateResponse(text) {
  if (!text || text.length < 2) {
    return { valid: false, reason: 'Response too short' };
  }
  if (text.length > 3000) {
    return { valid: false, reason: 'Response too long' };
  }
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(text)) {
      return { valid: false, reason: 'Response contains blocked content' };
    }
  }
  return { valid: true };
}
function detectLanguage(text) {
  // Simple Amharic detection via Unicode Ethiopic range (U+1200–U+137F)
  const ethiopicChars = (text.match(/[\u1200-\u137F]/g) || []).length;
  const ratio = ethiopicChars / Math.max(text.length, 1);
  if (ratio > 0.3) return 'am'; // Amharic
  return 'en';
}
async function generateLLMResponse(message, user, conversationHistory = []) {
  const lang = detectLanguage(message);
  const intent = await classifyIntent(message);
  // Pick system prompt based on user role
  const role = user?.role?.toLowerCase() || 'default';
  let systemPrompt = SYSTEM_PROMPTS[role] || SYSTEM_PROMPTS.default;
  // Add language hint
  if (lang === 'am') {
    systemPrompt += '\n- The user is writing in Amharic. Respond in Amharic.';
  }
  // Build multi-turn prompt
  const fullPrompt = buildConversationPrompt({
    systemPrompt,
    history: conversationHistory,
    currentMessage: message,
    maxContextTokens: 2000,
  });
  try {
    const result = await generate(fullPrompt, {
      temperature: 0.7,
      max_new_tokens: 300,
    });
    // Validate response
    const validation = validateResponse(result.text);
    if (!validation.valid) {
      console.warn(`[AI] Response failed validation: ${validation.reason}`);
      const fallback = buildFallbackReply(message, user, intent);
      return {
        content: fallback,
        intent,
        source: 'GUARDRAIL_FALLBACK',
        language: lang,
        model: result.model,
        latencyMs: result.latencyMs,
      };
    }
    return {
      intent: "PAYMENT_ASSISTANCE",
      content:
        "For payment help, confirm your provider (TeleBirr or Chapa) and payment reference. I can then suggest retry, verification, or webhook reconciliation steps.",
    };
  }

  if (text.includes("product") || text.includes("verify") || text.includes("approval")) {
    return {
      intent: "PRODUCT_VERIFICATION",
      content:
        "For product verification, ensure your draft has images, cultural metadata, and clear craftsmanship notes before submission. I can suggest a checklist for your next draft.",
    };
  }

  return {
    intent: "GENERAL_SUPPORT",
    content: `Thanks ${user.firstName || "there"}. This AI response is currently scaffolded; connect your LLM provider to generate richer multilingual support answers.`,
  };
}

async function createChatSession(userId, payload) {
  const session = await aiRepository.createChatSession(userId, payload);

  await aiRepository.createChatMessage(session.id, {
    role: "SYSTEM",
    content: "You are the EthioCraft marketplace assistant. Keep responses concise, practical, and culturally respectful.",
    metadata: {
      provider: "SCAFFOLD",
      note: "Replace with production LLM orchestration.",
    },
  });

  return aiRepository.findChatSessionById(session.id);
}

async function listChatSessions(user) {
  if (user.role === "ADMIN") {
    return aiRepository.listChatSessions(user.id);
  }

  return aiRepository.listChatSessions(user.id);
}

async function getChatSession(user, sessionId) {
  const session = await aiRepository.findChatSessionById(sessionId);
  assertSessionAccess(user, session);
  return session;
}

async function createChatMessage(user, sessionId, message) {
  const session = await aiRepository.findChatSessionById(sessionId);
  assertSessionAccess(user, session);

  if (session.status !== "OPEN") {
    throw new ApiError(409, "Chat session is not open for new messages.");
  }

  await aiRepository.createChatMessage(sessionId, {
    role: "USER",
    content: message,
  });

  const assistantReply = buildAssistantReply(message, user);
  await aiRepository.createChatMessage(sessionId, {
    role: "ASSISTANT",
    content: assistantReply.content,
    metadata: {
      intent: assistantReply.intent,
      mode: "RULE_BASED_PLACEHOLDER",
    },
  });

  return aiRepository.updateChatSession(sessionId, {
    title: session.title || message.slice(0, 80),
  });
}

async function generateSalesSummary(filters, artisanId) {
  const { dateFrom, dateTo } = parseDateRange(filters);
  const orderWhere = {
    status: {
      in: SUCCESS_ORDER_STATUSES,
    },
    createdAt: {
      gte: dateFrom,
      lte: dateTo,
    },
    ...(artisanId
      ? {
          items: {
            some: {
              artisanId,
            },
          },
        }
      : {}),
  };

  const paymentWhere = {
    status: "SUCCESS",
    createdAt: {
      gte: dateFrom,
      lte: dateTo,
    },
    ...(artisanId
      ? {
          order: {
            items: {
              some: {
                artisanId,
              },
            },
          },
        }
      : {}),
  };

  const [orderAggregate, paymentsByProvider] = await Promise.all([
    prisma.order.aggregate({
      where: orderWhere,
      _count: { _all: true },
      _sum: { totalAmount: true },
      _avg: { totalAmount: true },
    }),
    prisma.payment.groupBy({
      by: ["provider"],
      where: paymentWhere,
      _count: { _all: true },
      _sum: { amount: true },
    }),
  ]);

  return {
    range: {
      from: dateFrom,
      to: dateTo,
    },
    totalOrders: orderAggregate._count._all,
    totalRevenue: decimalToNumber(orderAggregate._sum.totalAmount),
    averageOrderValue: decimalToNumber(orderAggregate._avg.totalAmount),
    byProvider: paymentsByProvider.map((row) => ({
      provider: row.provider,
      payments: row._count._all,
      amount: decimalToNumber(row._sum.amount),
    })),
    futureExtensions: {
      forecastDemand: null,
      churnSignals: null,
    },
  };
}

async function generateOrderPerformance(filters, artisanId) {
  const { dateFrom, dateTo } = parseDateRange(filters);
  const where = {
    createdAt: {
      gte: dateFrom,
      lte: dateTo,
    },
    ...(artisanId
      ? {
          items: {
            some: {
              artisanId,
            },
          },
        }
      : {}),
  };

  const [breakdown, deliveredOrders] = await Promise.all([
    prisma.order.groupBy({
      by: ["status"],
      where,
      _count: {
        _all: true,
      },
    }),
    prisma.order.findMany({
      where: {
        ...where,
        deliveredAt: {
          not: null,
        },
      },
      select: {
        createdAt: true,
        deliveredAt: true,
      },
    }),
  ]);

  const avgFulfillmentHours =
    deliveredOrders.length > 0
      ? deliveredOrders.reduce((sum, item) => sum + (item.deliveredAt - item.createdAt) / (1000 * 60 * 60), 0) / deliveredOrders.length
      : 0;

  return {
    range: {
      from: dateFrom,
      to: dateTo,
    },
    statusBreakdown: breakdown.map((row) => ({
      status: row.status,
      count: row._count._all,
    })),
    avgFulfillmentHours: Number(avgFulfillmentHours.toFixed(2)),
    futureExtensions: {
      delayRiskSegments: null,
    },
  };
}

async function generateVerificationReport(filters, artisanId) {
  const { dateFrom, dateTo } = parseDateRange(filters);
  const where = {
    createdAt: {
      gte: dateFrom,
      lte: dateTo,
    },
    ...(artisanId ? { artisanId } : {}),
  };

  const [statusBreakdown, reviewedDrafts, pendingDrafts] = await Promise.all([
    prisma.productDraft.groupBy({
      by: ["status"],
      where,
      _count: {
        _all: true,
      },
    }),
    prisma.productDraft.findMany({
      where: {
        ...where,
        submittedAt: {
          not: null,
        },
        reviewedAt: {
          not: null,
        },
      },
      select: {
        submittedAt: true,
        reviewedAt: true,
      },
    }),
    prisma.productDraft.findMany({
      where: {
        ...where,
        status: "SUBMITTED",
      },
      orderBy: {
        submittedAt: "asc",
      },
      take: 15,
      select: {
        id: true,
        title: true,
        submittedAt: true,
        artisan: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            artisanProfile: {
              select: {
                shopName: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const avgReviewHours =
    reviewedDrafts.length > 0
      ? reviewedDrafts.reduce((sum, row) => sum + (row.reviewedAt - row.submittedAt) / (1000 * 60 * 60), 0) / reviewedDrafts.length
      : 0;

  return {
    range: {
      from: dateFrom,
      to: dateTo,
    },
    statusBreakdown: statusBreakdown.map((row) => ({
      status: row.status,
      count: row._count._all,
    })),
    avgReviewHours: Number(avgReviewHours.toFixed(2)),
    pendingQueue: pendingDrafts,
    futureExtensions: {
      visionAssistedQualityScoring: null,
    },
  };
}

async function generateArtisanPerformance(filters, artisanId) {
  const { dateFrom, dateTo } = parseDateRange(filters);
  const groupedItems = await prisma.orderItem.groupBy({
    by: ["artisanId"],
    where: {
      order: {
        createdAt: {
          gte: dateFrom,
          lte: dateTo,
        },
        status: {
          in: SUCCESS_ORDER_STATUSES,
        },
      },
      ...(artisanId ? { artisanId } : {}),
    },
    _sum: {
      lineTotal: true,
      quantity: true,
    },
    _count: {
      _all: true,
    },
  });

  const artisanIds = groupedItems.map((item) => item.artisanId);
  const artisans = artisanIds.length
    ? await prisma.user.findMany({
        where: {
          id: {
            in: artisanIds,
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
      })
    : [];

  const artisansById = new Map(artisans.map((artisan) => [artisan.id, artisan]));

  return {
    range: {
      from: dateFrom,
      to: dateTo,
    },
    items: groupedItems
      .map((row) => ({
        artisanId: row.artisanId,
        artisan: artisansById.get(row.artisanId) || null,
        orderItems: row._count._all,
        unitsSold: decimalToNumber(row._sum.quantity),
        revenue: decimalToNumber(row._sum.lineTotal),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 20),
    futureExtensions: {
      skillGapInsights: null,
      coopMatching: null,
    },
  };
}

async function generateReportData(type, filters, artisanId) {
  if (type === "SALES_SUMMARY") {
    return generateSalesSummary(filters, artisanId);
  }

  if (type === "ORDER_PERFORMANCE") {
    return generateOrderPerformance(filters, artisanId);
  }

  if (type === "PRODUCT_VERIFICATION") {
    return generateVerificationReport(filters, artisanId);
  }

  if (type === "ARTISAN_PERFORMANCE") {
    return generateArtisanPerformance(filters, artisanId);
  }

  throw new ApiError(400, "Unsupported report type.");
}

function resolveReportArtisanScope(user, filters = {}) {
  if (user.role === "ARTISAN") {
    if (filters.artisanId && filters.artisanId !== user.id) {
      throw new ApiError(403, "Artisans can only generate reports for their own shop.");
    }

    return user.id;
  }

  return filters.artisanId || null;
}

async function createReportJob(user, payload) {
  const filters = payload.filters || {};
  const artisanScope = resolveReportArtisanScope(user, filters);

  const job = await aiRepository.createReportJob({
    requestedById: user.id,
    type: payload.type,
    status: "QUEUED",
    filters,
  });

  await aiRepository.updateReportJob(job.id, {
    status: "RUNNING",
    startedAt: new Date(),
  });

  try {
    const result = await generateReportData(payload.type, filters, artisanScope);
    const completed = await aiRepository.updateReportJob(job.id, {
      status: "COMPLETED",
      completedAt: new Date(),
      result,
      errorMessage: null,
    });

    await prisma.adminAuditLog.create({
      data: {
        actorId: user.id,
        action: "GENERATE_REPORT",
        entityType: "REPORT_JOB",
        entityId: completed.id,
        description: `Generated ${payload.type} report.`,
        metadata: {
          filters,
          artisanScope,
        },
      },
    });

    return completed;
  } catch (error) {
    await aiRepository.updateReportJob(job.id, {
      status: "FAILED",
      completedAt: new Date(),
      errorMessage: error.message,
    });

    throw error;
  }
}

async function listReportJobs(user, query) {
  const where = user.role === "ADMIN" && query.scope === "all" ? {} : { requestedById: user.id };
  return aiRepository.listReportJobs(where);
}

async function getReportJob(user, jobId) {
  const job = await aiRepository.findReportJobById(jobId);

  if (!job) {
    throw new ApiError(404, "Report job was not found.");
  }

  if (user.role !== "ADMIN" && job.requestedById !== user.id) {
    throw new ApiError(404, "Report job was not found.");
  }

  return job;
}

module.exports = {
  createChatSession,
  listChatSessions,
  getChatSession,
  createChatMessage,
  createReportJob,
  listReportJobs,
  getReportJob,
  classifyIntent, // Exported for testing
  generateLLMResponse, // Exported for testing
  detectLanguage, // Exported for testing
};

