// src/middleware/tenant/tenantIsolation.ts
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { logger } from "../config/logger";
import { AppError } from "../utils/appError";
import { ERROR_CODES } from "../constants/errors";

/**
 * Resolves the active tenant for the current request and stores it in the
 * request context (AsyncLocalStorage). The actual isolation is enforced at the
 * data layer by `tenantPlugin`, which reads the tenant from this context.
 *
 * Resolution priority:
 *   1. Authenticated user's tenantId (set by auth middleware)
 *   2. x-tenant-id header (service-to-service / trusted callers)
 *   3. tenantId query param (development only)
 *
 * Admin requests are intentionally NOT scoped (global visibility).
 */
const PUBLIC_PREFIXES = ["/health", "/ready", "/live", "/api/v1/public", "/api/v1/webhooks"];

export const tenantIsolation = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  try {
    // Public endpoints are never tenant-scoped.
    if (PUBLIC_PREFIXES.some((p) => req.path.startsWith(p))) {
      return next();
    }

    const userRoles = (req as any).user?.roles ?? [(req as any).user?.role];
    const isAdmin = Array.isArray(userRoles) && userRoles.includes("admin");

    // Already resolved from JWT by auth middleware.
    let tenantId = (req as any).user?.tenantId as string | undefined;

    // Trusted header override (e.g. internal services, subdomain routing).
    if (!tenantId && req.headers["x-tenant-id"]) {
      tenantId = req.headers["x-tenant-id"] as string;
    } else if (!tenantId && (req.query as any).tenantId && process.env.NODE_ENV === "development") {
      tenantId = (req.query as any).tenantId as string;
    }

    // Persist into the AsyncLocalStorage-backed context used by the plugin.
    if (tenantId) {
      (req as any).tenantId = tenantId;
      req.context?.set("tenantId", tenantId);
      res.setHeader("X-Tenant-ID", tenantId);
    }
    if (Array.isArray(userRoles)) {
      req.context?.set("userRoles", userRoles);
    }

    // Admin bypasses tenant scoping entirely.
    if (isAdmin) {
      req.context?.set("userRoles", ["admin"]);
    }

    next();
  } catch (err) {
    logger.error({ type: "tenant_resolution_error", error: (err as Error).message });
    next(
      AppError.fromCode("TENANT_CONTEXT_REQUIRED", {
        correlationId: (req as any).id,
        message: "Unable to resolve tenant context",
      }),
    );
  }
};

/**
 * Validates that a resource belongs to the requesting tenant. Use for explicit
 * ownership checks (e.g. vehicles shared across tenants).
 */
export const validateCrossTenantAccess = async (
  req: Request,
  resourceType: string,
  resourceId: string,
): Promise<boolean> => {
  const tenantId = (req as any).tenantId;
  const userId = (req as any).userId;
  const userRoles = (req as any).user?.roles ?? [(req as any).user?.role];

  if (userRoles?.includes("admin")) return true;

  if (resourceType === "vehicle") {
    const Vehicle = mongoose.model("Vehicle");
    const vehicle = await Vehicle.findById(resourceId);
    if (!vehicle) return false;
    if (vehicle.currentOwnerId?.toString() === userId) return true;
    if (tenantId) {
      const authorized = vehicle.authorizedServiceCenters?.some(
        (center: any) => center.serviceCenterId?.toString() === tenantId && center.status === "active",
      );
      if (authorized) return true;
    }
  }
  return false;
};


