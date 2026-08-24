import { Request, Response } from "express";
import { ValidatedRequest } from "../middleware/validation.middleware";
import {
  PermissionService,
  CreatePermissionInput,
  UpdatePermissionInput,
} from "../services/permission.service";
import {
  HttpStatus,
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
} from "../utils";

export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  async getAllPermissions(req: Request, res: Response) {
    const filters = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      resource: req.query.resource as string,
      action: req.query.action as string,
      scope: req.query.scope as string,
      isActive:
        req.query.isActive !== undefined
          ? req.query.isActive === "true"
          : undefined,
    };

    const result = await this.permissionService.findAll(filters);

    const response = createPaginatedResponse(
      result.data,
      result.pagination.page,
      result.pagination.limit,
      result.pagination.total,
      "Permissions retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getPermissionById(req: Request, res: Response) {
    const { id } = req.params;

    const permission = await this.permissionService.findById(id);

    if (!permission) {
      const error = createErrorResponse(
        "Permission not found",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      permission,
      "Permission retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async createPermission(req: ValidatedRequest<any>, res: Response) {
    const data = req.validated;

    const input: CreatePermissionInput = {
      key: data.key,
      name: data.name,
      description: data.description,
      resource: data.resource,
      action: data.action,
      scope: data.scope,
      category: data.category,
      requiredPlan: data.requiredPlan,
    };

    try {
      const permission = await this.permissionService.create(input);

      const response = createSuccessResponse(
        permission,
        "Permission created successfully",
        HttpStatus.CREATED,
      );
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (error.message === "Permission key already exists") {
        const apiError = createErrorResponse(
          "Permission key already exists",
          HttpStatus.CONFLICT,
        );
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }

  async updatePermission(req: ValidatedRequest<any>, res: Response) {
    const { id } = req.params;
    const data = req.validated;

    const permission = await this.permissionService.update(
      id,
      data as UpdatePermissionInput,
    );

    if (!permission) {
      const error = createErrorResponse(
        "Permission not found",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      permission,
      "Permission updated successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async deletePermission(req: Request, res: Response) {
    const { id } = req.params;

    const permission = await this.permissionService.delete(id);

    if (!permission) {
      const error = createErrorResponse(
        "Permission not found",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      {
        id: permission._id,
        isActive: permission.isActive,
      },
      "Permission deactivated successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async seedDefaultPermissions(req: Request, res: Response) {
    await this.permissionService.seedDefaults();

    const response = createSuccessResponse(
      { seeded: true },
      "Default permissions seeded successfully",
      HttpStatus.CREATED,
    );
    return res.status(response.statusCode).json(response.toJSON());
  }
}
