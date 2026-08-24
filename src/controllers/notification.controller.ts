import { Request, Response } from "express";
import { NotificationService } from "../services/notification.service";
import {
  HttpStatus,
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
} from "../utils";

const RECIPIENT_MODEL = "Account";

export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  async getMine(req: Request, res: Response) {
    const filters = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      recipientId: req.user!.id,
      recipientModel: RECIPIENT_MODEL,
      channel: req.query.channel as string,
      type: req.query.type as string,
      status: req.query.status as string,
      unreadOnly: req.query.unreadOnly === "true",
    };

    const result = await this.notificationService.findAll(filters);

    const response = createPaginatedResponse(
      result.data,
      result.pagination.page,
      result.pagination.limit,
      result.pagination.total,
      "Notifications retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getUnread(req: Request, res: Response) {
    const notifications = await this.notificationService.findUnread(
      req.user!.id,
      RECIPIENT_MODEL,
    );

    const response = createSuccessResponse(
      notifications,
      "Unread notifications retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getStats(req: Request, res: Response) {
    const stats = await this.notificationService.getStats(req.user!.id, RECIPIENT_MODEL);

    const response = createSuccessResponse(stats, "Notification stats retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getById(req: Request, res: Response) {
    const { id } = req.params;
    const notification = await this.notificationService.findById(id);

    if (!notification || !this.belongsToRequester(notification, req)) {
      const error = createErrorResponse("Notification not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(notification, "Notification retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async markAsRead(req: Request, res: Response) {
    const { id } = req.params;
    const existing = await this.notificationService.findById(id);

    if (!existing || !this.belongsToRequester(existing, req)) {
      const error = createErrorResponse("Notification not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const notification = await this.notificationService.markAsRead(id);
    const response = createSuccessResponse(notification, "Notification marked as read");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async markAsClicked(req: Request, res: Response) {
    const { id } = req.params;
    const existing = await this.notificationService.findById(id);

    if (!existing || !this.belongsToRequester(existing, req)) {
      const error = createErrorResponse("Notification not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const notification = await this.notificationService.markAsClicked(id);
    const response = createSuccessResponse(notification, "Notification marked as clicked");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async markAllAsRead(req: Request, res: Response) {
    const result = await this.notificationService.markAllAsRead(req.user!.id, RECIPIENT_MODEL);

    const response = createSuccessResponse(
      { matched: result.matchedCount ?? 0, modified: result.modifiedCount ?? 0 },
      "All notifications marked as read",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async delete(req: Request, res: Response) {
    const { id } = req.params;
    const existing = await this.notificationService.findById(id);

    if (!existing || !this.belongsToRequester(existing, req)) {
      const error = createErrorResponse("Notification not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const notification = await this.notificationService.delete(id);
    const response = createSuccessResponse(
      { id: notification._id, deleted: true },
      "Notification deleted successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  private belongsToRequester(notification: any, req: Request): boolean {
    if (req.user?.roles?.includes("admin")) return true;
    return (
      notification.recipientId?.toString() === req.user?.id &&
      notification.recipientModel === RECIPIENT_MODEL
    );
  }
}
