const ApiError = require("../utils/apiError");

const buckets = new Map();

function buildKey(req, keyPrefix) {
  const forwardedFor = req.headers["x-forwarded-for"];
  const proxyIp = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : typeof forwardedFor === "string"
      ? forwardedFor.split(",")[0]
      : null;
  const ip = proxyIp || req.ip || req.socket?.remoteAddress || "unknown-ip";
  return `${keyPrefix}:${ip}`;
}

function rateLimit({ windowMs, max, keyPrefix = "global", message }) {
  return (req, _res, next) => {
    const now = Date.now();
    const key = buildKey(req, keyPrefix);
    const existing = buckets.get(key);

    if (!existing || now > existing.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (existing.count >= max) {
      next(new ApiError(429, message || "Too many requests. Please try again later."));
      return;
    }

    existing.count += 1;
    buckets.set(key, existing);
    next();
  };
}

module.exports = {
  rateLimit,
};
