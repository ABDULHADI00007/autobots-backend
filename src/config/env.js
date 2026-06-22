import dotenv from "dotenv";

dotenv.config();

// ============================================================
// ENVIRONMENT VARIABLE VALIDATION
// ============================================================

const required = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const optional = (name, fallback = null) => {
  return process.env[name] || fallback;
};

// Validate required environment variables
const PORT = optional("PORT", "5000");
const NODE_ENV = optional("NODE_ENV", "development");
const MONGO_URI = required("MONGODB_URI");
const JWT_SECRET = required("JWT_SECRET");
const JWT_EXPIRES_IN = optional("JWT_EXPIRES_IN", "7d");
const FRONTEND_URL = required("FRONTEND_URL");
const STRIPE_SECRET_KEY = optional("STRIPE_SECRET_KEY", "");
const STRIPE_WEBHOOK_SECRET = optional("STRIPE_WEBHOOK_SECRET", "");
const ALLOWED_ORIGINS = optional("ALLOWED_ORIGINS", "");

// Validation: JWT_SECRET should be at least 32 characters in production
if (NODE_ENV === "production" && JWT_SECRET.length < 32) {
  console.warn(
    "⚠️  WARNING: JWT_SECRET should be at least 32 characters for production"
  );
}

// Validation: STRIPE keys required in production
if (NODE_ENV === "production") {
  if (!STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is required in production");
  }
  if (!STRIPE_WEBHOOK_SECRET) {
    throw new Error("STRIPE_WEBHOOK_SECRET is required in production");
  }
}

export const env = {
  PORT: parseInt(PORT, 10),
  NODE_ENV,
  MONGO_URI,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  FRONTEND_URL,
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  ALLOWED_ORIGINS: ALLOWED_ORIGINS ? ALLOWED_ORIGINS.split(",").map((url) => url.trim()) : [],
  isDevelopment: NODE_ENV === "development",
  isProduction: NODE_ENV === "production",
};
