const axios = require("axios");
const crypto = require("crypto");
const env = require("../../config/env");

function buildProviderCheckout(provider, context) {
  if (provider === "TELEBIRR") {
    return {
      url: `${env.telebirrBaseUrl}/to-pay`,
      method: "POST",
      instructions: "Please complete the payment in the Telebirr app.",
      headers: {
        "Content-Type": "application/json",
      },
      providerPayload: {
        merchantId: env.telebirrMerchantId,
        outTradeNo: context.payment.txRef,
        amount: Number(context.payment.amount),
        currency: context.payment.currency,
        notifyUrl: `${env.appUrl}/api/v1/payments/webhooks/telebirr`,
      },
    };
  }

  if (provider === "CHAPA") {
    return {
      url: `${env.chapaBaseUrl}/transaction/initialize`,
      method: "POST",
      instructions: "You will be redirected to Chapa to complete your payment.",
      headers: {
        Authorization: `Bearer ${env.chapaSecretKey}`,
        "Content-Type": "application/json",
      },
      providerPayload: {
        tx_ref: context.payment.txRef,
        amount: Number(context.payment.amount),
        currency: context.payment.currency,
        callback_url: `${env.appUrl}/api/v1/payments/webhooks/chapa`,
        return_url: `${env.appUrl}/api/v1/payments/callback?tx_ref=${context.payment.txRef}`,
        "customization[title]": "EthioCraft Purchase",
      },
    };
  }

  return {
    checkoutUrl: `${env.appUrl}/api/v1/payments/${context.payment.id}/confirm`,
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
    return headers["x-chapa-signature"] || headers["chapa-signature"] || null;
  }

  return null;
}

function secureCompare(a, b) {
  const aBuffer = Buffer.from(a, "utf8");
  const bBuffer = Buffer.from(b, "utf8");
  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function validateWebhookSignature(provider, signature, payload) {
  let secret = "";

  if (provider === "TELEBIRR") {
    secret = env.telebirrWebhookSecret;
  } else if (provider === "CHAPA") {
    secret = env.chapaWebhookSecret;
  }

  // Never trust a webhook if the server secret is not configured.
  if (!secret) {
    return false;
  }

  if (!signature) {
    return false;
  }

  const digest = crypto.createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex");
  return secureCompare(signature, digest);
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
  if (provider === "CHAPA") {
    return {
      provider,
      txRef: payload?.tx_ref || payload?.data?.tx_ref || null,
      eventType: payload?.event || payload?.type || payload?.status || "UNKNOWN",
      raw: payload,
    };
  }

  if (provider === "TELEBIRR") {
    return {
      provider,
      txRef: payload?.outTradeNo || payload?.data?.outTradeNo || null,
      eventType: payload?.event || payload?.tradeStatus || payload?.status || "UNKNOWN",
      raw: payload,
    };
  }

  return {
    provider,
    txRef: payload?.txRef || null,
    eventType: payload?.event || payload?.status || "UNKNOWN",
    raw: payload,
  };
}

async function verifyProviderTransaction(provider, txRef) {
  if (provider === "SIMULATION") {
    return {
      status: "SUCCESS",
      providerTransactionId: `SIM-${txRef}`,
      raw: { txRef },
    };
  }

  if (provider === "CHAPA") {
    try {
      const response = await axios.get(`${env.chapaBaseUrl}/transaction/verify/${txRef}`, {
        headers: {
          Authorization: `Bearer ${env.chapaSecretKey}`,
        },
      });

      const data = response.data?.data || {};

      return {
        status: normalizePaymentStatus(data.status),
        providerTransactionId: data.reference || data.id || null,
        raw: response.data,
      };
    } catch (error) {
      console.error("[CHAPA Verify Error]", error.response?.data || error.message);
      return {
        status: null,
        providerTransactionId: null,
        error: error.message,
      };
    }
  }

  if (provider === "TELEBIRR") {
    try {
      const verifyUrl = env.telebirrVerifyUrl || `${env.telebirrBaseUrl}/payment/query`;
      const response = await axios.post(
        verifyUrl,
        {
          merchantId: env.telebirrMerchantId,
          outTradeNo: txRef,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const data = response.data?.data || response.data || {};

      return {
        status: normalizePaymentStatus(data.tradeStatus || data.status),
        providerTransactionId: data.tradeNo || data.transactionId || null,
        raw: response.data,
      };
    } catch (error) {
      console.error("[TELEBIRR Verify Error]", error.response?.data || error.message);
      return {
        status: null,
        providerTransactionId: null,
        error: error.message,
      };
    }
  }

  throw new Error(`Verification not implemented for provider: ${provider}`);
}

module.exports = {
  buildProviderCheckout,
  extractWebhookSignature,
  validateWebhookSignature,
  parseWebhookPayload,
  normalizePaymentStatus,
  verifyProviderTransaction,
};