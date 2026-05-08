const { z } = require("zod");

module.exports = {
  addWishlistItemSchema: z.object({
    body: z.object({
      productId: z.string().trim().min(1, "Product ID is required."),
    }),
  }),
  toggleWishlistItemSchema: z.object({
    body: z.object({
      productId: z.string().trim().min(1, "Product ID is required."),
    }),
  }),
  wishlistProductParamsSchema: z.object({
    params: z.object({
      productId: z.string().trim().min(1, "Product ID is required."),
    }),
  }),
};
