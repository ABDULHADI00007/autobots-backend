import dotenv from "dotenv";

dotenv.config();

export const env = {
  PORT: process.env.PORT || 5000,
  MONGO_URI: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ai_marketplace",
  JWT_SECRET: process.env.JWT_SECRET || "supersecretjwtkey",
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || "",
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || "",
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:3000",
};
