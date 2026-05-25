/**
 * ai.service.js
 *
 * Business logic for the EthioCraft AI assistant.
 *
 * Key capabilities added in this version:
 *  1. Live marketplace data is fetched per user-role and intent before calling the LLM.
 *  2. Gemini is the primary LLM; Hugging Face is the automatic fallback (via llmUtils).
 *  3. Role-based access is enforced at the data-fetch layer (ai.dataFetcher).
 *  4. Graceful fallback messages are returned when a DB table is unavailable.
 *  5. Sample Status and Draft Status are clearly distinguished in every response.
 *  6. Admin actions always surface audit log context.
 */

const prisma = require('../../config/prisma');
const ApiError = require('../../utils/apiError');
const aiRepository = require('./ai.repository');
const { generate, estimateTokens } = require('./llmUtils');
const { fetchContextForUser } = require('./ai.dataFetcher');
const {
  SYSTEM_PROMPTS,
  INTENT_LABELS,
  INTENT_CLASSIFICATION_PROMPT,
  BLOCKED_PATTERNS,
} = require('./ai.constants');

const SUCCESS_ORDER_STATUSES = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function decimalToNumber(value) {
  return value === null || value === undefined ? 0 : Number(value);
}

function parseDateRange(filters = {}) {
  const defaultDateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const dateFrom = filters.dateFrom ? new Date(filters.dateFrom) : defaultDateFrom;
  const dateTo = filters.dateTo ? new Date(filters.dateTo) : new Date();

  if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime())) {
    throw new ApiError(400, 'Invalid report date range.');
  }
  if (dateFrom > dateTo) {
    throw new ApiError(400, 'dateFrom cannot be after dateTo.');
  }
  return { dateFrom, dateTo };
}

function assertSessionAccess(user, session) {
  if (!session) throw new ApiError(404, 'Chat session was not found.');
  if (user.role !== 'ADMIN' && session.userId !== user.id) {
    throw new ApiError(404, 'Chat session was not found.');
  }
}

// ─── Language Detection ───────────────────────────────────────────────────────

function detectLanguage(text) {
  const ethiopicChars = (text.match(/[\u1200-\u137F]/g) || []).length;
  const ratio = ethiopicChars / Math.max(text.length, 1);
  return ratio > 0.3 ? 'am' : 'en';
}

// ─── Fallback Replies (used when LLM fails or response is invalid) ─────────────

function buildFallbackReply(user, intent) {
  const name = user?.firstName || 'there';
  const replies = {
    ORDER_ASSISTANCE: `Hi ${name}, I can help with your order. Please share your order ID and I'll look up the status, delivery timeline, and any required actions.`,
    PAYMENT_ASSISTANCE: `Hi ${name}, for payment issues please confirm your provider (TeleBirr or Chapa) and reference number. Common fixes include retrying the payment, checking your balance, or verifying the phone number on file.`,
    PRODUCT_HELP: `Hi ${name}, for product listing or verification, make sure you have: ✅ Clear product photos ✅ Cultural origin and craftsmanship details ✅ Accurate pricing in ETB.`,
    DRAFT_STATUS: `Hi ${name}, I couldn't load your draft information right now. Please check the Drafts section in your dashboard or try again in a moment.`,
    SAMPLE_STATUS: `Hi ${name}, I couldn't load your sample information right now. Please check the Samples section in your dashboard or contact support.`,
    CART_HELP: `Hi ${name}, I couldn't load your cart right now. Please visit the Cart page directly or try again in a moment.`,
    ACCOUNT_HELP: `Hi ${name}, for account issues you can reset your password from the login page or update your profile in Settings. If you're locked out, contact support@ethiocraft.com.`,
    ADMIN_OVERVIEW: `Hi ${name}, the admin dashboard data couldn't be fetched right now. Please check the Admin Panel directly or try again in a moment.`,
    PLATFORM_INFO: `Hi ${name}, EthioCraft connects Ethiopian artisans with global buyers. Sellers can list handcrafted products, and buyers can purchase with TeleBirr or Chapa. Visit our FAQ for detailed platform policies.`,
    GREETING: `Selam ${name}! 👋 Welcome to EthioCraft. How can I help you today?`,
    GENERAL_SUPPORT: `Thanks ${name}! I'm here to help with orders, payments, products, or any marketplace questions. Could you tell me a bit more about what you need?`,
  };
  return replies[intent] || replies.GENERAL_SUPPORT;
}

// ─── Intent Classification ────────────────────────────────────────────────────

