const crypto = require("crypto");
const env = require("../../config/env");

function buildProviderCheckout(provider, context) {
  if (provider === "TELEBIRR") {
    const reference = `TB-${Date.now()}-${context.payment.id.slice(-6)}`;
    return {
      checkoutUrl: `${env.telebirrBaseUrl}/checkout`,
      reference,
      instructions:
        "Redirect customer to TeleBirr checkout with merchant/order details. Replace this scaffold with official TeleBirr request signing.",
      providerPayload: {
        merchantId: env.telebirrMerchantId || "<TELEBIRR_MERCHANT_ID>",
        outTradeNo: context.payment.txRef,
        amount: Number(context.payment.amount),
        currency: context.payment.currency,
        notifyUrl: `${env.appUrl}/api/v1/payments/webhooks/telebirr`,
      },
    };
  }

  if (provider === "CHAPA") {
    const reference = `CHAPA-${Date.now()}-${context.payment.id.slice(-6)}`;
    return {
      checkoutUrl: `${env.chapaBaseUrl}/checkout`,
      reference,
      instructions:
        "Initialize Chapa checkout and redirect customer. Replace placeholder payload mapping with live Chapa API calls.",
      providerPayload: {
        tx_ref: context.payment.txRef,
        amount: Number(context.payment.amount),
        currency: context.payment.currency,
        callback_url: `${env.appUrl}/api/v1/payments/webhooks/chapa`,
      },
    };
  }

  return {
    checkoutUrl: `${env.appUrl}/api/v1/payments/${context.payment.id}/confirm`,
    reference: `SIM-${Date.now()}-${context.payment.id.slice(-6)}`,
    instructions:
      "Simulation mode: send POST to checkoutUrl with { status: 'SUCCESS' | 'FAILED', txRef } to emulate gateway callbacks.",
    providerPayload: {
      simulation: true,
    },
  };
}

function extractWebhookSignature(provider, headers) {
  if (provider === "TELEBIRR") {
    return headers["x-telebirr-signature"] || headers["telebirr-signature"] || null;
  }

  if (provider === "CHAPA") {
    return headers["chapa-signature"] || headers["x-chapa-signature"] || null;
  }

  return null;
}

function validateWebhookSignature(provider, signature, payload) {
  let secret = "";

  if (provider === "TELEBIRR") {
    secret = env.telebirrWebhookSecret;
  } else if (provider === "CHAPA") {
    secret = env.chapaWebhookSecret;
  }

  if (!secret) {
    return true;
  }

  if (!signature) {
    return false;
  }

  const digest = crypto.createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex");
  return signature === digest;
}

function normalizePaymentStatus(rawStatus) {
  if (!rawStatus) {
    return null;
  }

  const value = String(rawStatus).toUpperCase();
  if (["SUCCESS", "SUCCEEDED", "PAID", "COMPLETED"].includes(value)) {
    return "SUCCESS";
  }

  if (["FAILED", "CANCELLED", "ERROR", "EXPIRED"].includes(value)) {
    return "FAILED";
  }

  return null;
}

function parseWebhookPayload(provider, payload) {
  const txRef = payload.txRef || payload.tx_ref || payload.outTradeNo || payload.reference || payload.payment_reference || null;
  const eventType = payload.event || payload.eventType || payload.type || payload.status || "UNKNOWN";
  const normalizedStatus = normalizePaymentStatus(payload.status || payload.payment_status || payload.tradeStatus);

  return {
    provider,
    txRef,
    eventType,
    status: normalizedStatus,
    providerReference: payload.checkoutReference || payload.trx_id || payload.tradeNo || payload.reference || null,
    raw: payload,
  };
}

module.exports = {
  buildProviderCheckout,
  extractWebhookSignature,
  validateWebhookSignature,
  parseWebhookPayload,
};
