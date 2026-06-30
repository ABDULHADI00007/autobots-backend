import { env } from "../config/env.js";
import { StorageError } from "../config/storage/storage.errors.js";

// ============================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================

// Standard error response format
const sendError = (res, statusCode, message, errorCode = null) => {
  res.status(statusCode).json({
    success: false,
    message,
    ...(errorCode && { errorCode }),
    ...(env.isDevelopment && { timestamp: new Date().toISOString() }),
  });
};

// 404 Not Found handler
export const notFoundHandler = (req, res) => {
  sendError(res, 404, `Route not found: ${req.method} ${req.path}`, "ROUTE_NOT_FOUND");
};

// Global error handler
export const errorHandler = (err, req, res, next) => {
  // Log error in development
  if (env.isDevelopment) {
    console.error("ERROR:", {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  }

  // Default error values
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";
  let errorCode = err.errorCode || "INTERNAL_SERVER_ERROR";

  // Handle specific error types
  // ────────────────────────────────

  // Mongoose validation error
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = "Validation Error";
    errorCode = "VALIDATION_ERROR";
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === "CastError") {
    statusCode = 400;
    message = "Invalid ID format";
    errorCode = "INVALID_ID";
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue)[0];
    message = `${field} already exists`;
    errorCode = "DUPLICATE_ENTRY";
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
    errorCode = "INVALID_TOKEN";
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired";
    errorCode = "TOKEN_EXPIRED";
  }

  // Zod validation error
  if (err.name === "ZodError") {
    statusCode = 400;
    message = err.errors[0]?.message || "Validation failed";
    errorCode = "VALIDATION_ERROR";
  }

  // Handle specific error messages
  // ──────────────────────────────

  if (message === "Email already exists") {
    statusCode = 409;
    errorCode = "EMAIL_EXISTS";
  }

  if (message === "Invalid email or password") {
    statusCode = 401;
    errorCode = "INVALID_CREDENTIALS";
  }

  if (message === "User not found") {
    statusCode = 404;
    errorCode = "USER_NOT_FOUND";
  }

  if (message === "Access denied") {
    statusCode = 403;
    errorCode = "ACCESS_DENIED";
  }

  // Rate limit error
  if (err.status === 429) {
    statusCode = 429;
    errorCode = "RATE_LIMIT_EXCEEDED";
  }

  // Storage errors — production-safe messages (never expose bucket, SDK, or credentials)
  if (err instanceof StorageError || err?.name?.startsWith?.("Storage")) {
    const storageCodeMap = {
      STORAGE_VALIDATION_ERROR:    400,
      STORAGE_NOT_FOUND:           404,
      STORAGE_AUTHORIZATION_ERROR: 403,
      STORAGE_CONFIG_ERROR:        503,
    };
    statusCode = err.statusCode || storageCodeMap[err.code] || 500;
    // Use the sanitized storage message — it never contains credentials or bucket names
    message   = err.message || "A storage error occurred.";
    errorCode = err.code    || "STORAGE_ERROR";
  }

  // In production, don't expose sensitive error details
  if (env.isProduction && statusCode === 500) {
    message = "Internal Server Error";
    errorCode = "INTERNAL_SERVER_ERROR";
  }

  // Send error response
  sendError(res, statusCode, message, errorCode);
};

