const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const authRepository = require("./auth.repository");
const ApiError = require("../../utils/apiError");
const { generateAccessToken } = require("../../utils/jwt");
const env = require("../../config/env");
const { sendOtpEmail } = require("../../utils/mailer");

const EMAIL_VERIFICATION_PURPOSE = "EMAIL_VERIFICATION";
const PASSWORD_RESET_PURPOSE = "PASSWORD_RESET";

function generateOtpCode() {
  return `${Math.floor(100000 + Math.random() * 900000)}`;
}

function hashOtp(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function getOtpExpiryDate() {
  return new Date(Date.now() + env.otpTtlMinutes * 60 * 1000);
}

async function issueEmailVerificationOtp(user) {
  const code = generateOtpCode();
  const codeHash = hashOtp(code);
  const expiresAt = getOtpExpiryDate();

  await authRepository.upsertEmailOtp({
    userId: user.id,
    codeHash,
    purpose: EMAIL_VERIFICATION_PURPOSE,
    expiresAt,
  });

  await sendOtpEmail({
    to: user.email,
    firstName: user.firstName,
    code,
    purposeLabel: "email verification",
  });
}

async function issuePasswordResetOtp(user) {
  const code = generateOtpCode();
  const codeHash = hashOtp(code);
  const expiresAt = getOtpExpiryDate();

  await authRepository.upsertEmailOtp({
    userId: user.id,
    codeHash,
    purpose: PASSWORD_RESET_PURPOSE,
    expiresAt,
  });

  await sendOtpEmail({
    to: user.email,
    firstName: user.firstName,
    code,
    purposeLabel: "password reset",
  });
}

async function registerUser(payload) {
  const existingUser = await authRepository.findAuthUserByEmail(payload.email);

  if (existingUser) {
    throw new ApiError(409, "An account with this email already exists.");
  }

  const passwordHash = await bcrypt.hash(payload.password, 12);

  const user = await authRepository.createUser({
    firstName: payload.firstName,
    lastName: payload.lastName,
    email: payload.email.toLowerCase(),
    phone: payload.phone || null,
    passwordHash,
    role: payload.role,
    status: "ACTIVE",
    artisanProfile:
      payload.role === "ARTISAN"
        ? {
            create: {
              shopName: payload.artisanProfile.shopName,
              bio: payload.artisanProfile.bio || null,
              region: payload.artisanProfile.region || null,
              city: payload.artisanProfile.city || null,
            },
          }
        : undefined,
  });

  await issueEmailVerificationOtp(user);

  return {
    user,
    requiresEmailVerification: true,
  };
}

async function loginUser(payload) {
  const existingUser = await authRepository.findAuthUserByEmail(payload.email);

  if (!existingUser) {
    await authRepository.createAuthAuditLog({
      description: "Failed login attempt: user not found.",
      metadata: { email: payload.email },
    });
    throw new ApiError(401, "Invalid email or password.");
  }

  const passwordMatches = await bcrypt.compare(payload.password, existingUser.passwordHash);

  if (!passwordMatches) {
    await authRepository.createAuthAuditLog({
      actorId: existingUser.id,
      description: "Failed login attempt: invalid password.",
      metadata: { email: payload.email },
    });
    throw new ApiError(401, "Invalid email or password.");
  }

  if (existingUser.status !== "ACTIVE") {
    throw new ApiError(403, "This account is not active.");
  }

  if (!existingUser.isEmailVerified) {
    throw new ApiError(403, "Email is not verified. Please verify your email with OTP.");
  }

  const user = await authRepository.findPublicUserById(existingUser.id);
  await authRepository.createAuthAuditLog({
    actorId: user.id,
    description: "User login successful.",
  });

  return {
    user,
    token: generateAccessToken(user),
  };
}

async function verifyOtp(payload) {
  const user = await authRepository.findAuthUserByEmail(payload.email);

  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  const otpRecord = await authRepository.findEmailOtp(user.id, EMAIL_VERIFICATION_PURPOSE);

  if (!otpRecord) {
    throw new ApiError(400, "OTP was not requested or has expired.");
  }

  if (otpRecord.expiresAt.getTime() < Date.now()) {
    await authRepository.deleteEmailOtpById(otpRecord.id);
    throw new ApiError(400, "OTP has expired. Please request a new one.");
  }

  if (otpRecord.attempts >= env.otpMaxAttempts) {
    throw new ApiError(429, "Maximum OTP attempts reached. Please request a new OTP.");
  }

  const matches = hashOtp(payload.code) === otpRecord.codeHash;

  if (!matches) {
    await authRepository.updateEmailOtpById(otpRecord.id, {
      attempts: {
        increment: 1,
      },
    });
    throw new ApiError(401, "Invalid OTP code.");
  }

  await authRepository.deleteEmailOtpById(otpRecord.id);
  const publicUser = await authRepository.markUserEmailVerified(user.id);

  return {
    user: publicUser,
    token: generateAccessToken(publicUser),
  };
}

async function resendOtp(payload) {
  const user = await authRepository.findAuthUserByEmail(payload.email);

  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  if (user.isEmailVerified) {
    throw new ApiError(409, "Email is already verified.");
  }

  await issueEmailVerificationOtp(user);

  return {
    message: "OTP sent successfully.",
  };
}

async function forgotPassword(payload) {
  const user = await authRepository.findAuthUserByEmail(payload.email);

  // Return generic success response to avoid account enumeration.
  if (!user) {
    await authRepository.createAuthAuditLog({
      description: "Forgot-password requested for non-existent email.",
      metadata: { email: payload.email },
    });
    return { message: "If the email exists, a reset code has been sent." };
  }

  if (user.status !== "ACTIVE") {
    throw new ApiError(403, "This account is not active.");
  }

  await issuePasswordResetOtp(user);
  await authRepository.createAuthAuditLog({
    actorId: user.id,
    description: "Password reset OTP issued.",
  });

  return { message: "If the email exists, a reset code has been sent." };
}

async function resetPassword(payload) {
  const user = await authRepository.findAuthUserByEmail(payload.email);

  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  const otpRecord = await authRepository.findEmailOtp(user.id, PASSWORD_RESET_PURPOSE);

  if (!otpRecord) {
    throw new ApiError(400, "OTP was not requested or has expired.");
  }

  if (otpRecord.expiresAt.getTime() < Date.now()) {
    await authRepository.deleteEmailOtpById(otpRecord.id);
    throw new ApiError(400, "OTP has expired. Please request a new one.");
  }

  if (otpRecord.attempts >= env.otpMaxAttempts) {
    throw new ApiError(429, "Maximum OTP attempts reached. Please request a new OTP.");
  }

  const matches = hashOtp(payload.otp) === otpRecord.codeHash;

  if (!matches) {
    await authRepository.updateEmailOtpById(otpRecord.id, {
      attempts: {
        increment: 1,
      },
    });
    await authRepository.createAuthAuditLog({
      actorId: user.id,
      description: "Password reset failed due to invalid OTP.",
    });
    throw new ApiError(401, "Invalid OTP code.");
  }

  const passwordHash = await bcrypt.hash(payload.newPassword, 12);
  await authRepository.updateUserPassword(user.id, passwordHash);
  await authRepository.deleteEmailOtpById(otpRecord.id);
  await authRepository.createAuthAuditLog({
    actorId: user.id,
    description: "Password reset completed.",
  });

  return { message: "Password reset successfully." };
}

async function logout(userId) {
  if (userId) {
    await authRepository.createAuthAuditLog({
      actorId: userId,
      description: "User logged out.",
    });
  }

  return { message: "Logout successful." };
}

module.exports = {
  registerUser,
  loginUser,
  verifyOtp,
  resendOtp,
  forgotPassword,
  resetPassword,
  logout,
};
