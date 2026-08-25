import { Request, Response } from "express";
import { ValidatedRequest } from "../middleware/validation.middleware";
import { SubscriptionPlanService } from "../services/subscriptionPlan.service";
import {
  HttpStatus,
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
} from "../utils";

export class SubscriptionPlanController {
  constructor(private readonly subscriptionPlanService: SubscriptionPlanService) {}

  async getAll(req: Request, res: Response) {
    const filters = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      type: req.query.type as string,
      isActive: req.query.isActive !== undefined ? req.query.isActive === "true" : undefined,
      isPublic: req.query.isPublic !== undefined ? req.query.isPublic === "true" : undefined,
    };
    const result = await this.subscriptionPlanService.findAll(filters);

    const response = createPaginatedResponse(
      result.data,
      result.pagination.page,
      result.pagination.limit,
      result.pagination.total,
      "Subscription plans retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getPublic(req: Request, res: Response) {
    const plans = await this.subscriptionPlanService.findPublic();
    const response = createSuccessResponse(plans, "Public subscription plans retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getById(req: Request, res: Response) {
    const { id } = req.params;
    const plan = await this.subscriptionPlanService.findById(id);

    if (!plan) {
      const error = createErrorResponse("Subscription plan not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(plan, "Subscription plan retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getBySlug(req: Request, res: Response) {
    const { slug } = req.params;
    const plan = await this.subscriptionPlanService.findBySlug(slug);

    if (!plan) {
      const error = createErrorResponse("Subscription plan not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(plan, "Subscription plan retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async create(req: ValidatedRequest<any>, res: Response) {
    try {
      const plan = await this.subscriptionPlanService.create(req.validated);
      const response = createSuccessResponse(
        plan,
        "Subscription plan created successfully",
        HttpStatus.CREATED,
      );
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (error.message === "Plan with this slug already exists") {
        const apiError = createErrorResponse(error.message, HttpStatus.CONFLICT);
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }

  async update(req: ValidatedRequest<any>, res: Response) {
    const { id } = req.params;
    const plan = await this.subscriptionPlanService.update(id, req.validated);

    if (!plan) {
      const error = createErrorResponse("Subscription plan not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(plan, "Subscription plan updated successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async delete(req: Request, res: Response) {
    const { id } = req.params;
    const plan = await this.subscriptionPlanService.delete(id);

    if (!plan) {
      const error = createErrorResponse("Subscription plan not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      { id: plan._id, deleted: true },
      "Subscription plan deleted successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async compare(req: Request, res: Response) {
    const ids = (req.query.ids as string)?.split(",").filter(Boolean) ?? [];
    if (ids.length === 0) {
      const error = createErrorResponse(
        "Query param 'ids' (comma-separated plan ids) is required",
        HttpStatus.BAD_REQUEST,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const plans = await this.subscriptionPlanService.comparePlans(ids);
    const response = createSuccessResponse(plans, "Plan comparison retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }
}
