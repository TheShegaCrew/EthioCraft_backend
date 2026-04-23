const { z } = require("zod");

const dateRangeQuerySchema = z.object({
  query: z.object({
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    page: z.coerce.number().int().min(1).optional(),
  }),
  body: z.any().optional(),
  params: z.any().optional(),
});

const topArtisanQuerySchema = z.object({
  query: z.object({
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  }),
  body: z.any().optional(),
  params: z.any().optional(),
});

const userListQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    role: z.string().optional(),
    search: z.string().optional(),
  }),
  body: z.any().optional(),
  params: z.any().optional(),
});

module.exports = {
  dateRangeQuerySchema,
  topArtisanQuerySchema,
  userListQuerySchema,
};
