import { Request, Response } from "express";
import { AdminService } from "../services/admin.service";
import { TenantService } from "../services/tenant.service";
import { AccountService } from "../services/account.service";
import { AuditLogService } from "../services/audit.service";
import { cacheDelPattern } from "../config/redis";
import {
  HttpStatus,
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
} from "../utils";

export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly tenantService: TenantService,
    private readonly accountService: AccountService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async getDashboard(req: Request, res: Response) {
    const stats = await this.adminService.getDashboard();
    const response = createSuccessResponse(stats, "Dashboard data retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getSystemStats(req: Request, res: Response) {
    const stats = this.adminService.getSystemStats();
    const response = createSuccessResponse(stats, "System stats retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getAllTenants(req: Request, res: Response) {
    const filters = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
    };
    const result = await this.tenantService.findAll(filters);

    const response = createPaginatedResponse(
      result.data,
      result.pagination.page,
      result.pagination.limit,
      result.pagination.total,
      "Tenants retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async createTenant(req: Request, res: Response) {
    const tenant = await this.tenantService.create(req.body);
    const response = createSuccessResponse(
      tenant,
      "Tenant created successfully",
      HttpStatus.CREATED,
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getTenantById(req: Request, res: Response) {
    const { id } = req.params;
    const tenant = await this.tenantService.findById(id);

    if (!tenant) {
      const error = createErrorResponse("Tenant not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(tenant, "Tenant retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async updateTenant(req: Request, res: Response) {
    const { id } = req.params;
    const tenant = await this.tenantService.update(id, req.body);

    if (!tenant) {
      const error = createErrorResponse("Tenant not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(tenant, "Tenant updated successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async deleteTenant(req: Request, res: Response) {
    const { id } = req.params;
    const tenant = await this.tenantService.delete(id);

    if (!tenant) {
      const error = createErrorResponse("Tenant not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      { id: tenant._id, deleted: true },
      "Tenant deleted successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async updateTenantStatus(req: Request, res: Response) {
    const { id } = req.params;
    const { isActive } = req.body;
    const tenant = await this.tenantService.update(id, { isActive } as any);

    if (!tenant) {
      const error = createErrorResponse("Tenant not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      { id: tenant._id, isActive: tenant.isActive },
      "Tenant status updated successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getAllUsers(req: Request, res: Response) {
    const filters = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      status: req.query.status as string,
      tenantId: req.query.tenantId as string,
    };
    const result = await this.accountService.findAll(filters);

    const response = createPaginatedResponse(
      result.data,
      result.pagination.page,
      result.pagination.limit,
      result.pagination.total,
      "Users retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async suspendUser(req: Request, res: Response) {
    const { id } = req.params;
    const account = await this.accountService.updateStatus(
      id,
      "suspended",
      req.body?.reason,
    );

    if (!account) {
      const error = createErrorResponse("User not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      { id: account._id, status: account.status },
      "User suspended successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async activateUser(req: Request, res: Response) {
    const { id } = req.params;
    const account = await this.accountService.updateStatus(id, "active");

    if (!account) {
      const error = createErrorResponse("User not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      { id: account._id, status: account.status },
      "User activated successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getSystemHealth(req: Request, res: Response) {
    const health = await this.adminService.getSystemHealth();
    const response = createSuccessResponse(health, "System health retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getSystemLogs(req: Request, res: Response) {
    const error = createErrorResponse(
      "Not implemented — no queryable log store exists yet (winston logs to file/console only, see docs/logging.md)",
      HttpStatus.NOT_IMPLEMENTED,
    );
    return res.status(error.statusCode).json(error.toJSON());
  }

  async getSystemMetrics(req: Request, res: Response) {
    const error = createErrorResponse(
      "Not implemented — no request/latency metrics collector is wired up yet",
      HttpStatus.NOT_IMPLEMENTED,
    );
    return res.status(error.statusCode).json(error.toJSON());
  }

  async clearCache(req: Request, res: Response) {
    const pattern = (req.body?.pattern as string) || "*";
    await cacheDelPattern(pattern);

    const response = createSuccessResponse({ pattern }, "Cache cleared successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async reindexSearch(req: Request, res: Response) {
    const error = createErrorResponse(
      "Not implemented — no search index (Elasticsearch/Algolia/etc.) exists in this codebase",
      HttpStatus.NOT_IMPLEMENTED,
    );
    return res.status(error.statusCode).json(error.toJSON());
  }

  async createBackup(req: Request, res: Response) {
    const error = createErrorResponse(
      "Not implemented — no backup mechanism (e.g. mongodump automation) exists in this codebase",
      HttpStatus.NOT_IMPLEMENTED,
    );
    return res.status(error.statusCode).json(error.toJSON());
  }

  async getAuditLogs(req: Request, res: Response) {
    const filters = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      tenantId: req.query.tenantId as string,
      actorId: req.query.actorId as string,
      entityType: req.query.entityType as string,
      action: req.query.action as string,
    };
    const result = await this.auditLogService.findAll(filters);

    const response = createPaginatedResponse(
      result.data,
      result.pagination.page,
      result.pagination.limit,
      result.pagination.total,
      "Audit logs retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }
}
