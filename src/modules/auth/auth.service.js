const bcrypt = require("bcryptjs");
const authRepository = require("./auth.repository");
const ApiError = require("../../utils/apiError");
const { generateAccessToken } = require("../../utils/jwt");

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

  return {
    user,
    token: generateAccessToken(user),
  };
}

async function loginUser(payload) {
  const existingUser = await authRepository.findAuthUserByEmail(payload.email);

  if (!existingUser) {
    throw new ApiError(401, "Invalid email or password.");
  }

  const passwordMatches = await bcrypt.compare(payload.password, existingUser.passwordHash);

  if (!passwordMatches) {
    throw new ApiError(401, "Invalid email or password.");
  }

  if (existingUser.status !== "ACTIVE") {
    throw new ApiError(403, "This account is not active.");
  }

  const user = await authRepository.findPublicUserById(existingUser.id);

  return {
    user,
    token: generateAccessToken(user),
  };
}

module.exports = {
  registerUser,
  loginUser,
};
