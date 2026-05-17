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

  if (error.name === "MulterError") {
    statusCode = 400;
    if (error.code === "LIMIT_FILE_SIZE") {
      message = "Each image must be 5 MB or smaller.";
    } else if (error.code === "LIMIT_FILE_COUNT") {
      message = "You can upload up to 6 images at a time.";
    } else {
      message = error.message || "File upload failed.";
    }
  }

  if (error.message && /Only JPEG, PNG, and WEBP/i.test(error.message)) {
    statusCode = 400;
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