async function classifyIntent(message) {
  try {
    const prompt = INTENT_CLASSIFICATION_PROMPT.replace('{message}', message.slice(0, 300));
    const { text } = await generate(prompt, { temperature: 0.1, max_new_tokens: 20 });
    const cleaned = text.toUpperCase().trim().replace(/[^A-Z_]/g, '');
    return INTENT_LABELS.includes(cleaned) ? cleaned : 'GENERAL_SUPPORT';
  } catch {
    return 'GENERAL_SUPPORT';
  }
}

// ─── Response Validation ──────────────────────────────────────────────────────

function validateResponse(text) {
  if (!text || text.length < 2) return { valid: false, reason: 'Response too short' };
  if (text.length > 4000) return { valid: false, reason: 'Response too long' };
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(text)) return { valid: false, reason: 'Response contains blocked content' };
  }
  return { valid: true };
}

// ─── Prompt Builder ───────────────────────────────────────────────────────────

function buildConversationPrompt({ systemPrompt, liveDataBlock, history, currentMessage, maxContextTokens = 3000 }) {
  const parts = [];
  let tokenBudget = maxContextTokens;

  // Current message (always included)
  const currentPart = `User: ${currentMessage}`;
  tokenBudget -= estimateTokens(currentPart);

  // Walk history backwards
  for (let i = history.length - 1; i >= 0 && tokenBudget > 0; i--) {
    const msg = history[i];
    const formatted = msg.role === 'USER' ? `User: ${msg.content}` : `Assistant: ${msg.content}`;
    const tokens = estimateTokens(formatted);
    if (tokens > tokenBudget) break;
    tokenBudget -= tokens;
    parts.unshift(formatted);
  }

  const sections = [`### System\n${systemPrompt}`];

  if (liveDataBlock && liveDataBlock.trim()) {
    sections.push(`### Live Marketplace Data\n${liveDataBlock}`);
  }

  sections.push('### Conversation');
  if (parts.length) sections.push(parts.join('\n'));
  sections.push(currentPart);
  sections.push('');
  sections.push('Assistant:');

  return sections.join('\n\n');
}

// ─── Main LLM Response Generator ─────────────────────────────────────────────

async function generateLLMResponse(message, user, conversationHistory = []) {
  const lang = detectLanguage(message);

  // 1. Classify intent
  const intent = await classifyIntent(message);

  // 2. Pick system prompt based on role
  const roleKey = (user?.role || 'default').toLowerCase();
  let systemPrompt = SYSTEM_PROMPTS[roleKey] || SYSTEM_PROMPTS.default;

  if (lang === 'am') {
    systemPrompt += '\n- The user is writing in Amharic. Respond in Amharic.';
  }

  // 3. Fetch live marketplace data (role-scoped, with graceful fallbacks)
  let liveDataBlock = '';
  try {
    liveDataBlock = await fetchContextForUser(user, intent);
  } catch (fetchErr) {
    console.warn('[AI] Data fetch failed, continuing without live data:', fetchErr.message);
    liveDataBlock = 'This data is not available in the marketplace service right now.';
  }

  // 4. Build full prompt with live data injected
  const fullPrompt = buildConversationPrompt({
    systemPrompt,
    liveDataBlock,
    history: conversationHistory,
    currentMessage: message,
    maxContextTokens: 3000,
  });

  // 5. Call LLM (Gemini → HF fallback handled inside generate())
  try {
    const result = await generate(fullPrompt, {
      temperature: 0.7,
      max_new_tokens: 512,
    });

    const validation = validateResponse(result.text);
    if (!validation.valid) {
      console.warn(`[AI] Response failed validation: ${validation.reason}`);
      return {
        content: buildFallbackReply(user, intent),
        intent,
        source: 'GUARDRAIL_FALLBACK',
        language: lang,
        model: result.model,
        latencyMs: result.latencyMs,
      };
    }

    return {
      content: result.text,
      intent,
      source: result.cached ? 'LLM_CACHED' : 'LLM',
      language: lang,
      model: result.model,
      latencyMs: result.latencyMs,
    };
  } catch (llmErr) {
    console.warn('[AI] All LLM providers failed, using rule-based fallback:', llmErr.message);
    return {
      content: buildFallbackReply(user, intent),
      intent,
      source: 'RULE_FALLBACK',
      language: lang,
      error: llmErr.message,
      latencyMs: 0,
    };
  }
}

// ─── Chat Session Management ──────────────────────────────────────────────────

async function createChatSession(user, data = {}) {
  return aiRepository.createChatSession(user.id, {
    title: data.title || 'New conversation',
    metadata: {
      userRole: user.role,
      createdVia: data.source || 'web',
    },
  });
}

async function listChatSessions(user) {
  return aiRepository.listChatSessions(user.id);
}

async function getChatSession(user, sessionId) {
  const session = await aiRepository.findChatSessionById(sessionId);
  assertSessionAccess(user, session);
  return session;
}

