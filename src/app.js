import express from "express";
import path from "path";
import { helmetConfig } from "./middleware/helmet.middleware.js";
import { corsConfig } from "./middleware/cors.middleware.js";
import { apiLimiter, readLimiter, loginLimiter, registerLimiter } from "./middleware/rateLimit.middleware.js";
import { notFoundHandler, errorHandler } from "./middleware/error.middleware.js";
import routes from "./routes/index.js";
import { stripeWebhook } from "./modules/orders/order.controller.js";

const app = express();

// ============================================================
// SECURITY MIDDLEWARE
// ============================================================

// Helmet - Set security HTTP headers
app.use(helmetConfig);

// Trust proxy - Required when deployed behind a reverse proxy (load balancer)
app.set("trust proxy", 1);

// CORS - Cross-Origin Resource Sharing
app.use(corsConfig);

// ============================================================
// WEBHOOK HANDLING (before JSON parsing)
// ============================================================
// Stripe webhook requires raw body, must be before express.json()
app.post("/api/orders/webhook", express.raw({ type: "application/json" }), stripeWebhook);

// ============================================================
// BODY PARSING
// ============================================================
// Large limit only for attachment uploads (base64 files). All other routes use 1mb.
app.use((req, res, next) => {
  // Attachment uploads (base64, up to 50 MB)
  if (req.method === "POST" && req.path === "/api/attachments") {
    return express.json({ limit: "50mb" })(req, res, next);
  }
  // Media uploads: avatar (5 MB), logo (5 MB), banner (8 MB) — send 15 MB ceiling
  if (
    (req.method === "PUT") &&
    (
      req.path === "/api/users/profile/avatar"  ||
      req.path === "/api/users/profile/logo"    ||
      req.path === "/api/users/profile/banner"
    )
  ) {
    return express.json({ limit: "15mb" })(req, res, next);
  }
  // Listing media: thumbnail (8 MB), gallery images (10 MB) — 15 MB ceiling
  if (
    req.path.match(/^\/api\/listings\/[^/]+\/(thumbnail|gallery)$/) ||
    req.path.match(/^\/api\/listings\/[^/]+\/gallery\/reorder$/)
  ) {
    return express.json({ limit: "15mb" })(req, res, next);
  }
  // Listing media files: demoVideo, documentation, setupGuide (up to 250MB) — 300MB ceiling
  if (req.path.match(/^\/api\/listings\/[^/]+\/media\/(demoVideo|documentation|setupGuide)$/)) {
    return express.json({ limit: "300mb" })(req, res, next);
  }
  // Seller application documents: identity (10 MB), portfolio (25 MB), supporting (25 MB) — 30 MB ceiling
  if (req.path.match(/^\/api\/seller-applications\/me\/documents\//)) {
    return express.json({ limit: "30mb" })(req, res, next);
  }
  return express.json({ limit: "1mb" })(req, res, next);
});
app.use(express.urlencoded({ limit: "1mb", extended: true }));

app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

// ============================================================
// RATE LIMITING
// ============================================================
// Relaxed limiter for public read-only endpoints (disabled in development)
app.use("/api/listings",   readLimiter);
app.use("/api/categories", readLimiter);
app.use("/api/auth/me",    readLimiter);

// General limiter for all other API routes (disabled in development)
app.use("/api", apiLimiter);

// Strict limiters for auth write endpoints (always active)
app.use("/api/auth/login",    loginLimiter);
app.use("/api/auth/register", registerLimiter);

// ============================================================
// ROUTES
// ============================================================
app.use("/api", routes);

// ============================================================
// HEALTH CHECK ENDPOINT
// ============================================================
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

// ============================================================
// ERROR HANDLING
// ============================================================

// 404 Not Found handler - must be after all routes
app.use(notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);

export default app;