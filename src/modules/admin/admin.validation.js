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

const userParamsSchema = z.object({
  params: z.object({
    userId: z.string().min(1),
  }),
});

const sampleParamsSchema = z.object({
  params: z.object({
    sampleId: z.string().min(1),
  }),
});

const usersByRoleSchema = z.object({
  params: z.object({
    role: z.enum(["CUSTOMER", "ARTISAN", "ADMIN", "VERIFICATION_AGENT"]),
  }),
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    search: z.string().optional(),
  }).optional(),
  body: z.any().optional(),
});

const updateUserSchema = z.object({
  params: z.object({
    userId: z.string().min(1),
  }),
  body: z.object({
    firstName: z.string().min(1).max(50).optional(),
    lastName: z.string().min(1).max(50).optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    role: z.enum(["CUSTOMER", "ARTISAN", "ADMIN", "VERIFICATION_AGENT"]).optional(),
    status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
    artisanProfile: z.object({
      shopName: z.string().optional(),
      bio: z.string().optional(),
      region: z.string().optional(),
      city: z.string().optional(),
    }).optional(),
  }).refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update.",
  }),
});

const updateSampleSchema = z.object({
  params: z.object({
    sampleId: z.string().min(1),
  }),
  body: z.object({
    assignedVerifierId: z.string().optional().nullable(),
    status: z.enum(["SUBMITTED", "REJECTED", "MORE_INFO_REQUESTED", "APPROVED"]).optional(),
    title: z.string().min(3).max(150).optional(),
    description: z.string().min(20).max(5000).optional(),
    category: z.string().min(2).max(120).optional(),
    price: z.coerce.number().positive().optional(),
    stock: z.number().int().nonnegative().optional(),
    materials: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    culturalMetadata: z.any().optional(),
  }).refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update.",
  }),
});

const orderListQuerySchema = z.object({
  query: z.object({
    userId:   z.string().optional(),
    status:   z.enum(["PENDING_PAYMENT", "PAID", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]).optional(),
    search:   z.string().optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo:   z.string().datetime().optional(),
    page:     z.coerce.number().int().min(1).optional(),
    limit:    z.coerce.number().int().min(1).max(100).optional(),
  }),
  body:   z.any().optional(),
  params: z.any().optional(),
});

const orderParamsSchema = z.object({
  params: z.object({
    orderId: z.string().min(1),
  }),
});

module.exports = {
  dateRangeQuerySchema,
  topArtisanQuerySchema,
  userListQuerySchema,
  userParamsSchema,
  usersByRoleSchema,
  updateUserSchema,
  updateSampleSchema,
  sampleParamsSchema,
  orderListQuerySchema,
  orderParamsSchema,
};