async function closeChatSession(user, sessionId) {
  const session = await aiRepository.findChatSessionById(sessionId);
  assertSessionAccess(user, session);
  return aiRepository.updateChatSession(sessionId, { status: 'CLOSED', closedAt: new Date() });
}

async function createChatMessage(user, sessionId, message) {
  const session = await aiRepository.findChatSessionById(sessionId);
  assertSessionAccess(user, session);

  if (session.status !== 'OPEN') {
    throw new ApiError(409, 'Chat session is not open for new messages.');
  }

  // Save user message
  const userMsg = await aiRepository.createChatMessage(sessionId, {
    role: 'USER',
    content: message,
  });

  // Load recent conversation history for context
  const history = await aiRepository.getRecentMessages(sessionId, { limit: 10 });

  // Generate response (Gemini primary → HF fallback, live data injected)
  const response = await generateLLMResponse(message, user, history);

  // Save assistant message
  const assistantMsg = await aiRepository.createChatMessage(sessionId, {
    role: 'ASSISTANT',
    content: response.content,
    tokens: estimateTokens(response.content),
    metadata: {
      source: response.source,
      intent: response.intent,
      language: response.language,
      model: response.model,
      latencyMs: response.latencyMs,
      ...(response.error && { fallbackReason: response.error }),
    },
  });

  // Update session metadata
  const updatedSession = await aiRepository.updateChatSession(sessionId, {
    title: session.title === 'New conversation' ? message.slice(0, 80) : session.title,
    lastMessageAt: new Date(),
    metadata: {
      ...session.metadata,
      messageCount: (session.metadata?.messageCount || 0) + 2,
      lastIntent: response.intent,
      lastModel: response.model,
    },
  });

  return { session: updatedSession, userMessage: userMsg, assistantMessage: assistantMsg };
}

// ─── Report Generation ────────────────────────────────────────────────────────

async function generateSalesSummary(filters, artisanId) {
  const { dateFrom, dateTo } = parseDateRange(filters);
  const orderWhere = {
    status: { in: SUCCESS_ORDER_STATUSES },
    createdAt: { gte: dateFrom, lte: dateTo },
    ...(artisanId ? { items: { some: { artisanId } } } : {}),
  };
  const paymentWhere = {
    status: 'SUCCESS',
    createdAt: { gte: dateFrom, lte: dateTo },
    ...(artisanId ? { order: { items: { some: { artisanId } } } } : {}),
  };

  const [orderAggregate, paymentsByProvider] = await Promise.all([
    prisma.order.aggregate({
      where: orderWhere,
      _count: { _all: true },
      _sum: { totalAmount: true },
      _avg: { totalAmount: true },
    }),
    prisma.payment.groupBy({
      by: ['provider'],
      where: paymentWhere,
      _count: { _all: true },
      _sum: { amount: true },
    }),
  ]);

  return {
    range: { from: dateFrom, to: dateTo },
    totalOrders: orderAggregate._count._all,
    totalRevenue: decimalToNumber(orderAggregate._sum.totalAmount),
    averageOrderValue: decimalToNumber(orderAggregate._avg.totalAmount),
    byProvider: paymentsByProvider.map((row) => ({
      provider: row.provider,
      payments: row._count._all,
      amount: decimalToNumber(row._sum.amount),
    })),
  };
}

async function generateOrderPerformance(filters, artisanId) {
  const { dateFrom, dateTo } = parseDateRange(filters);
  const where = {
    createdAt: { gte: dateFrom, lte: dateTo },
    ...(artisanId ? { items: { some: { artisanId } } } : {}),
  };

  const [breakdown, deliveredOrders] = await Promise.all([
    prisma.order.groupBy({ by: ['status'], where, _count: { _all: true } }),
    prisma.order.findMany({
      where: { ...where, deliveredAt: { not: null } },
      select: { createdAt: true, deliveredAt: true },
    }),
  ]);

  const avgFulfillmentHours =
    deliveredOrders.length > 0
      ? deliveredOrders.reduce(
          (sum, item) => sum + (item.deliveredAt - item.createdAt) / (1000 * 60 * 60),
          0
        ) / deliveredOrders.length
      : 0;

  return {
    range: { from: dateFrom, to: dateTo },
    statusBreakdown: breakdown.map((row) => ({ status: row.status, count: row._count._all })),
    avgFulfillmentHours: Number(avgFulfillmentHours.toFixed(2)),
  };
}

