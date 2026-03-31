const axios = require("axios");
const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const notificationService = require("../notifications/notification.service");
const adminService = require("../admin/admin.service");
const paymentRepository = require("./payment.repository");
const {
  buildProviderCheckout,
  extractWebhookSignature,
  validateWebhookSignature,
  parseWebhookPayload,
  normalizePaymentStatus,
  verifyProviderTransaction,
} = require("./payment.providers");

function canViewPayment(user, payment) {
  return user.role === "ADMIN" || payment.customerId === user.id;
}

async function createAuditLog(payload) {
  try {
    await adminService.createAuditLog(payload);
  } catch (_error) {
    // Audit trail should not block payment lifecycle.
  }
}

function validatePaymentDataIntegrity(payment) {
  const orderAmount = Number(payment.order.totalAmount);
  const paymentAmount = Number(payment.amount);

  if (paymentAmount !== orderAmount) {
    throw new ApiError(409, "Payment amount mismatch with order total.");
  }

  if (payment.currency !== payment.order.currency) {
    throw new ApiError(409, "Payment currency mismatch with order currency.");
  }
}

async function applyFailedPayment(payment, options = {}) {
  if (payment.status === "SUCCESS") {
    return paymentRepository.findPaymentById(payment.id);
  }

  const failedPayment = await paymentRepository.updatePayment(payment.id, {
    status: "FAILED",
    failureReason: options.failureReason || "Payment failed.",
    providerPayload: options.providerPayload || payment.providerPayload || null,
    // Persist to existing Prisma field, but use providerTransactionId as service-level naming.
    checkoutReference: options.providerTransactionId || payment.checkoutReference || null,
  });

  await notificationService.createNotification({
    userId: payment.customerId,
    type: "PAYMENT_FAILED",
    title: "Payment failed",
    message: `Payment attempt for order ${payment.orderId} failed.`,
    metadata: {
      orderId: payment.orderId,
      paymentId: payment.id,
      source: options.source || "UNKNOWN",
    },
  });

  return failedPayment;
}

async function applySuccessfulPayment(payment, options = {}) {
  if (payment.order.status === "CANCELLED") {
    throw new ApiError(409, "Cancelled orders cannot receive payments.");
  }

  validatePaymentDataIntegrity(payment);

  if (payment.status === "SUCCESS") {
    return paymentRepository.findPaymentById(payment.id);
  }

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "SUCCESS",
        paidAt: now,
        failureReason: null,
        providerPayload: options.providerPayload || payment.providerPayload || null,
        checkoutReference: options.providerTransactionId || payment.checkoutReference || null,
      },
    });

    if (payment.order.status === "PENDING_PAYMENT") {
      await tx.order.update({
        where: { id: payment.orderId },
        data: {
          status: "PAID",
          paidAt: now,
        },
      });
    }

    await tx.notification.create({
      data: {
        userId: payment.customerId,
        type: "PAYMENT_SUCCESS",
        title: "Payment successful",
        message: `Payment for order ${payment.orderId} has been confirmed.`,
        metadata: {
          orderId: payment.orderId,
          paymentId: payment.id,
          source: options.source || "UNKNOWN",
        },
      },
    });

    return tx.payment.findUnique({
      where: { id: payment.id },
      include: {
        order: true,
      },
    });
  });
}

async function applyPaymentOutcome(payment, status, options = {}) {
  if (status === "FAILED") {
    return applyFailedPayment(payment, options);
  }

  if (status === "SUCCESS") {
    return applySuccessfulPayment(payment, options);
  }

  throw new ApiError(422, "Unsupported payment status from verification.");
}

