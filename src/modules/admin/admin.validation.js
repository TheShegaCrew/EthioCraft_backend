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

const reportQuerySchema = z.object({
  query: z.object({
    type: z.enum(["orders", "revenue", "users", "artisans", "agents"]),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
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

const createUserSchema = z.object({
  body: z.object({
    firstName: z.string().min(1).max(50),
    lastName: z.string().min(1).max(50),
    email: z.string().email(),
    password: z.string().min(8),
    phone: z.string().optional(),
    role: z.enum(["CUSTOMER", "ARTISAN", "ADMIN", "VERIFICATION_AGENT"]),
    address: z.object({
      label: z.string().optional(),
      recipientName: z.string().min(1).max(120).optional(),
      phone: z.string().min(1).max(30).optional(),
      region: z.string().min(1).max(120),
      city: z.string().min(1).max(120),
      subCity: z.string().optional(),
      woreda: z.string().optional(),
      kebele: z.string().optional(),
      line1: z.string().min(1).max(255),
      line2: z.string().optional(),
      postalCode: z.string().optional(),
    }).optional(),
  }).superRefine((data, ctx) => {
    if (data.address && !data.phone && !data.address.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["address", "phone"],
        message: "Phone is required when address is provided.",
      });
    }
  }),
});

const notificationPayloadSchema = z.object({
  params: z.object({
    userId: z.string().min(1),
  }),
  body: z.object({
    title: z.string().min(1).max(100),
    message: z.string().min(1).max(1000),
    type: z.enum([
      "GENERAL",
      "PRODUCT_APPROVED",
      "PRODUCT_REJECTED",
      "PRODUCT_DRAFT_CREATED",
      "PRODUCT_DRAFT_SUBMITTED",
      "PRODUCT_PUBLISHED",
      "ORDER_PLACED",
      "ORDER_SHIPPED",
      "PAYMENT_SUCCESS",
      "PAYMENT_FAILED",
    ]).optional().default("GENERAL"),
  }),
});

const reverificationPayloadSchema = z.object({
  params: z.object({
    sampleId: z.string().min(1),
  }),
  body: z.object({
    message: z.string().min(1).max(1000),
  }),
});

module.exports = {
  dateRangeQuerySchema,
  topArtisanQuerySchema,
  reportQuerySchema,
  userListQuerySchema,
  userParamsSchema,
  usersByRoleSchema,
  updateUserSchema,
  updateSampleSchema,
  sampleParamsSchema,
  orderListQuerySchema,
  orderParamsSchema,
  createUserSchema,
  notificationPayloadSchema,
  reverificationPayloadSchema,
};
