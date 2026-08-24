import { Request, Response } from "express";
import { ValidatedRequest } from "../middleware/validation.middleware";
import { RoleService, CreateRoleInput, UpdateRoleInput } from "../services/role.service";
import {
  HttpStatus,
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
} from "../utils";

export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  async getAllRoles(req: Request, res: Response) {
    const filters = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      type: req.query.type as string,
      tenantId: req.query.tenantId as string,
      serviceCenterId: req.query.serviceCenterId as string,
      isActive:
        req.query.isActive !== undefined
          ? req.query.isActive === "true"
          : undefined,
    };

    const result = await this.roleService.findAll(filters);

    const response = createPaginatedResponse(
      result.data,
      result.pagination.page,
      result.pagination.limit,
      result.pagination.total,
      "Roles retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getRoleById(req: Request, res: Response) {
    const { id } = req.params;

    const role = await this.roleService.findById(id);

    if (!role) {
      const error = createErrorResponse("Role not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(role, "Role retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async createRole(req: ValidatedRequest<any>, res: Response) {
    const data = req.validated;

    const input: CreateRoleInput = {
      name: data.name,
      slug: data.slug,
      description: data.description,
      type: data.type,
      tenantId: data.tenantId,
      serviceCenterId: data.serviceCenterId,
      level: data.level,
      permissions: data.permissions,
      inheritsFrom: data.inheritsFrom,
      color: data.color,
      icon: data.icon,
      maxUsers: data.maxUsers,
      isDefault: data.isDefault,
    };

    try {
      const role = await this.roleService.create(input);

      const response = createSuccessResponse(
        role,
        "Role created successfully",
        HttpStatus.CREATED,
      );
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (error.message === "Role with this slug already exists") {
        const apiError = createErrorResponse(error.message, HttpStatus.CONFLICT);
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }

  async updateRole(req: ValidatedRequest<any>, res: Response) {
    const { id } = req.params;
    const data = req.validated;

    const role = await this.roleService.update(id, data as UpdateRoleInput);

    if (!role) {
      const error = createErrorResponse("Role not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(role, "Role updated successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async deleteRole(req: Request, res: Response) {
    const { id } = req.params;

    const role = await this.roleService.delete(id);

    if (!role) {
      const error = createErrorResponse("Role not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      {
        id: role._id,
        deactivated: true,
        isActive: role.isActive,
      },
      "Role deactivated successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getRolePermissions(req: Request, res: Response) {
    const { id } = req.params;

    try {
      const permissions = await this.roleService.getPermissions(id);

      const response = createSuccessResponse(
        permissions,
        "Role permissions retrieved successfully",
      );
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (error.message === "Role not found") {
        const apiError = createErrorResponse("Role not found", HttpStatus.NOT_FOUND);
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }

  async addPermissionToRole(req: ValidatedRequest<any>, res: Response) {
    const { id } = req.params;
    const { permissionId } = req.validated;

    try {
      const role = await this.roleService.addPermission(id, permissionId);

      const response = createSuccessResponse(
        role,
        "Permission added to role successfully",
        HttpStatus.CREATED,
      );
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (error.message === "Role not found") {
        const apiError = createErrorResponse("Role not found", HttpStatus.NOT_FOUND);
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      if (error.message?.startsWith("Permission ") && error.message.endsWith(" not found")) {
        const apiError = createErrorResponse(error.message, HttpStatus.NOT_FOUND);
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }

  async removePermissionFromRole(req: Request, res: Response) {
    const { id, permissionId } = req.params;

    try {
      const role = await this.roleService.removePermission(id, permissionId);

      if (!role) {
        const error = createErrorResponse("Role not found", HttpStatus.NOT_FOUND);
        return res.status(error.statusCode).json(error.toJSON());
      }

      const response = createSuccessResponse(
        role,
        "Permission removed from role successfully",
      );
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (error.message === "Role not found") {
        const apiError = createErrorResponse("Role not found", HttpStatus.NOT_FOUND);
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }

  async assignRoleToUser(req: Request, res: Response) {
    const error = createErrorResponse(
      "Assigning a role to a user is not implemented here; use the staff endpoints " +
        "(StaffProfile.roleId, see staff.service.ts) to assign roles to staff members",
      HttpStatus.NOT_IMPLEMENTED,
    );
    return res.status(error.statusCode).json(error.toJSON());
  }

  async removeRoleFromUser(req: Request, res: Response) {
    const error = createErrorResponse(
      "Unassigning a role from a user is not implemented here; use the staff endpoints " +
        "(StaffProfile.roleId, see staff.service.ts) to remove roles from staff members",
      HttpStatus.NOT_IMPLEMENTED,
    );
    return res.status(error.statusCode).json(error.toJSON());
  }

  async seedSystemRoles(req: Request, res: Response) {
    await this.roleService.seedSystemRoles();

    const response = createSuccessResponse(
      null,
      "System roles seeded successfully",
      HttpStatus.CREATED,
    );
    return res.status(response.statusCode).json(response.toJSON());
  }
}
