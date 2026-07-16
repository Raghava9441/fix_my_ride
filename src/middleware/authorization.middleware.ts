// src/middleware/authorization.middleware.ts
import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/appError";
import { ERROR_CODES } from "../constants/errors";

/**
 * Require that the authenticated user has one of the allowed roles.
 * Must be used after `authenticate`.
 */
export const requireRole = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const correlationId = (req as any).id;
    if (!req.user) {
      return next(AppError.fromCode("UNAUTHENTICATED", { correlationId }));
    }

    const userRoles = req.user.roles ?? [req.user.role];
    const hasRole = allowedRoles.some((r) => userRoles.includes(r));

    if (!hasRole) {
      return next(
        AppError.fromCode("INSUFFICIENT_ROLE", {
          correlationId,
          details: { required: allowedRoles, has: userRoles },
        }),
      );
    }
    next();
  };
};

/**
 * Require that the authenticated user has all of the given permissions.
 * Permissions come from the token `permissions` claim (or role-based fallback).
 */
export const requirePermission = (...requiredPermissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const correlationId = (req as any).id;
    if (!req.user) {
      return next(AppError.fromCode("UNAUTHENTICATED", { correlationId }));
    }

    const userPermissions = new Set<string>(req.user.permissions ?? []);
    const missing = requiredPermissions.filter((p) => !userPermissions.has(p));

    if (missing.length > 0) {
      return next(
        AppError.fromCode("FORBIDDEN", {
          correlationId,
          details: { missing },
        }),
      );
    }
    next();
  };
};

/**
 * Require that the authenticated user belongs to the tenant referenced by
 * `req.params.tenantId` or `req.body.tenantId` (or is an admin).
 */
export const requireSameTenant = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const correlationId = (req as any).id;
  if (!req.user) {
    return next(AppError.fromCode("UNAUTHENTICATED", { correlationId }));
  }

  const targetTenant =
    (req.params as any)?.tenantId ?? (req.body as any)?.tenantId;
  const userRoles = req.user.roles ?? [req.user.role];

  if (userRoles.includes("admin")) return next();

  if (targetTenant && req.user.tenantId !== targetTenant) {
    return next(
      AppError.fromCode("CROSS_TENANT_ACCESS", {
        correlationId,
        details: { targetTenant },
      }),
    );
  }
  next();
};
