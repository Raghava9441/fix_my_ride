import { Response } from "express";
import { ValidatedRequest } from "../middleware/validation.middleware";
import { TenantService } from "../services/tenant.service";
import { HttpStatus, createSuccessResponse, createErrorResponse } from "../utils";

/**
 * Tenant self-service — a tenant's own owner managing their organization's
 * settings, always scoped to the caller's own req.user.tenantId (never a
 * client-supplied id). Platform-wide tenant management for ALL tenants
 * stays under /api/v1/admin/tenants (see admin.controller.ts).
 */
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  async getMine(req: ValidatedRequest<any>, res: Response) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      const error = createErrorResponse(
        "Your account isn't associated with a tenant",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const tenant = await this.tenantService.findById(tenantId);
    if (!tenant) {
      const error = createErrorResponse("Tenant not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(tenant, "Tenant retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async updateMine(req: ValidatedRequest<any>, res: Response) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      const error = createErrorResponse(
        "Your account isn't associated with a tenant",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const tenant = await this.tenantService.update(tenantId, req.validated);
    if (!tenant) {
      const error = createErrorResponse("Tenant not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(tenant, "Tenant updated successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }
}
