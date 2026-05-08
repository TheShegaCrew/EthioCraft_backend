const { z } = require("zod");

module.exports = {
  addCartItemSchema: z.object({
    body: z.object({
      productId: z.string().trim().min(1, "Product ID is required."),
      quantity: z.number().int().positive().default(1),
    }),
  }),
  updateCartItemSchema: z.object({
    params: z.object({
      productId: z.string().trim().min(1, "Product ID is required."),
    }),
    body: z.object({
      quantity: z.number().int().positive("Quantity must be at least 1."),
    }),
  }),
  cartProductParamsSchema: z.object({
    params: z.object({
      productId: z.string().trim().min(1, "Product ID is required."),
    }),
  }),
};
