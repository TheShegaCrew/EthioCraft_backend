const { z } = require("zod");

const artisanProfileSchema = z.object({
  shopName: z.string().trim().min(2).max(120).optional(),
  bio: z.string().trim().max(500).optional(),
  region: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
});

const updateProfileBody = z
  .object({
    firstName: z.string().trim().min(2).max(50).optional(),
    lastName: z.string().trim().min(2).max(50).optional(),
    phone: z.string().trim().min(9).max(20).optional(),
    avatarUrl: z.string().trim().url().optional(),
    artisanProfile: artisanProfileSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one profile field must be supplied.",
  });

const addressBody = z.object({
  label: z.string().trim().max(50).optional(),
  recipientName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(9).max(20),
  region: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(100),
  subCity: z.string().trim().max(100).optional(),
  woreda: z.string().trim().max(100).optional(),
  kebele: z.string().trim().max(100).optional(),
  line1: z.string().trim().min(2).max(255),
  line2: z.string().trim().max(255).optional(),
  postalCode: z.string().trim().max(20).optional(),
  isDefault: z.boolean().optional(),
});

const updateAddressBody = addressBody.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one address field must be supplied.",
});

module.exports = {
  updateProfileSchema: z.object({ body: updateProfileBody }),
  createAddressSchema: z.object({ body: addressBody }),
  updateAddressSchema: z.object({ body: updateAddressBody }),
};
