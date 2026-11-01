// src/middleware/authorization.middleware.ts
import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/appError";
import { ERROR_CODES } from "../constants/errors";
import { StaffProfile } from "../models/StaffProfile";

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


/**
 * Require that the caller administers their workspace: the platform `admin`
 * role, or a staff profile holding the `tenant_admin` system role (what
 * onboarding gives whoever creates the workspace).
 *
 * `requireRole("owner")` is NOT a substitute. "Owner" is also the account
 * role every self-registered customer gets, and customers carry the tenant's
 * id - so that guard let any customer rename the workspace, switch off its
 * MFA requirement, or change and cancel its subscription.
 */
export const requireWorkspaceAdmin = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  const correlationId = (req as any).id;
  try {
    if (!req.user) return next(AppError.fromCode("UNAUTHENTICATED", { correlationId }));

    const roles = req.user.roles ?? [req.user.role];
    if (roles.includes("admin")) return next();

    const staff = await StaffProfile.findByAccount(req.user.id);
    const role = staff?.roleId as unknown as { slug?: string } | undefined;
    if (role?.slug === "tenant_admin") return next();

    return next(
      AppError.fromCode("INSUFFICIENT_ROLE", {
        correlationId,
        details: { required: ["tenant_admin"] },
      }),
    );
  } catch (err) {
    return next(err);
  }
};


/**
 * Require that the caller works on the staff side: a staff-type account role,
 * or a staff profile.
 *
 * `requireRole("staff", "admin")` is not equivalent. The person who creates a
 * workspace has the account role `owner` - the same as a customer - and is
 * only recognisable as staff by their profile; `service_advisor` is a staff
 * role that list leaves out entirely. Either was refused outright.
 */
export const requireStaffSide = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  const correlationId = (req as any).id;
  try {
    if (!req.user) return next(AppError.fromCode("UNAUTHENTICATED", { correlationId }));

    const roles = req.user.roles ?? [req.user.role];
    if (roles.some((r) => ["admin", "staff", "service_advisor"].includes(r))) return next();

    if (await StaffProfile.findByAccount(req.user.id)) return next();

    return next(
      AppError.fromCode("INSUFFICIENT_ROLE", {
        correlationId,
        details: { required: ["staff"] },
      }),
    );
  } catch (err) {
    return next(err);
  }
};
