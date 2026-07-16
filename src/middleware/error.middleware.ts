// src/middleware/error.middleware.ts
import { config } from "../config/environment";
import { logger } from "../config/logger";
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { AppError, FieldError } from "../utils/appError";
import { ERROR_CODES, ErrorCodeKey } from "../constants/errors";
import { ZodError } from "zod";

// ─── Backwards-compatible error classes (map to the catalog) ───────────────
// These remain so existing `throw new ValidationError(...)` calls keep working,
// but the final response shape is unified via AppError below.

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: unknown) {
    const def = ERROR_CODES.VALIDATION_FAILED;
    super({ code: def.code, key: def.key, message, httpStatus: def.httpStatus, details });
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Authentication required", correlationId?: string) {
    const def = ERROR_CODES.UNAUTHENTICATED;
    super({ code: def.code, key: def.key, message, httpStatus: def.httpStatus, correlationId });
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "Insufficient permissions", correlationId?: string) {
    const def = ERROR_CODES.FORBIDDEN;
    super({ code: def.code, key: def.key, message, httpStatus: def.httpStatus, correlationId });
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    const def = ERROR_CODES.NOT_FOUND;
    super({ code: def.code, key: def.key, message: `${resource} not found`, httpStatus: def.httpStatus });
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource conflict") {
    const def = ERROR_CODES.CONFLICT;
    super({ code: def.code, key: def.key, message, httpStatus: def.httpStatus });
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests, please try again later") {
    const def = ERROR_CODES.RATE_LIMIT_EXCEEDED;
    super({ code: def.code, key: def.key, message, httpStatus: def.httpStatus });
  }
}

// ─── Error normalization ───────────────────────────────────────────────────

function getCorrelationId(req: Request): string | undefined {
  return (req as any).id;
}

function normalize(err: any, correlationId?: string): AppError {
  // Already a unified AppError
  if (err instanceof AppError) {
    if (!err.correlationId && correlationId) {
      err.correlationId = correlationId;
    }
    return err;
  }

  // Zod validation
  if (err instanceof ZodError) {
    const details: FieldError[] = err.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message,
      code: e.code,
    }));
    const def = ERROR_CODES.VALIDATION_FAILED;
    return new AppError({
      code: def.code,
      key: def.key,
      message: "Validation failed",
      httpStatus: def.httpStatus,
      correlationId,
      details,
    });
  }

  // Mongoose validation
  if (err instanceof mongoose.Error.ValidationError) {
    const details: FieldError[] = Object.values(err.errors).map((e: any) => ({
      field: e.path,
      message: e.message,
      value: e.value,
    }));
    const def = ERROR_CODES.VALIDATION_FAILED;
    return new AppError({
      code: def.code,
      key: def.key,
      message: "Validation failed",
      httpStatus: def.httpStatus,
      correlationId,
      details,
    });
  }

  // Mongoose cast (invalid ObjectId)
  if (err instanceof mongoose.Error.CastError) {
    const def = ERROR_CODES.INVALID_ID;
    return new AppError({
      code: def.code,
      key: def.key,
      message: `Invalid ${err.path}: ${err.value}`,
      httpStatus: def.httpStatus,
      correlationId,
      details: { field: err.path, value: err.value },
    });
  }

  // Duplicate key (MongoServerError code 11000)
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern ?? {})[0] ?? "value";
    const value = err.keyValue?.[field];
    const def = ERROR_CODES.DUPLICATE_KEY;
    return new AppError({
      code: def.code,
      key: def.key,
      message: `Duplicate value '${value}' for field '${field}'`,
      httpStatus: def.httpStatus,
      correlationId,
      details: { field, value },
    });
  }

  // JWT errors
  if (err?.name === "JsonWebTokenError") {
    const def = ERROR_CODES.TOKEN_INVALID;
    return new AppError({
      code: def.code,
      key: def.key,
      message: "Invalid token. Please log in again.",
      httpStatus: def.httpStatus,
      correlationId,
    });
  }
  if (err?.name === "TokenExpiredError") {
    const def = ERROR_CODES.TOKEN_EXPIRED;
    return new AppError({
      code: def.code,
      key: def.key,
      message: "Your token has expired. Please log in again.",
      httpStatus: def.httpStatus,
      correlationId,
    });
  }

  // Unknown / programmer error
  const def = ERROR_CODES.INTERNAL_ERROR;
  return new AppError({
    code: def.code,
    key: def.key,
    message: err?.message || "Internal server error",
    httpStatus: err?.statusCode || def.httpStatus,
    correlationId,
    isOperational: false,
  });
}

// ─── Response serialization ────────────────────────────────────────────────

function sendError(err: AppError, res: Response): void {
  const isProd = config.env === "production";

  // Never leak internals for non-operational errors in production.
  const safeMessage =
    err.isOperational || !isProd ? err.message : "An unexpected error occurred.";

  const body: Record<string, unknown> = {
    success: false,
    code: err.code,
    key: err.key,
    correlationId: err.correlationId,
    message: safeMessage,
    timestamp: new Date().toISOString(),
  };

  if (err.details) {
    body.details = err.details;
  }

  if (!isProd) {
    body.stack = err.stack;
  }

  res.status(err.httpStatus).json(body);
}

// ─── Main error handler ────────────────────────────────────────────────────

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void => {
  const correlationId = getCorrelationId(req);
  const appError = normalize(err, correlationId);

  logger.error({
    type: "error",
    code: appError.code,
    key: appError.key,
    correlationId: appError.correlationId,
    requestId: (req as any).id,
    userId: (req as any).userId,
    tenantId: (req as any).tenantId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get("user-agent"),
    httpStatus: appError.httpStatus,
    message: appError.message,
    stack: appError.stack,
    details: appError.details,
  });

  // Expose correlation id to the client for support/tracing.
  if (appError.correlationId) {
    res.setHeader("X-Correlation-ID", appError.correlationId);
  }

  sendError(appError, res);
};

// 404 handler for unmatched routes
export const notFound = (req: Request, res: Response): void => {
  const correlationId = getCorrelationId(req);
  const def = ERROR_CODES.NOT_FOUND;
  const err = new AppError({
    code: def.code,
    key: def.key,
    message: `Route not found: ${req.method} ${req.path}`,
    httpStatus: def.httpStatus,
    correlationId,
  });
  if (correlationId) res.setHeader("X-Correlation-ID", correlationId);
  sendError(err, res);
};

export { AppError, ERROR_CODES };
export type { ErrorCodeKey };
