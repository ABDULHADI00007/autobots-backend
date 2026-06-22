import rateLimit from "express-rate-limit";

// ============================================================
// RATE LIMITING CONFIGURATION
// ============================================================

const isDev = process.env.NODE_ENV !== "production";
const jsonMessage = (message) => ({ success: false, message });

// General API rate limiter — applied to mutating / authenticated routes
// 100 req / 15 min in production; disabled in development
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: jsonMessage("Too many requests from this IP, please try again after 15 minutes"),
  handler: (req, res) => res.status(429).json(jsonMessage("Too many requests from this IP, please try again after 15 minutes")),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isDev || req.path === "/health",
  keyGenerator: (req) => req.ip || req.connection.remoteAddress,
});

// Relaxed limiter for public read-only GET endpoints
// 300 req / 15 min in production; disabled in development
export const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: jsonMessage("Too many requests from this IP, please try again after 15 minutes"),
  handler: (req, res) => res.status(429).json(jsonMessage("Too many requests from this IP, please try again after 15 minutes")),
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
  keyGenerator: (req) => req.ip || req.connection.remoteAddress,
});

// Strict rate limiter for login attempts - 5 requests per 15 minutes
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: jsonMessage("Too many login attempts, please try again after 15 minutes"),
  handler: (req, res) => res.status(429).json(jsonMessage("Too many login attempts, please try again after 15 minutes")),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  keyGenerator: (req) => {
    // Use email + IP to prevent enumeration attacks
    return `${req.body?.email || "unknown"}:${req.ip}`;
  },
});

// Strict rate limiter for registration - 3 requests per hour
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: jsonMessage("Too many accounts created from this IP, please try again after 1 hour"),
  handler: (req, res) => res.status(429).json(jsonMessage("Too many accounts created from this IP, please try again after 1 hour")),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use email + IP
    return `${req.body?.email || "unknown"}:${req.ip}`;
  },
});

// Create account limiter - 5 requests per hour
export const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: jsonMessage("Too many requests from this IP, please try again after 1 hour"),
  handler: (req, res) => res.status(429).json(jsonMessage("Too many requests from this IP, please try again after 1 hour")),
  standardHeaders: true,
  legacyHeaders: false,
});
