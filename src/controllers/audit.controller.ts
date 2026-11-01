import { Request, Response } from "express";
import { AuditLogService } from "../services/audit.service";
import { HttpStatus, createSuccessResponse, createErrorResponse, createPaginatedResponse } from "../utils";

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

/**
 * Query parsing that answers 400 instead of 500.
 *
 * An unparseable date became `Invalid Date` and a non-ObjectId id became a
 * Mongoose CastError - both surfaced as a server error for what is simply a
 * bad request.
 */
function parseDate(value: unknown): Date | undefined | "invalid" {
  if (typeof value !== "string" || value === "") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "invalid" : date;
}

function parseId(value: unknown): string | undefined | "invalid" {
  if (typeof value !== "string" || value === "") return undefined;
  return OBJECT_ID.test(value) ? value : "invalid";
}

export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  private badRequest(res: Response, message: string) {
    const error = createErrorResponse(message, HttpStatus.BAD_REQUEST);
    return res.status(error.statusCode).json(error.toJSON());
  }

  async getAll(req: Request, res: Response) {
    const startDate = parseDate(req.query.fromDate);
    const endDate = parseDate(req.query.toDate);
    if (startDate === "invalid" || endDate === "invalid") {
      return this.badRequest(res, "fromDate and toDate must be valid ISO 8601 dates");
    }
    const tenantId = parseId(req.query.tenantId);
    const actorId = parseId(req.query.actorId);
    const entityId = parseId(req.query.entityId);
    if (tenantId === "invalid" || actorId === "invalid" || entityId === "invalid") {
      return this.badRequest(res, "tenantId, actorId and entityId must be valid ids");
    }

    const filters = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      tenantId,
      actorId,
      entityType: req.query.entityType as string,
      entityId,
      action: req.query.action as string,
      startDate,
      endDate,
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
    if (parseId(entityId) === "invalid") return this.badRequest(res, "entityId must be a valid id");
    const limit = req.query.limit ? Math.min(200, parseInt(req.query.limit as string) || 50) : undefined;

    const logs = await this.auditLogService.findByEntity(entityType, entityId, { limit });
    const response = createSuccessResponse(logs, "Entity audit history retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getByActor(req: Request, res: Response) {
    const { actorId } = req.params;
    const startDate = parseDate(req.query.fromDate);
    const endDate = parseDate(req.query.toDate);
    if (startDate === "invalid" || endDate === "invalid") {
      return this.badRequest(res, "fromDate and toDate must be valid ISO 8601 dates");
    }
    const options = {
      limit: req.query.limit ? Math.min(200, parseInt(req.query.limit as string) || 50) : undefined,
      startDate,
      endDate,
    };

    const logs = await this.auditLogService.findByActor(actorId, options);
    const response = createSuccessResponse(logs, "Actor activity retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getActivitySummary(req: Request, res: Response) {
    const tenantId = parseId(req.query.tenantId);
    const startDate = parseDate(req.query.fromDate);
    const endDate = parseDate(req.query.toDate);
    if (tenantId === "invalid" || startDate === "invalid" || endDate === "invalid") {
      return this.badRequest(res, "tenantId must be a valid id, and fromDate / toDate valid ISO 8601 dates");
    }

    const summary = await this.auditLogService.getActivitySummary(tenantId, startDate, endDate);
    const response = createSuccessResponse(summary, "Activity summary retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }
}
