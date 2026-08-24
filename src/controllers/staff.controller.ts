import { Request, Response } from "express";
import { ValidatedRequest } from "../middleware/validation.middleware";
import {
  StaffProfileService,
  CreateStaffProfileInput,
  UpdateStaffProfileInput,
} from "../services/staff.service";
import { ServiceRecordService } from "../services/serviceRecord.service";
import {
  HttpStatus,
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
} from "../utils";

export class StaffController {
  constructor(
    private readonly staffService: StaffProfileService,
    private readonly serviceRecordService: ServiceRecordService,
  ) {}

  async getAll(req: Request, res: Response) {
    const filters = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      serviceCenterId: req.query.serviceCenterId as string,
      employmentStatus: req.query.employmentStatus as string,
      roleId: req.query.roleId as string,
    };

    const result = await this.staffService.findAll(filters);

    const response = createPaginatedResponse(
      result.data,
      result.pagination.page,
      result.pagination.limit,
      result.pagination.total,
      "Staff retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getById(req: Request, res: Response) {
    const { id } = req.params;

    const staff = await this.staffService.findById(id);

    if (!staff) {
      const error = createErrorResponse(
        "Staff not found",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      staff,
      "Staff retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async create(req: ValidatedRequest<any>, res: Response) {
    const data = req.validated;

    const input: CreateStaffProfileInput = {
      accountId: data.accountId,
      serviceCenterId: data.serviceCenterId,
      roleId: data.roleId,
      employeeId: data.employeeId,
      employmentType: data.employmentType,
      workSchedule: data.workSchedule,
      skills: data.skills,
      specializations: data.specializations,
    };

    try {
      const staff = await this.staffService.create(input);

      const response = createSuccessResponse(
        staff,
        "Staff created successfully",
        HttpStatus.CREATED,
      );
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (error.message === "Staff profile already exists for this account") {
        const apiError = createErrorResponse(
          error.message,
          HttpStatus.CONFLICT,
        );
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      if (
        error.message === "Role not found" ||
        error.message === "Service center not found"
      ) {
        const apiError = createErrorResponse(
          error.message,
          HttpStatus.NOT_FOUND,
        );
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }

  async update(req: ValidatedRequest<any>, res: Response) {
    const { id } = req.params;
    const data = req.validated;

    const input: UpdateStaffProfileInput = {
      roleId: data.roleId,
      employeeId: data.employeeId,
      employmentStatus: data.employmentStatus,
      employmentType: data.employmentType,
      workSchedule: data.workSchedule,
      skills: data.skills,
      specializations: data.specializations,
    };

    try {
      const staff = await this.staffService.update(id, input);

      if (!staff) {
        const error = createErrorResponse(
          "Staff not found",
          HttpStatus.NOT_FOUND,
        );
        return res.status(error.statusCode).json(error.toJSON());
      }

      const response = createSuccessResponse(
        staff,
        "Staff updated successfully",
      );
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (error.message === "Role not found") {
        const apiError = createErrorResponse(
          "Role not found",
          HttpStatus.NOT_FOUND,
        );
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }

  async delete(req: Request, res: Response) {
    const { id } = req.params;

    const staff = await this.staffService.delete(id);

    if (!staff) {
      const error = createErrorResponse(
        "Staff not found",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      {
        id: staff._id,
        deleted: true,
        deletedAt: staff.deletedAt,
      },
      "Staff deleted successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getPermissions(req: Request, res: Response) {
    const { id } = req.params;

    try {
      const permissions = await this.staffService.getPermissions(id);

      const response = createSuccessResponse(
        permissions,
        "Permissions retrieved successfully",
      );
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (error.message === "Staff profile not found") {
        const apiError = createErrorResponse(
          "Staff not found",
          HttpStatus.NOT_FOUND,
        );
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }

  async addPermission(req: ValidatedRequest<any>, res: Response) {
    const { id } = req.params;
    const { permissionId, grantedBy, reason, expiresAt } = req.validated;

    try {
      const staff = await this.staffService.addPermission(
        id,
        permissionId,
        grantedBy,
        reason,
        expiresAt ? new Date(expiresAt) : undefined,
      );

      const response = createSuccessResponse(
        staff,
        "Permission added successfully",
        HttpStatus.CREATED,
      );
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (error.message === "Staff profile not found") {
        const apiError = createErrorResponse(
          "Staff not found",
          HttpStatus.NOT_FOUND,
        );
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      if (error.message === "Permission already granted") {
        const apiError = createErrorResponse(
          error.message,
          HttpStatus.CONFLICT,
        );
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }

  async removePermission(req: Request, res: Response) {
    const { id, permissionId } = req.params;

    try {
      const staff = await this.staffService.removePermission(id, permissionId);

      const response = createSuccessResponse(
        {
          staffId: staff._id,
          permissionId,
          removed: true,
        },
        "Permission removed successfully",
      );
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (error.message === "Staff profile not found") {
        const apiError = createErrorResponse(
          "Staff not found",
          HttpStatus.NOT_FOUND,
        );
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }

  async getSchedule(req: Request, res: Response) {
    const { id } = req.params;

    try {
      const schedule = await this.staffService.getSchedule(id);

      const response = createSuccessResponse(
        schedule,
        "Schedule retrieved successfully",
      );
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (error.message === "Staff profile not found") {
        const apiError = createErrorResponse(
          "Staff not found",
          HttpStatus.NOT_FOUND,
        );
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }

  async updateSchedule(req: ValidatedRequest<any>, res: Response) {
    const { id } = req.params;
    const { workSchedule } = req.validated;

    try {
      const staff = await this.staffService.updateSchedule(id, workSchedule);

      const response = createSuccessResponse(
        staff,
        "Schedule updated successfully",
      );
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (error.message === "Staff profile not found") {
        const apiError = createErrorResponse(
          "Staff not found",
          HttpStatus.NOT_FOUND,
        );
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }

  async getPerformance(req: Request, res: Response) {
    const { id } = req.params;

    try {
      const performance = await this.staffService.getPerformance(id);

      const response = createSuccessResponse(
        performance,
        "Performance retrieved successfully",
      );
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (error.message === "Staff profile not found") {
        const apiError = createErrorResponse(
          "Staff not found",
          HttpStatus.NOT_FOUND,
        );
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }

  async getStaffServices(req: Request, res: Response) {
    const { id } = req.params;

    const records = await this.serviceRecordService.findByTechnician(id);

    const response = createSuccessResponse(
      records,
      "Staff services retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }
}
