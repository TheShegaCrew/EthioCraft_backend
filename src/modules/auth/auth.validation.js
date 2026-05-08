const { z } = require("zod");

const roles = ["CUSTOMER", "ARTISAN", "ADMIN", "VERIFICATION_AGENT"];

const registerBody = z
  .object({
    firstName: z.string().trim().min(2).max(50),
    lastName: z.string().trim().min(2).max(50),
    email: z.string().trim().toLowerCase().email(),
    phone: z.string().trim().min(9).max(20).optional(),
    password: z.string().min(8).max(100),
    role: z.enum(roles).default("CUSTOMER"),
    artisanProfile: z
      .object({
        shopName: z.string().trim().min(2).max(120),
        bio: z.string().trim().max(500).optional(),
        region: z.string().trim().max(100).optional(),
        city: z.string().trim().max(100).optional(),
      })
      .optional(),
  })
  .superRefine((data, context) => {
    if (data.role === "ARTISAN" && !data.artisanProfile?.shopName) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Artisan registrations must include artisanProfile.shopName.",
        path: ["artisanProfile", "shopName"],
      });
    }
  });

const loginBody = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(100),
});

const verifyOtpBody = z.object({
  email: z.string().trim().toLowerCase().email(),
  code: z.string().trim().length(6).regex(/^\d{6}$/),
});

const resendOtpBody = z.object({
  email: z.string().trim().toLowerCase().email(),
});

const forgotPasswordBody = z.object({
  email: z.string().trim().toLowerCase().email(),
});

const resetPasswordBody = z.object({
  email: z.string().trim().toLowerCase().email(),
  otp: z.string().trim().length(6).regex(/^\d{6}$/),
  newPassword: z.string().min(8).max(100),
});

const logoutBody = z
  .object({
    refreshToken: z.string().trim().min(1).optional(),
  })
  .optional()
  .default({});

module.exports = {
  registerSchema: z.object({ body: registerBody }),
  loginSchema: z.object({ body: loginBody }),
  verifyOtpSchema: z.object({ body: verifyOtpBody }),
  resendOtpSchema: z.object({ body: resendOtpBody }),
  forgotPasswordSchema: z.object({ body: forgotPasswordBody }),
  resetPasswordSchema: z.object({ body: resetPasswordBody }),
  logoutSchema: z.object({ body: logoutBody }),
};
