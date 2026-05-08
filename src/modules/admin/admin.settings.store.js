const fs = require("fs/promises");
const path = require("path");

const SETTINGS_FILE = path.join(process.cwd(), "data", "admin-settings.json");

const DEFAULT_SETTINGS = {
  general: {
    platformName: "EthioCraft",
    timezone: "Africa/Addis_Ababa",
    currency: "ETB",
    language: "English",
    logoFileName: "ethiocraft-mark.svg",
  },
  rolesPermissions: {
    selectedRole: "artisan",
    permissions: {
      customer: { view: true, edit: false, delete: false, approve: false, assign: false },
      artisan: { view: true, edit: true, delete: false, approve: false, assign: false },
      agent: { view: true, edit: true, delete: false, approve: true, assign: true },
      admin: { view: true, edit: true, delete: true, approve: true, assign: true },
    },
  },
  marketplaceRules: {
    commissionRate: 12,
    approvalMode: "manual",
    returnPolicy: "Returns accepted within 7 days for undamaged products with original packaging.",
    cancellationWindow: "24 hours",
    listingLimit: 80,
  },
  payments: {
    providers: { chapa: true, stripe: false, telebirr: true },
    transactionFee: 2.5,
    payoutSchedule: "weekly",
    walletEnabled: true,
  },
  logistics: {
    shippingRegions: ["Addis Ababa", "Oromia", "Amhara"],
    assignmentLogic: "auto",
    estimatedDelivery: "2-5 business days",
    pricingTiers: [
      { zone: "Local", min: 0, max: 5, fee: 120 },
      { zone: "Regional", min: 6, max: 20, fee: 180 },
      { zone: "National", min: 21, max: 50, fee: 250 },
    ],
  },
  security: {
    twoFactorRequired: true,
    minPasswordLength: 10,
    requireComplexity: true,
    sessionTimeout: "30 min",
    loginAlerts: true,
  },
  notifications: {
    emailTemplate: "Hello {{name}}, your order {{order_id}} has moved to {{status}}.",
    smsTriggers: { orderPlaced: true, productApproved: true, paymentReceived: false },
  },
  dataAnalytics: {
    dataRetentionDays: "90",
    trackingEnabled: true,
    fraudThreshold: 70,
    sensitivityLevel: "balanced",
  },
  integrations: {
    apiKey: "ec_live_default_key",
    webhookUrl: "",
    connected: { chapa: true, erp: false, crm: false },
  },
  appearance: {
    theme: "light",
    accentColor: "#C6A75E",
    density: "comfortable",
  },
};

function deepMerge(base, patch) {
  if (!patch || typeof patch !== "object") return base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === "object" && !Array.isArray(value) && out[key] && typeof out[key] === "object" && !Array.isArray(out[key])) {
      out[key] = deepMerge(out[key], value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

async function ensureFile() {
  await fs.mkdir(path.dirname(SETTINGS_FILE), { recursive: true });
  try {
    await fs.access(SETTINGS_FILE);
  } catch {
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2), "utf8");
  }
}

async function readSettings() {
  await ensureFile();
  const raw = await fs.readFile(SETTINGS_FILE, "utf8");
  const parsed = JSON.parse(raw);
  return deepMerge(DEFAULT_SETTINGS, parsed);
}

async function writeSettings(nextSettings) {
  await ensureFile();
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(nextSettings, null, 2), "utf8");
}

module.exports = {
  DEFAULT_SETTINGS,
  deepMerge,
  readSettings,
  writeSettings,
};
