import http from "http";
import app from "./app.js";
import connectDB from "./config/db.js";
import { env } from "./config/env.js";
import * as orderService from "./modules/orders/order.service.js";
import { initializeSocket } from "./socket/index.js";
import { validateResendConfiguration } from "./modules/email/email.client.js";
import { validateStorageStartup } from "./config/storage/storage.startup.js";

let server;

const startServer = async () => {
  try {
    console.log("Stripe env loaded =", {
      STRIPE_SECRET_KEY: Boolean(env.STRIPE_SECRET_KEY),
      STRIPE_WEBHOOK_SECRET: Boolean(env.STRIPE_WEBHOOK_SECRET),
    });

    // Connect to MongoDB
    await connectDB();
    console.log("✓ MongoDB connected successfully");

    const httpServer = http.createServer(app);

    try {
      initializeSocket(httpServer);
    } catch (error) {
      console.warn("Socket.IO initialization failed, continuing without real-time layer:", error.message);
    }

    try {
      await validateResendConfiguration();
      console.log("✓ Resend configuration validated successfully");
    } catch (error) {
      console.error("Resend configuration validation failed:", error.message);
      process.exit(1);
    }

    // Validate S3 bucket access (skipped gracefully when S3 is not configured)
    try {
      await validateStorageStartup();
    } catch (error) {
      console.error("S3 storage validation failed:", error.message);
      if (env.isProduction) {
        process.exit(1);
      }
    }

    // Start Express server
    server = httpServer.listen(env.PORT, () => {
      console.log(
        `✓ Server running on port ${env.PORT} (${env.NODE_ENV} mode)`
      );
    });

    // Run auto-release on startup and every hour thereafter
    try {
      const releasedCount = await orderService.autoReleaseOverdue();
      console.log(`Auto-release executed on startup, ${releasedCount} order(s) released`);
    } catch (err) {
      console.error("Auto-release startup failed:", err.message || err);
    }

    setInterval(async () => {
      try {
        const releasedCount = await orderService.autoReleaseOverdue();
        console.log(`Auto-release executed, ${releasedCount} order(s) released`);
      } catch (err) {
        console.error("Auto-release hourly job failed:", err.message || err);
      }
    }, 60 * 60 * 1000);

    // ============================================================
    // GRACEFUL SHUTDOWN HANDLING
    // ============================================================

    // Handle SIGTERM (graceful shutdown signal from Docker, systemd, etc.)
    process.on("SIGTERM", () => {
      console.log("SIGTERM signal received: closing HTTP server");
      gracefulShutdown("SIGTERM");
    });

    // Handle SIGINT (Ctrl+C)
    process.on("SIGINT", () => {
      console.log("SIGINT signal received: closing HTTP server");
      gracefulShutdown("SIGINT");
    });

    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
      console.error("FATAL ERROR - Uncaught Exception:", error);
      gracefulShutdown("uncaughtException");
    });

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (reason, promise) => {
      console.error("Unhandled Rejection at:", promise, "reason:", reason);
      // Don't exit for unhandled rejections, just log them
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

// Graceful shutdown function
const gracefulShutdown = (signal) => {
  console.log(`Graceful shutdown initiated by ${signal}`);

  if (server) {
    server.close(async () => {
      console.log("HTTP server closed");

      // Close MongoDB connection
      try {
        const mongoose = (await import("mongoose")).default;
        await mongoose.connection.close();
        console.log("✓ MongoDB connection closed");
      } catch (error) {
        console.error("Error closing MongoDB connection:", error.message);
      }

      console.log("Goodbye!");
      process.exit(0);
    });

    // Force shutdown after 30 seconds if graceful shutdown takes too long
    setTimeout(() => {
      console.error(
        "Forcing shutdown - graceful shutdown took longer than 30 seconds"
      );
      process.exit(1);
    }, 30000);
  } else {
    process.exit(0);
  }
};

// Start the server
startServer();