async function generateVerificationReport(filters, artisanId) {
  const { dateFrom, dateTo } = parseDateRange(filters);
  const where = {
    createdAt: { gte: dateFrom, lte: dateTo },
    ...(artisanId ? { artisanId } : {}),
  };

  const [statusBreakdown, reviewedDrafts, pendingDrafts] = await Promise.all([
    prisma.productDraft.groupBy({ by: ['status'], where, _count: { _all: true } }),
    prisma.productDraft.findMany({
      where: { ...where, submittedAt: { not: null }, reviewedAt: { not: null } },
      select: { submittedAt: true, reviewedAt: true },
    }),
    prisma.productDraft.findMany({
      where: { ...where, status: 'AGENT_IN_PROGRESS' },
      orderBy: { submittedAt: 'asc' },
      take: 15,
      select: {
        id: true,
        title: true,
        status: true,
        submittedAt: true,
        artisan: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            artisanProfile: { select: { shopName: true } },
          },
        },
      },
    }),
  ]);

  const avgReviewHours =
    reviewedDrafts.length > 0
      ? reviewedDrafts.reduce(
          (sum, row) => sum + (row.reviewedAt - row.submittedAt) / (1000 * 60 * 60),
          0
        ) / reviewedDrafts.length
      : 0;

  return {
    range: { from: dateFrom, to: dateTo },
    statusBreakdown: statusBreakdown.map((row) => ({
      draftStatus: row.status, // Clearly labeled as draftStatus
      count: row._count._all,
    })),
    avgReviewHours: Number(avgReviewHours.toFixed(2)),
    pendingQueue: pendingDrafts,
  };
}

async function generateArtisanPerformance(filters, artisanId) {
  const { dateFrom, dateTo } = parseDateRange(filters);
  const groupedItems = await prisma.orderItem.groupBy({
    by: ['artisanId'],
    where: {
      order: {
        createdAt: { gte: dateFrom, lte: dateTo },
        status: { in: SUCCESS_ORDER_STATUSES },
      },
      ...(artisanId ? { artisanId } : {}),
    },
    _sum: { lineTotal: true, quantity: true },
    _count: { _all: true },
  });

  const artisanIds = groupedItems.map((item) => item.artisanId);
  const artisans = artisanIds.length
    ? await prisma.user.findMany({
        where: { id: { in: artisanIds } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          artisanProfile: { select: { shopName: true, region: true, culturalMetadata: true } },
        },
      })
    : [];

  const artisansById = new Map(artisans.map((a) => [a.id, a]));

  return {
    range: { from: dateFrom, to: dateTo },
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
  };
}

async function generateReportData(type, filters, artisanId) {
  const reportMap = {
    SALES_SUMMARY: generateSalesSummary,
    ORDER_PERFORMANCE: generateOrderPerformance,
    PRODUCT_VERIFICATION: generateVerificationReport,
    ARTISAN_PERFORMANCE: generateArtisanPerformance,
  };
  if (reportMap[type]) return reportMap[type](filters, artisanId);
  throw new ApiError(400, 'Unsupported report type.');
}

function resolveReportArtisanScope(user, filters = {}) {
  if (user.role === 'ARTISAN') {
    if (filters.artisanId && filters.artisanId !== user.id) {
      throw new ApiError(403, 'Artisans can only generate reports for their own shop.');
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
    status: 'RUNNING',
    startedAt: new Date(),
    filters,
  });

  try {
    const result = await generateReportData(payload.type, filters, artisanScope);
    const completed = await aiRepository.updateReportJob(job.id, {
      status: 'COMPLETED',
      completedAt: new Date(),
      result,
      errorMessage: null,
    });

    await prisma.adminAuditLog.create({
      data: {
        actorId: user.id,
        action: 'GENERATE_REPORT',
        entityType: 'REPORT_JOB',
        entityId: completed.id,
        description: `Generated ${payload.type} report.`,
        metadata: { filters, artisanScope },
      },
    });

    return completed;
  } catch (error) {
    await aiRepository.updateReportJob(job.id, {
      status: 'FAILED',
      completedAt: new Date(),
      errorMessage: error.message,
    });
    throw error;
  }
}

async function listReportJobs(user, query) {
  const where =
    user.role === 'ADMIN' && query.scope === 'all' ? {} : { requestedById: user.id };
  return aiRepository.listReportJobs(where);
}

async function getReportJob(user, jobId) {
  const job = await aiRepository.findReportJobById(jobId);
  if (!job) throw new ApiError(404, 'Report job was not found.');
  if (user.role !== 'ADMIN' && job.requestedById !== user.id) {
    throw new ApiError(404, 'Report job was not found.');
  }
  return job;
}

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  createChatSession,
  listChatSessions,
  getChatSession,
  closeChatSession,
  createChatMessage,
  createReportJob,
  listReportJobs,
  getReportJob,
  classifyIntent,
  generateLLMResponse,
  detectLanguage,
};
