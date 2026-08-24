import { Request, Response } from "express";
import { AuditLogService } from "../services/audit.service";
import { HttpStatus, createSuccessResponse, createErrorResponse, createPaginatedResponse } from "../utils";

export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  async getAll(req: Request, res: Response) {
    const filters = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      tenantId: req.query.tenantId as string,
      actorId: req.query.actorId as string,
      entityType: req.query.entityType as string,
      entityId: req.query.entityId as string,
      action: req.query.action as string,
      startDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
      endDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
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

  async getById(req: Request, res: Response) {
    const { id } = req.params;
    const log = await this.auditLogService.findById(id);

    if (!log) {
      const error = createErrorResponse("Audit log entry not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(log, "Audit log entry retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getByEntity(req: Request, res: Response) {
    const { entityType, entityId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

    const logs = await this.auditLogService.findByEntity(entityType, entityId, { limit });
    const response = createSuccessResponse(logs, "Entity audit history retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getByActor(req: Request, res: Response) {
    const { actorId } = req.params;
    const options = {
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      startDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
      endDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
    };

    const logs = await this.auditLogService.findByActor(actorId, options);
    const response = createSuccessResponse(logs, "Actor activity retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getActivitySummary(req: Request, res: Response) {
    const tenantId = req.query.tenantId as string | undefined;
    const startDate = req.query.fromDate ? new Date(req.query.fromDate as string) : undefined;
    const endDate = req.query.toDate ? new Date(req.query.toDate as string) : undefined;

    const summary = await this.auditLogService.getActivitySummary(tenantId, startDate, endDate);
    const response = createSuccessResponse(summary, "Activity summary retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }
}
