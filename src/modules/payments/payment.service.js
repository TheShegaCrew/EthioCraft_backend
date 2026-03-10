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

async function applyFailedPayment(payment, options = {}) {
  if (payment.status === "SUCCESS") {
    return paymentRepository.findPaymentById(payment.id);
  }

  const failedPayment = await paymentRepository.updatePayment(payment.id, {
    status: "FAILED",
    failureReason: options.failureReason || "Payment failed.",
    providerPayload: options.providerPayload || payment.providerPayload || null,
    checkoutReference: options.providerReference || payment.checkoutReference || null,
  });

  await notificationService.createNotification({
    userId: payment.customerId,
    type: "PAYMENT_FAILED",
    title: "Payment failed",
    message: `Payment attempt for order ${payment.orderId} failed.`,
    metadata: { orderId: payment.orderId, paymentId: payment.id, source: options.source || "UNKNOWN" },
  });

  return failedPayment;
}

async function applySuccessfulPayment(payment, options = {}) {
  if (payment.order.status === "CANCELLED") {
    throw new ApiError(409, "Cancelled orders cannot receive payments.");
  }

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
        checkoutReference: options.providerReference || payment.checkoutReference || null,
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
        metadata: { orderId: payment.orderId, paymentId: payment.id, source: options.source || "UNKNOWN" },
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

  return applySuccessfulPayment(payment, options);
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

  const checkout = buildProviderCheckout(payload.provider, {
    payment: basePayment,
    order,
  });

  const payment = await paymentRepository.updatePayment(basePayment.id, {
    checkoutReference: checkout.reference || null,
    providerPayload: checkout.providerPayload || null,
  });

  return {
    payment,
    checkout: {
      provider: payload.provider,
      checkoutUrl: checkout.checkoutUrl,
      reference: checkout.reference,
      instructions: checkout.instructions,
      payload: checkout.providerPayload,
    },
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

  if (payload.txRef && payload.txRef !== payment.txRef) {
    throw new ApiError(400, "txRef does not match the initialized payment.");
  }

  const result = await applyPaymentOutcome(payment, payload.status, {
    source: "MANUAL_CONFIRM",
    failureReason: payload.status === "FAILED" ? "Manual payment confirmation marked failed." : null,
    providerReference: payload.providerReference,
  });

  await createAuditLog({
    actorId: user.id,
    action: "PAYMENT_CONFIRMATION",
    entityType: "PAYMENT",
    entityId: paymentId,
    description: `Payment ${paymentId} confirmation received with status ${payload.status}.`,
    metadata: {
      txRef: payment.txRef,
      provider: payment.provider,
      source: "MANUAL_CONFIRM",
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
        error: "Invalid webhook signature.",
        processedAt: new Date(),
      });

      return {
        webhookEventId: webhookEvent.id,
        status: "IGNORED",
        reason: "Invalid signature.",
      };
    }

    if (!parsed.txRef || !parsed.status) {
      await paymentRepository.updateWebhookEvent(webhookEvent.id, {
        status: "FAILED",
        error: "Missing txRef or unsupported payment status in webhook payload.",
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

    const result = await applyPaymentOutcome(payment, parsed.status, {
      source: `${provider}_WEBHOOK`,
      failureReason: parsed.status === "FAILED" ? `${provider} webhook indicated payment failure.` : null,
      providerReference: parsed.providerReference,
      providerPayload: payload,
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
        status: parsed.status,
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
    await paymentRepository.updateWebhookEvent(webhookEvent.id, {
      status: "FAILED",
      error: error.message,
      processedAt: new Date(),
    });

    throw error;
  }
}

module.exports = {
  initializePayment,
  getPayment,
  confirmPayment,
  handleWebhook,
};
