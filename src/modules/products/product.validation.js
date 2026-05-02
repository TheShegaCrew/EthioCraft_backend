const { z } = require("zod");

const draftBody = z.object({
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().min(20).max(5000),
  category: z.string().trim().min(2).max(120),
  price: z.number().positive(),
  stock: z.number().int().nonnegative(),
  materials: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  dimensions: z.record(z.any()).optional(),
  culturalMetadata: z.record(z.any()).optional(),
  extensionData: z.record(z.any()).optional(),
});

const sampleBody = draftBody.partial().refine((v) => Object.keys(v).length > 0, {
  message: "At least one sample field must be supplied.",
});

const submitBody = z.object({
  submissionNotes: z.string().trim().max(500).optional(),
});

const reviewBody = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  notes: z.string().trim().max(500).optional(),
});

const reviewSampleBody = z.object({
  decision: z.enum(["APPROVE", "REJECT", "REQUEST_MORE_INFO"]),
  notes: z.string().trim().max(500).optional(),
});

const adminProductParams = z.object({
  productId: z.string().min(1),
});

const adminProductUpdateBody = z.object({
  title: z.string().trim().min(3).max(150).optional(),
  description: z.string().trim().min(20).max(5000).optional(),
  category: z.string().trim().min(2).max(120).optional(),
  price: z.coerce.number().positive().optional(),
  stock: z.coerce.number().int().nonnegative().optional(),
  materials: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  dimensions: z.record(z.any()).optional(),
  culturalMetadata: z.record(z.any()).optional(),
  featured: z.boolean().optional(),
  status: z.enum(["APPROVED", "PUBLISHED", "ARCHIVED"]).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "At least one field must be provided for update.",
});

module.exports = {
  createDraftSchema: z.object({ body: draftBody }),
  updateDraftSchema: z.object({
    body: draftBody.extend({
      status: z.enum(["ADMIN_CREATED", "AGENT_IN_PROGRESS", "AGENT_VERIFIED", "ADMIN_REVIEW", "REJECTED", "PUBLISHED"]).optional()
    }).partial().refine((value) => Object.keys(value).length > 0, {
      message: "At least one draft field must be supplied.",
    }),
  }),
  submitDraftSchema: z.object({ body: submitBody }),
  reviewDraftSchema: z.object({ body: reviewBody }),
  createSampleSchema: z.object({ body: sampleBody }),
  updateSampleSchema: z.object({ body: sampleBody.optional() }),
  adminSampleParamsSchema: z.object({ params: z.object({ sampleId: z.string().min(1) }) }),
  reviewSampleSchema: z.object({ body: reviewSampleBody }),
  adminProductParamsSchema: z.object({ params: adminProductParams }),
  updateAdminProductSchema: z.object({ params: adminProductParams, body: adminProductUpdateBody }),
};
