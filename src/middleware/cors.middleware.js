import cors from "cors";
import { env } from "../config/env.js";

// ============================================================
// CORS CONFIGURATION
// ============================================================
// Properly configure Cross-Origin Resource Sharing for security

export const corsConfig = cors({
  // Allow only the frontend URL and any additional allowed origins
  origin: (origin, callback) => {
    // List of allowed origins
    const allowedOrigins = [env.FRONTEND_URL, ...env.ALLOWED_ORIGINS];

    // Allow requests with no origin (mobile apps, curl, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // If origin is not allowed
    return callback(
      new Error(`CORS policy: origin ${origin} is not allowed`),
      false
    );
  },

  // Allow credentials (cookies, authorization headers)
  credentials: true,

  // Allowed HTTP methods
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],

  // Allowed request headers
  allowedHeaders: ["Content-Type", "Authorization"],

  // Headers exposed to the client
  exposedHeaders: ["X-Total-Count", "X-Page-Number", "RateLimit-Limit", "RateLimit-Remaining"],

  // Maximum time (in seconds) the results of a preflight request can be cached
  maxAge: 86400, // 24 hours
});
