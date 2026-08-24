import { Request, Response } from "express";
import { ValidatedRequest } from "../middleware/validation.middleware";
import {
  ReminderService,
  CreateReminderInput,
  UpdateReminderInput,
} from "../services/reminder.service";
import {
  HttpStatus,
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
} from "../utils";

export class ReminderController {
  constructor(private readonly reminderService: ReminderService) {}

  async getAllReminders(req: Request, res: Response) {
    const filters = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      ownerId: req.query.ownerId as string,
      vehicleId: req.query.vehicleId as string,
      staffId: req.query.staffId as string,
      status: req.query.status as string,
      type: req.query.type as string,
      priority: req.query.priority as string,
    };

    const result = await this.reminderService.findAll(filters);

    const response = createPaginatedResponse(
      result.data,
      result.pagination.page,
      result.pagination.limit,
      result.pagination.total,
      "Reminders retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getUpcomingReminders(req: Request, res: Response) {
    const ownerId = req.query.ownerId as string;
    if (!ownerId) {
      const error = createErrorResponse(
        "ownerId query parameter is required",
        HttpStatus.BAD_REQUEST,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const days = req.query.days ? parseInt(req.query.days as string) : undefined;
    const reminders = await this.reminderService.findUpcoming(ownerId, days);

    const response = createSuccessResponse(
      reminders,
      "Upcoming reminders retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getOverdueReminders(req: Request, res: Response) {
    const ownerId = req.query.ownerId as string | undefined;
    const reminders = await this.reminderService.findOverdue(ownerId);

    const response = createSuccessResponse(
      reminders,
      "Overdue reminders retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getReminderById(req: Request, res: Response) {
    const { id } = req.params;
    const reminder = await this.reminderService.findById(id);

    if (!reminder) {
      const error = createErrorResponse("Reminder not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(reminder, "Reminder retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async createReminder(req: ValidatedRequest<any>, res: Response) {
    const data = req.validated as CreateReminderInput;
    const reminder = await this.reminderService.create({
      ...data,
      createdBy: req.user?.id,
    });

    const response = createSuccessResponse(
      reminder,
      "Reminder created successfully",
      HttpStatus.CREATED,
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async updateReminder(req: ValidatedRequest<any>, res: Response) {
    const { id } = req.params;
    const data = req.validated as UpdateReminderInput;

    const reminder = await this.reminderService.update(id, data);
    if (!reminder) {
      const error = createErrorResponse("Reminder not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(reminder, "Reminder updated successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async deleteReminder(req: Request, res: Response) {
    const { id } = req.params;
    const reminder = await this.reminderService.delete(id);

    if (!reminder) {
      const error = createErrorResponse("Reminder not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      { id: reminder._id, deleted: true },
      "Reminder deleted successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async acknowledgeReminder(req: Request, res: Response) {
    const { id } = req.params;
    try {
      const reminder = await this.reminderService.acknowledge(id);
      const response = createSuccessResponse(reminder, "Reminder acknowledged successfully");
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (error.message === "Reminder not found") {
        const apiError = createErrorResponse(error.message, HttpStatus.NOT_FOUND);
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }

  async snoozeReminder(req: ValidatedRequest<any>, res: Response) {
    const { id } = req.params;
    const { until } = req.validated as { until: string };
    try {
      const reminder = await this.reminderService.snooze(id, until);
      const response = createSuccessResponse(reminder, "Reminder snoozed successfully");
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (error.message === "Reminder not found") {
        const apiError = createErrorResponse(error.message, HttpStatus.NOT_FOUND);
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }

  async completeReminder(req: Request, res: Response) {
    const { id } = req.params;
    try {
      const reminder = await this.reminderService.complete(id);
      const response = createSuccessResponse(reminder, "Reminder completed successfully");
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (error.message === "Reminder not found") {
        const apiError = createErrorResponse(error.message, HttpStatus.NOT_FOUND);
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }

  async cancelReminder(req: Request, res: Response) {
    const { id } = req.params;
    try {
      const reminder = await this.reminderService.cancel(id);
      const response = createSuccessResponse(reminder, "Reminder cancelled successfully");
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (error.message === "Reminder not found") {
        const apiError = createErrorResponse(error.message, HttpStatus.NOT_FOUND);
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }

  async bulkAcknowledge(req: ValidatedRequest<any>, res: Response) {
    const { ids } = req.validated as { ids: string[] };
    const result = await this.reminderService.bulkAcknowledge(ids);

    const response = createSuccessResponse(result, "Reminders acknowledged successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async bulkCancel(req: ValidatedRequest<any>, res: Response) {
    const { ids } = req.validated as { ids: string[] };
    const result = await this.reminderService.bulkCancel(ids);

    const response = createSuccessResponse(result, "Reminders cancelled successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }
}
