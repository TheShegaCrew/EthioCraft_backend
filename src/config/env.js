const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const port = Number(process.env.PORT || 4000);

module.exports = {
  port,
  nodeEnv: process.env.NODE_ENV || "development",
  appUrl: process.env.APP_URL || `http://localhost:${port}`,
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
};
