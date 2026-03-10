const env = require("../config/env");

function errorHandler(error, _req, res, _next) {
  let statusCode = error.statusCode || 500;
  let message = error.message || "Internal server error.";
  let details = error.details || null;

  if (error.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Access token has expired.";
  }

  if (error.code === "P2002") {
    statusCode = 409;
    message = "A record with that value already exists.";
    details = error.meta || null;
  }

  if (error.code === "P2025") {
    statusCode = 404;
    message = "Requested resource was not found.";
  }

  res.status(statusCode).json({
    message,
    ...(details ? { details } : {}),
    ...(env.nodeEnv !== "production" && statusCode >= 500 ? { stack: error.stack } : {}),
  });
}

module.exports = {
  errorHandler,
};