async function initializePayment(customerId, payload) {
  const order = await prisma.order.findUnique({
    where: { id: payload.orderId },
    include: {
      payments: true,
    },
  });

  if (!order || order.customerId !== customerId) {
    throw new ApiError(404, "Order was not found.");
  }

  if (order.status !== "PENDING_PAYMENT") {
    throw new ApiError(409, "Only orders awaiting payment can initialize a payment.");
  }

  if (order.payments.some((payment) => payment.status === "SUCCESS")) {
    throw new ApiError(409, "This order has already been paid.");
  }

  const txRef = `${payload.provider}-${Date.now()}-${order.id.slice(-6)}`;
  const basePayment = await paymentRepository.createPayment({
    orderId: order.id,
    customerId,
    provider: payload.provider,
    amount: order.totalAmount,
    currency: order.currency,
    status: "PENDING",
    txRef,
    checkoutReference: null,
  });

  const providerRequest = buildProviderCheckout(payload.provider, {
    payment: basePayment,
    order,
  });

  let checkoutUrl = providerRequest.checkoutUrl;

  if (payload.provider !== "SIMULATION") {
    try {
      const response = await axios({
        method: providerRequest.method,
        url: providerRequest.url,
        data: providerRequest.providerPayload,
        headers: providerRequest.headers,
      });

      if (payload.provider === "CHAPA") {
        checkoutUrl = response.data?.data?.checkout_url || checkoutUrl;
      }

      if (payload.provider === "TELEBIRR") {
        checkoutUrl = response.data?.data?.toPayUrl || response.data?.toPayUrl || checkoutUrl;
      }

      if (!checkoutUrl) {
        throw new Error("Provider did not return a checkout URL.");
      }
    } catch (error) {
      console.error(`[${payload.provider} Init Error]`, error.response?.data || error.message);
      throw new ApiError(502, `Failed to initialize payment with ${payload.provider}.`);
    }
  }

  const payment = await paymentRepository.updatePayment(basePayment.id, {
    providerPayload: providerRequest.providerPayload || null,
  });

  return {
    payment,
    checkoutUrl,
    instructions: providerRequest.instructions,
  };
}

async function getPayment(user, paymentId) {
  const payment = await paymentRepository.findPaymentById(paymentId);

  if (!payment || !canViewPayment(user, payment)) {
    throw new ApiError(404, "Payment was not found.");
  }

  return payment;
}

async function confirmPayment(user, paymentId, payload) {
  const payment = await paymentRepository.findPaymentById(paymentId);

  if (!payment || !canViewPayment(user, payment)) {
    throw new ApiError(404, "Payment was not found.");
  }

  let result;

  if (payment.provider === "SIMULATION") {
    const simulatedStatus = normalizePaymentStatus(payload.status);
    if (!simulatedStatus) {
      throw new ApiError(400, "Simulation status must be SUCCESS or FAILED.");
    }

    result = await applyPaymentOutcome(payment, simulatedStatus, {
      source: "MANUAL_CONFIRM_SIMULATION",
      failureReason: simulatedStatus === "FAILED" ? "Simulation payment failed." : null,
      providerTransactionId: payload.providerTransactionId || payload.providerReference || null,
      providerPayload: payload,
    });
  } else {
    // For real providers, manual payload is never trusted. Server-side verification is mandatory.
    const verification = await verifyProviderTransaction(payment.provider, payment.txRef);

    if (!verification || verification.status !== "SUCCESS") {
      console.error(
        `[${payment.provider} Verification Failure]`,
        verification?.error || `Unable to verify txRef ${payment.txRef}`
      );
      throw new ApiError(402, "Payment could not be verified with the provider.");
    }

    result = await applySuccessfulPayment(payment, {
      source: "MANUAL_CONFIRM_VERIFIED",
      providerTransactionId: verification.providerTransactionId,
      providerPayload: verification.raw || null,
    });
  }

  await createAuditLog({
    actorId: user.id,
    action: "PAYMENT_CONFIRMATION",
    entityType: "PAYMENT",
    entityId: paymentId,
    description: `Payment ${paymentId} confirmation handled for provider ${payment.provider}.`,
    metadata: {
      txRef: payment.txRef,
      provider: payment.provider,
      source: payment.provider === "SIMULATION" ? "MANUAL_CONFIRM_SIMULATION" : "MANUAL_CONFIRM_VERIFIED",
    },
  });

  return result;
}

