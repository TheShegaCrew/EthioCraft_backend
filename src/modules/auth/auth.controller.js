const asyncHandler = require("../../utils/asyncHandler");
const authService = require("./auth.service");
const env = require("../../config/env");

const AUTH_COOKIE_NAME = "auth_token";
const ONE_DAY_MS = 1000 * 60 * 60 * 24;

function setAuthCookie(res, token) {
  if (!token) return;

  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ONE_DAY_MS,
  });
}

const register = asyncHandler(async (req, res) => {
  const response = await authService.registerUser(req.validated.body);

  res.status(201).json({
    message: "User registered successfully.",
    data: response,
  });
});

const login = asyncHandler(async (req, res) => {
  const response = await authService.loginUser(req.validated.body);
  setAuthCookie(res, response.token);

  res.status(200).json({
    message: "Login successful.",
    data: response,
  });
});

const verifyOtp = asyncHandler(async (req, res) => {
  const response = await authService.verifyOtp(req.validated.body);
  setAuthCookie(res, response.token);

  res.status(200).json({
    message: "Email verified successfully.",
    data: response,
  });
});

const resendOtp = asyncHandler(async (req, res) => {
  await authService.resendOtp(req.validated.body);

  res.status(200).json({
    message: "OTP sent successfully.",
  });
});

const forgotPassword = asyncHandler(async (req, res) => {
  await authService.forgotPassword(req.validated.body);

  res.status(200).json({
    message: "If the email exists, a reset code has been sent.",
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.validated.body);

  res.status(200).json({
    message: "Password reset successfully.",
  });
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user?.id || null);
  res.clearCookie(AUTH_COOKIE_NAME, {
    path: "/",
  });

  res.status(200).json({
    message: "Logout successful.",
  });
});

module.exports = {
  register,
  login,
  verifyOtp,
  resendOtp,
  forgotPassword,
  resetPassword,
  logout,
};
