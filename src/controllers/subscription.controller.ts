import { Response } from "express";
import { ValidatedRequest } from "../middleware/validation.middleware";
import { SubscriptionService } from "../services/subscription.service";
import { HttpStatus, createSuccessResponse, createErrorResponse } from "../utils";

/**
 * Tenant-scoped subscription management — always operates against the
 * caller's own req.user.tenantId, never a client-supplied tenant id.
 */
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  async getMine(req: ValidatedRequest<any>, res: Response) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      const error = createErrorResponse(
        "Your account isn't associated with a tenant",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const subscription = await this.subscriptionService.findActiveForTenant(tenantId);
    if (!subscription) {
      const error = createErrorResponse("No active subscription found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(subscription, "Subscription retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async subscribe(req: ValidatedRequest<any>, res: Response) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      const error = createErrorResponse(
        "Your account isn't associated with a tenant",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const { planId, serviceCenterId } = req.validated;

    try {
      const result = await this.subscriptionService.createFromPlan({
        tenantId,
        serviceCenterId,
        planId,
      });

      const response = createSuccessResponse(
        result,
        result.checkoutUrl
          ? "Subscription created — complete authorization to activate it"
          : "Subscription activated successfully",
        HttpStatus.CREATED,
      );
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (error.message === "Subscription plan not found") {
        const apiError = createErrorResponse(error.message, HttpStatus.NOT_FOUND);
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      if (
        error.message === "Tenant already has an active subscription" ||
        error.message === "This plan isn't registered with the payment provider yet" ||
        error.message === "Payment provider is not configured"
      ) {
        const apiError = createErrorResponse(error.message, HttpStatus.BAD_REQUEST);
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }

  async cancel(req: ValidatedRequest<any>, res: Response) {
    const { id } = req.params;
    const { reason, immediate } = req.validated;
    const isAdmin = req.user?.roles?.includes("admin") ?? req.user?.role === "admin";

    const existing = await this.subscriptionService.findById(id);
    if (!existing) {
      const error = createErrorResponse("Subscription not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }
    if (!isAdmin && String(existing.tenantId) !== String(req.user?.tenantId)) {
      const error = createErrorResponse(
        "You don't have access to this subscription",
        HttpStatus.FORBIDDEN,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    try {
      const subscription = await this.subscriptionService.cancel(id, reason, immediate);
      const response = createSuccessResponse(
        subscription,
        immediate
          ? "Subscription cancelled immediately"
          : "Subscription will cancel at the end of the current billing period",
      );
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (error.message === "Subscription not found") {
        const apiError = createErrorResponse(error.message, HttpStatus.NOT_FOUND);
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }
}