async function handleWebhook(provider, payload, headers) {
  const signature = extractWebhookSignature(provider, headers);
  const parsed = parseWebhookPayload(provider, payload);

  const webhookEvent = await paymentRepository.createWebhookEvent({
    provider,
    eventType: parsed.eventType,
    txRef: parsed.txRef,
    signature,
    payload,
    status: "RECEIVED",
  });

  try {
    const isValidSignature = validateWebhookSignature(provider, signature, payload);

    if (!isValidSignature) {
      await paymentRepository.updateWebhookEvent(webhookEvent.id, {
        status: "IGNORED",
        error: "Invalid or missing webhook signature.",
        processedAt: new Date(),
      });

      return {
        webhookEventId: webhookEvent.id,
        status: "IGNORED",
        reason: "Invalid signature.",
      };
    }

    if (!parsed.txRef) {
      await paymentRepository.updateWebhookEvent(webhookEvent.id, {
        status: "FAILED",
        error: "Missing provider transaction reference (txRef).",
        processedAt: new Date(),
      });

      return {
        webhookEventId: webhookEvent.id,
        status: "FAILED",
        reason: "Invalid payload.",
      };
    }

    const payment = await paymentRepository.findPaymentByTxRef(parsed.txRef);

    if (!payment) {
      await paymentRepository.updateWebhookEvent(webhookEvent.id, {
        status: "FAILED",
        error: "No payment found for txRef.",
        processedAt: new Date(),
      });

      return {
        webhookEventId: webhookEvent.id,
        status: "FAILED",
        reason: "Payment not found.",
      };
    }

    if (payment.status === "SUCCESS") {
      await paymentRepository.updateWebhookEvent(webhookEvent.id, {
        paymentId: payment.id,
        status: "IGNORED",
        error: "Payment already marked as SUCCESS. Webhook is idempotently ignored.",
        processedAt: new Date(),
      });

      return {
        webhookEventId: webhookEvent.id,
        status: "IGNORED",
        paymentId: payment.id,
        reason: "Already processed.",
      };
    }

    // Webhook status is advisory only. Always verify with provider before mutating payment state.
    const verification = await verifyProviderTransaction(provider, payment.txRef);

    if (!verification || !verification.status) {
      const errorMessage = verification?.error || "Provider verification returned no status.";

      console.error(`[${provider} Webhook Verification Failure]`, errorMessage);
      await paymentRepository.updateWebhookEvent(webhookEvent.id, {
        paymentId: payment.id,
        status: "FAILED",
        error: errorMessage,
        processedAt: new Date(),
      });

      return {
        webhookEventId: webhookEvent.id,
        status: "FAILED",
        paymentId: payment.id,
        reason: "Verification failed.",
      };
    }

    const result = await applyPaymentOutcome(payment, verification.status, {
      source: `${provider}_WEBHOOK_VERIFIED`,
      failureReason:
        verification.status === "FAILED" ? `${provider} verification indicated payment failure.` : null,
      providerTransactionId: verification.providerTransactionId,
      providerPayload: verification.raw || payload,
    });

    await paymentRepository.updateWebhookEvent(webhookEvent.id, {
      paymentId: payment.id,
      status: "PROCESSED",
      error: null,
      processedAt: new Date(),
    });

    await createAuditLog({
      action: "PAYMENT_CONFIRMATION",
      entityType: "PAYMENT",
      entityId: payment.id,
      description: `Processed ${provider} webhook for payment ${payment.id}.`,
      metadata: {
        webhookEventId: webhookEvent.id,
        txRef: parsed.txRef,
        verificationStatus: verification.status,
      },
    });

    return {
      webhookEventId: webhookEvent.id,
      status: "PROCESSED",
      paymentId: result.id,
      paymentStatus: result.status,
      orderId: result.orderId,
    };
  } catch (error) {
    console.error(`[${provider} Webhook Failure]`, error.message);

    await paymentRepository.updateWebhookEvent(webhookEvent.id, {
      status: "FAILED",
      error: error.message,
      processedAt: new Date(),
    });

    throw error;
  }
}

async function syncPaymentStatus(txRef) {
  const payment = await paymentRepository.findPaymentByTxRef(txRef);
  if (!payment) return null;

  // If already processed, just return it
  if (payment.status !== "PENDING") return payment;

  // If still pending, pull the latest status directly from the provider (Chapa/TeleBirr)
  const verification = await verifyProviderTransaction(payment.provider, payment.txRef);

  if (verification && verification.status) {
    return applyPaymentOutcome(payment, verification.status, {
      source: "SYNC_ON_CALLBACK",
      providerTransactionId: verification.providerTransactionId,
      providerPayload: verification.raw,
    });
  }

  return payment;
}

module.exports = {
  initializePayment,
  getPayment,
  confirmPayment,
  handleWebhook,
  syncPaymentStatus,
};