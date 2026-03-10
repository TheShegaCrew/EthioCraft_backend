const { z } = require("zod");

module.exports = {
  initializePaymentSchema: z.object({
    body: z.object({
      orderId: z.string().trim().min(1),
      provider: z.enum(["TELEBIRR", "CHAPA", "SIMULATION"]),
    }),
  }),
  confirmPaymentSchema: z.object({
    body: z.object({
      status: z.enum(["SUCCESS", "FAILED"]),
      txRef: z.string().trim().min(1).optional(),
      providerReference: z.string().trim().min(1).optional(),
    }),
  }),
  webhookPayloadSchema: z.object({
    body: z.record(z.any()),
  }),
};
