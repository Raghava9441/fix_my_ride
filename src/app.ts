// src/app.ts
import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import expressRateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";
import { v4 as uuidv4 } from "uuid";
import mongoose from "mongoose";

// Import configurations
import { logger, stream } from "./config/logger";
import { corsOptions } from "./config/cors";
import { rateLimitConfig } from "./config/rate-limit";

// Import middleware
import { errorHandler } from "./middleware/error.middleware";
// import { notFound } from './middleware/error/notFound';
import { requestContext } from "./middleware/requestContext.middleware";
import { tenantIsolation } from "./middleware/tenant.middleware";
import { auditLogger } from "./middleware/audit.middleware";
import { requestSanitizer } from "./middleware/sanitizer.middleware";

// Import routes
import authRoutes from "./routes/auth.routes";
import ownerRoutes from "./routes/owner.routes";
import centerRoutes from "./routes/serviceCenter.routes";
import adminRoutes from "./routes/admin.routes";
import vehicleRoutes from "./routes/vehicle.routes";
import serviceRecordRoutes from "./routes/serviceRecord.routes";
import reminderRoutes from "./routes/reminder.routes";
import invitationRoutes from "./routes/invitation.routes";
import reportRoutes from "./routes/report.routes";
import publicRoutes from "./routes/public.routes";
import accountRoutes from "./routes/account.routes";

// Import services
// import { healthCheckService } from './services/health/healthCheckService';

// Create Express application
const app: Application = express();

// ========================================
// Request ID Middleware
// ========================================
app.use((req: Request, res: Response, next: NextFunction) => {
  req.id = uuidv4();
  res.setHeader("X-Request-ID", req.id);
  next();
});

// ========================================
// Logging Middleware
// ========================================
app.use(morgan("combined", { stream }));
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info({
    type: "request",
    requestId: req.id,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  });
  next();
});

// ========================================
// Security Middleware
// ========================================
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: [
          "'self'",
          "https://api.stripe.com",
          "https://maps.googleapis.com",
        ],
        frameSrc: ["'self'", "https://js.stripe.com"],
        workerSrc: ["'self'", "blob:"],
        childSrc: ["'self'", "blob:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

// CORS configuration
app.use(cors(corsOptions));

// Rate limiting
app.use("/api", expressRateLimit(rateLimitConfig));

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Compression
app.use(
  compression({
    level: 6,
    threshold: 100 * 1024, // 100KB
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) {
        return false;
      }
      return compression.filter(req, res);
    },
  }),
);

// Security sanitization
app.use(mongoSanitize()); // Prevent NoSQL injection
app.use(hpp()); // Prevent HTTP parameter pollution
app.use(requestSanitizer); // XSS protection

// ========================================
// Tenant Context Middleware
// ========================================
app.use(requestContext);
app.use(tenantIsolation);

// ========================================
// Audit Logging Middleware (for sensitive routes)
// ========================================
app.use("/api/v1/admin", auditLogger);
app.use("/api/v1/auth/change-password", auditLogger);
app.use("/api/v1/accounts/*/status", auditLogger);

// ========================================
// API Routes
// ========================================

// Health check endpoints
// app.get('/health', healthCheckService.simple);
// app.get('/health/detailed', healthCheckService.detailed);
// app.get('/ready', healthCheckService.readiness);
// app.get('/live', healthCheckService.liveness);

// API version 1 routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/owners", ownerRoutes);
app.use("/api/v1/staff", centerRoutes); // Staff routes under service center module
app.use("/api/v1/service-centers", centerRoutes);
app.use("/api/v1/vehicles", vehicleRoutes);
app.use("/api/v1/service-records", serviceRecordRoutes);
app.use("/api/v1/reminders", reminderRoutes);
app.use("/api/v1/invitations", invitationRoutes);
app.use("/api/v1/reports", reportRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/public", publicRoutes);
app.use("/api/v1/accounts", accountRoutes);

// ========================================
// Static Files (for document uploads)
// ========================================
app.use(
  "/uploads",
  express.static("public/uploads", {
    maxAge: "1d",
    etag: true,
    lastModified: true,
  }),
);

// ========================================
// 404 Handler
// ========================================
// app.use(notFound);

// ========================================
// Global Error Handler
// ========================================
app.use(errorHandler);

// ========================================
// Graceful Shutdown Handler
// ========================================
const gracefulShutdown = async () => {
  logger.info("Received shutdown signal, closing connections...");

  // Close database connections
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
    logger.info("MongoDB connection closed");
  }

  // Close Redis connections if any
  // await redisClient.quit();

  process.exit(0);
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// Unhandled promise rejections
process.on("unhandledRejection", (err: Error) => {
  logger.error("Unhandled Promise Rejection:", {
    error: err.message,
    stack: err.stack,
  });
  // Graceful shutdown
  gracefulShutdown();
});

// Uncaught exceptions
process.on("uncaughtException", (err: Error) => {
  logger.error("Uncaught Exception:", {
    error: err.message,
    stack: err.stack,
  });
  // Graceful shutdown
  gracefulShutdown();
});

export default app;
