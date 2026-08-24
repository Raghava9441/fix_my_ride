import { Request, Response } from "express";
import { ValidatedRequest } from "../middleware/validation.middleware";
import {
  OwnerProfileService,
  UpdateOwnerProfileInput,
} from "../services/owner.service";
import { notificationService } from "../services/notification.service";
import {
  HttpStatus,
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
} from "../utils";

export class OwnerController {
  constructor(private readonly ownerService: OwnerProfileService) {}

  async getAll(req: Request, res: Response) {
    const filters = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
    };

    const result = await this.ownerService.findAll(filters);

    const response = createPaginatedResponse(
      result.data,
      result.pagination.page,
      result.pagination.limit,
      result.pagination.total,
      "Owners retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getById(req: Request, res: Response) {
    const { id } = req.params;

    const owner = await this.ownerService.findById(id);

    if (!owner) {
      const error = createErrorResponse("Owner not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      owner,
      "Owner retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async update(req: ValidatedRequest<any>, res: Response) {
    const { id } = req.params;
    const data = req.validated as UpdateOwnerProfileInput;

    const owner = await this.ownerService.update(id, data);

    if (!owner) {
      const error = createErrorResponse("Owner not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      owner,
      "Owner updated successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async delete(req: Request, res: Response) {
    const { id } = req.params;

    const owner = await this.ownerService.delete(id);

    if (!owner) {
      const error = createErrorResponse("Owner not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      {
        id: owner._id,
        deleted: true,
        deletedAt: owner.deletedAt,
      },
      "Owner deleted successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getVehicles(req: Request, res: Response) {
    const { id } = req.params;

    try {
      const vehicles = await this.ownerService.getVehicles(id);

      const response = createSuccessResponse(
        vehicles,
        "Vehicles retrieved successfully",
      );
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (error.message === "Owner profile not found") {
        const apiError = createErrorResponse(
          "Owner not found",
          HttpStatus.NOT_FOUND,
        );
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }

  async addVehicle(req: ValidatedRequest<any>, res: Response) {
    const { id } = req.params;
    const { vehicleId, isPrimary } = req.validated;

    try {
      const owner = await this.ownerService.addVehicle(
        id,
        vehicleId,
        isPrimary ?? false,
      );

      const response = createSuccessResponse(
        owner,
        "Vehicle added successfully",
        HttpStatus.CREATED,
      );
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (error.message === "Owner profile not found") {
        const apiError = createErrorResponse(
          "Owner not found",
          HttpStatus.NOT_FOUND,
        );
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      if (error.message === "Vehicle already added to this owner") {
        const apiError = createErrorResponse(
          error.message,
          HttpStatus.CONFLICT,
        );
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }

  async getServiceHistory(req: Request, res: Response) {
    const { id } = req.params;
    const filters = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
    };

    const result = await this.ownerService.getServiceHistory(id, filters);

    const response = createPaginatedResponse(
      result.data,
      result.pagination.page,
      result.pagination.limit,
      result.pagination.total,
      "Service history retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getExpenses(req: Request, res: Response) {
    const { id } = req.params;

    const expenses = await this.ownerService.getExpenses(id);

    const response = createSuccessResponse(
      expenses,
      "Expenses retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getNotifications(req: Request, res: Response) {
    const { id } = req.params;

    const owner = await this.ownerService.findById(id);

    if (!owner) {
      const error = createErrorResponse("Owner not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const page = parseInt(req.query.page as string) || undefined;
    const limit = req.query.limit
      ? parseInt(req.query.limit as string)
      : undefined;

    const options = {
      limit,
      skip: page && limit ? (page - 1) * limit : undefined,
      status: req.query.status as string | undefined,
      type: req.query.type as string | undefined,
      channel: req.query.channel as string | undefined,
      unreadOnly: req.query.unreadOnly === "true",
    };

    const notifications = await notificationService.findByRecipient(
      owner.accountId.toString(),
      "Account",
      options,
    );

    const response = createSuccessResponse(
      notifications,
      "Notifications retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async markNotificationRead(req: Request, res: Response) {
    const { notificationId } = req.params;

    try {
      const notification = await notificationService.markAsRead(
        notificationId,
      );

      const response = createSuccessResponse(
        notification,
        "Notification marked as read",
      );
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (error.message === "Notification not found") {
        const apiError = createErrorResponse(
          "Notification not found",
          HttpStatus.NOT_FOUND,
        );
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }

  async deleteNotifications(req: Request, res: Response) {
    const error = createErrorResponse(
      "Bulk notification deletion is not implemented yet",
      HttpStatus.NOT_IMPLEMENTED,
    );
    return res.status(error.statusCode).json(error.toJSON());
  }

  async getPreferences(req: Request, res: Response) {
    const { id } = req.params;

    const owner = await this.ownerService.findById(id);

    if (!owner) {
      const error = createErrorResponse("Owner not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      owner.notificationPreferences,
      "Preferences retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async updatePreferences(req: ValidatedRequest<any>, res: Response) {
    const { id } = req.params;
    const notificationPreferences = req.validated;

    const owner = await this.ownerService.update(id, {
      notificationPreferences,
    });

    if (!owner) {
      const error = createErrorResponse("Owner not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      owner.notificationPreferences,
      "Preferences updated successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }
}
