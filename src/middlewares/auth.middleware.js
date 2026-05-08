const prisma = require("../config/prisma");
const { verifyAccessToken } = require("../utils/jwt");
const ApiError = require("../utils/apiError");

async function authenticate(req, _res, next) {
  const tokenFromCookie = req.cookies?.auth_token;
  const authorizationHeader = req.headers.authorization;
  const tokenFromHeader =
    authorizationHeader && authorizationHeader.startsWith("Bearer ")
      ? authorizationHeader.split(" ")[1]
      : null;
  const token = tokenFromCookie || tokenFromHeader;

  if (!token) {
    next(new ApiError(401, "Authorization token is required."));
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        role: true,
        email: true,
        status: true,
      },
    });

    if (!user || user.status !== "ACTIVE") {
      next(new ApiError(401, "User is no longer allowed to access this resource."));
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    next(new ApiError(401, "Invalid or expired access token."));
  }
}

function authorize(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      next(new ApiError(401, "Authentication is required."));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(new ApiError(403, "You do not have permission to perform this action."));
      return;
    }

    next();
  };
}

module.exports = {
  authenticate,
  authorize,
};
