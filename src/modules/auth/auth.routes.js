const express = require("express");
const validate = require("../../middlewares/validate.middleware");
const { authenticate } = require("../../middlewares/auth.middleware");
const { rateLimit } = require("../../middlewares/rate-limit.middleware");
const authController = require("./auth.controller");
const {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  resendOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  logoutSchema,
} = require("./auth.validation");

const router = express.Router();

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyPrefix: "auth-login",
  message: "Too many login attempts. Please try again later.",
});

const otpRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  keyPrefix: "auth-otp",
  message: "Too many OTP requests. Please try again later.",
});

router.post("/register", otpRateLimit, validate(registerSchema), authController.register);
router.post("/login", loginRateLimit, validate(loginSchema), authController.login);
router.post("/verify-otp", otpRateLimit, validate(verifyOtpSchema), authController.verifyOtp);
router.post("/resend-otp", otpRateLimit, validate(resendOtpSchema), authController.resendOtp);
router.post("/forgot-password", otpRateLimit, validate(forgotPasswordSchema), authController.forgotPassword);
router.post("/reset-password", otpRateLimit, validate(resetPasswordSchema), authController.resetPassword);
router.post("/logout", authenticate, validate(logoutSchema), authController.logout);

module.exports = router;
