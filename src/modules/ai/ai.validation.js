const { z } = require("zod");

const createSessionBody = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  context: z.record(z.any()).optional(),
});

const createMessageBody = z.object({
  message: z.string().trim().min(1).max(4000),
});

const reportFilterSchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  artisanId: z.string().trim().min(1).optional(),
});

const createReportJobBody = z.object({
  type: z.enum(["SALES_SUMMARY", "ORDER_PERFORMANCE", "PRODUCT_VERIFICATION", "ARTISAN_PERFORMANCE"]),
  filters: reportFilterSchema.passthrough().optional(),
});

module.exports = {
  createChatSessionSchema: z.object({ body: createSessionBody }),
  createChatMessageSchema: z.object({ body: createMessageBody }),
  createReportJobSchema: z.object({ body: createReportJobBody }),
};
