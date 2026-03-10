const { z } = require("zod");

module.exports = {
  createOrderSchema: z.object({
    body: z.object({
      addressId: z.string().trim().min(1),
      items: z
        .array(
          z.object({
            productId: z.string().trim().min(1),
            quantity: z.number().int().positive(),
          }),
        )
        .min(1),
      notes: z.string().trim().max(500).optional(),
    }),
  }),
  updateOrderStatusSchema: z.object({
    body: z.object({
      status: z.enum(["PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]),
    }),
  }),
};
