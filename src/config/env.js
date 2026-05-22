const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

function parseCloudinaryUrl(url) {
  if (!url) {
    return {};
  }
  const match = url.trim().match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  if (!match) {
    return {};
  }
  return {
    cloudinaryApiKey: match[1],
    cloudinaryApiSecret: match[2],
    cloudinaryCloudName: match[3],
  };
}

const cloudinaryFromUrl = parseCloudinaryUrl(process.env.CLOUDINARY_URL);

const port = Number(process.env.PORT || 4000);

module.exports = {
  port,
  nodeEnv: process.env.NODE_ENV || "development",
  appUrl: process.env.APP_URL || `http://localhost:${port}`,
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  databaseUrl: process.env.DATABASE_URL || "",
  jwtSecret: process.env.JWT_SECRET || "replace-this-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
  redisUrl: process.env.REDIS_URL || "",
  cacheEnabled: process.env.CACHE_ENABLED === "true",
  uploadDir: path.join(process.cwd(), process.env.UPLOAD_DIR || "uploads/products"),
  telebirrBaseUrl: process.env.TELEBIRR_BASE_URL || "https://api.telebirr.et/sandbox",
  telebirrMerchantId: process.env.TELEBIRR_MERCHANT_ID || "",
  telebirrApiKey: process.env.TELEBIRR_API_KEY || "",
  telebirrWebhookSecret: process.env.TELEBIRR_WEBHOOK_SECRET || "",
  chapaBaseUrl: process.env.CHAPA_BASE_URL || "https://api.chapa.co/v1",
  chapaSecretKey: process.env.CHAPA_SECRET_KEY || "",
  chapaWebhookSecret: process.env.CHAPA_WEBHOOK_SECRET || "",
  aiProvider: process.env.AI_PROVIDER || "placeholder",
  aiModel: process.env.AI_MODEL || "placeholder-model",
  smtpHost: process.env.SMTP_HOST || "smtp.gmail.com",
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: process.env.SMTP_SECURE === "true",
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  smtpFrom: process.env.SMTP_FROM || process.env.SMTP_USER || "",
  otpTtlMinutes: Number(process.env.OTP_TTL_MINUTES || 10),
  otpMaxAttempts: Number(process.env.OTP_MAX_ATTEMPTS || 5),
  cloudinaryCloudName:
    process.env.CLOUDINARY_CLOUD_NAME || cloudinaryFromUrl.cloudinaryCloudName || "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || cloudinaryFromUrl.cloudinaryApiKey || "",
  cloudinaryApiSecret:
    process.env.CLOUDINARY_API_SECRET || cloudinaryFromUrl.cloudinaryApiSecret || "",
  cloudinaryUrl: process.env.CLOUDINARY_URL || "",
};
