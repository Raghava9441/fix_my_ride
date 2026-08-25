import { Request, Response } from "express";
import { PaymentService } from "../services/payment.service";
import { HttpStatus, createSuccessResponse, createErrorResponse, createPaginatedResponse } from "../utils";

/**
 * Read-only by design — Payment records are only ever written by the
 * trusted Razorpay webhook flow (billing.service.ts), never by a direct
 * client request. Letting a client POST/PATCH a Payment would let them
 * self-report a fake "completed" payment.
 */
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  async getAll(req: Request, res: Response) {
    const isAdmin = req.user?.roles?.includes("admin") ?? req.user?.role === "admin";
    const filters = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      accountId: isAdmin ? (req.query.accountId as string) : req.user?.id,
      serviceCenterId: req.query.serviceCenterId as string,
      tenantId: req.query.tenantId as string,
      type: req.query.type as string,
      status: req.query.status as string,
      provider: req.query.provider as string,
    };
    const result = await this.paymentService.findAll(filters);

    const response = createPaginatedResponse(
      result.data,
      result.pagination.page,
      result.pagination.limit,
      result.pagination.total,
      "Payments retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getMine(req: Request, res: Response) {
    const payments = await this.paymentService.findByAccount(req.user!.id);
    const response = createSuccessResponse(payments, "Payments retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getById(req: Request, res: Response) {
    const { id } = req.params;
    const payment = await this.paymentService.findById(id);

    if (!payment) {
      const error = createErrorResponse("Payment not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const isAdmin = req.user?.roles?.includes("admin") ?? req.user?.role === "admin";
    if (!isAdmin && String(payment.accountId?._id ?? payment.accountId) !== req.user?.id) {
      const error = createErrorResponse("You don't have access to this payment", HttpStatus.FORBIDDEN);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(payment, "Payment retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getStats(req: Request, res: Response) {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    const stats = await this.paymentService.getPaymentStats(req.user!.id, startDate, endDate);

    const response = createSuccessResponse(stats, "Payment stats retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }
}
