// src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { verifyToken, isTokenBlacklisted } from "../utils/token";
import { config } from "../config/environment";
import { getRedisClient } from "../config/redis";
import { AppError } from "../utils/appError";
import { ERROR_CODES } from "../constants/errors";
import { logger } from "../config/logger";

/**
 * Extract a bearer token from the Authorization header.
 */
function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

/**
 * Verify the access token, checking signature, expiry, and revocation.
 * Throws an AppError mapped to the error catalog on any failure.
 */
async function verifyAccessToken(token: string, correlationId?: string) {
  const decoded = verifyToken<{
    userId: string;
    email: string;
    role: string;
    roles?: string[];
    tenantId?: string;
    permissions?: string[];
    sessionVersion?: number;
    mfaVerified?: boolean;
    jti?: string;
  }>(token, config.jwt.secret, {
    issuer: "fix-my-ride",
    audience: "fix-my-ride-clients",
  });

  if (!decoded || !decoded.userId) {
    throw AppError.fromCode("TOKEN_INVALID", { correlationId });
  }

  // Revocation check via Redis denylist (only when Redis is available)
  try {
    const revoked = await isTokenBlacklisted(token, { getRedis: getRedisClient });
    if (revoked) {
      throw AppError.fromCode("TOKEN_REVOKED", { correlationId });
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    // If Redis is down, fail closed but log. Production should alert here.
    logger.error({ type: "auth_redis_check_failed", correlationId, error: (err as Error).message });
    throw AppError.fromCode("SERVICE_UNAVAILABLE", { correlationId });
  }

  return decoded;
}

/**
 * Primary authentication middleware.
 * Attaches `req.user`, `req.userId`, `req.userRole`, `req.tenantId`, `req.authToken`.
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const correlationId = (req as any).id;
  try {
    const token = extractToken(req);
    if (!token) {
      throw AppError.fromCode("TOKEN_MISSING", { correlationId });
    }

    const decoded = await verifyAccessToken(token, correlationId);

    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      roles: decoded.roles && decoded.roles.length ? decoded.roles : [decoded.role],
      tenantId: decoded.tenantId,
      permissions: decoded.permissions,
      sessionVersion: decoded.sessionVersion,
      mfaVerified: decoded.mfaVerified,
    };
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    req.tenantId = decoded.tenantId ?? req.tenantId;
    req.authToken = decoded as Record<string, any>;

    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Optional authentication: populates req.user when a valid token is present,
 * but does not fail the request when absent. Use for public-with-personalization routes.
 */
export const authenticateOptional = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const correlationId = (req as any).id;
  const token = extractToken(req);
  if (!token) return next();

  try {
    const decoded = await verifyAccessToken(token, correlationId);
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      roles: decoded.roles && decoded.roles.length ? decoded.roles : [decoded.role],
      tenantId: decoded.tenantId,
      permissions: decoded.permissions,
      sessionVersion: decoded.sessionVersion,
      mfaVerified: decoded.mfaVerified,
    };
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    req.tenantId = decoded.tenantId ?? req.tenantId;
    req.authToken = decoded as Record<string, any>;
  } catch {
    // Ignore invalid tokens for optional auth; treat as anonymous.
  }
  next();
};

// Re-export for convenience
export { AppError, ERROR_CODES };
