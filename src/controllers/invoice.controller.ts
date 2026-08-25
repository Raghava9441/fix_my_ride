import { Request, Response } from "express";
import { ValidatedRequest } from "../middleware/validation.middleware";
import { InvoiceService } from "../services/invoice.service";
import {
  HttpStatus,
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
} from "../utils";

export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  async getAll(req: Request, res: Response) {
    const isAdmin = (req as any).user?.roles?.includes("admin") ?? (req as any).user?.role === "admin";
    const filters = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      // Non-admins only ever see their own invoices, regardless of what
      // accountId they pass — admins can filter by any account.
      accountId: isAdmin ? (req.query.accountId as string) : req.user?.id,
      serviceCenterId: req.query.serviceCenterId as string,
      tenantId: req.query.tenantId as string,
      status: req.query.status as string,
    };
    const result = await this.invoiceService.findAll(filters);

    const response = createPaginatedResponse(
      result.data,
      result.pagination.page,
      result.pagination.limit,
      result.pagination.total,
      "Invoices retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getById(req: Request, res: Response) {
    const { id } = req.params;
    const invoice = await this.invoiceService.findById(id);

    if (!invoice) {
      const error = createErrorResponse("Invoice not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const isAdmin = req.user?.roles?.includes("admin") ?? req.user?.role === "admin";
    if (!isAdmin && String(invoice.accountId?._id ?? invoice.accountId) !== req.user?.id) {
      const error = createErrorResponse("You don't have access to this invoice", HttpStatus.FORBIDDEN);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(invoice, "Invoice retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async create(req: ValidatedRequest<any>, res: Response) {
    const data = req.validated;
    const invoice = await this.invoiceService.create({
      ...data,
      dueDate: new Date(data.dueDate),
    });

    const response = createSuccessResponse(invoice, "Invoice created successfully", HttpStatus.CREATED);
    return res.status(response.statusCode).json(response.toJSON());
  }

  async pay(req: Request, res: Response) {
    const { id } = req.params;

    const existing = await this.invoiceService.findById(id);
    if (!existing) {
      const error = createErrorResponse("Invoice not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }
    const isAdmin = req.user?.roles?.includes("admin") ?? req.user?.role === "admin";
    if (!isAdmin && String(existing.accountId?._id ?? existing.accountId) !== req.user?.id) {
      const error = createErrorResponse("You don't have access to this invoice", HttpStatus.FORBIDDEN);
      return res.status(error.statusCode).json(error.toJSON());
    }

    try {
      const result = await this.invoiceService.createPaymentOrder(id);
      const response = createSuccessResponse(
        result,
        "Payment order created — complete payment against orderId via Razorpay Checkout",
      );
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (error.message === "Invoice not found") {
        const apiError = createErrorResponse(error.message, HttpStatus.NOT_FOUND);
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      if (
        error.message === "Invoice has no amount due" ||
        error.message === "Payment provider is not configured" ||
        error.message === "No billing email on file for this invoice's account"
      ) {
        const apiError = createErrorResponse(error.message, HttpStatus.BAD_REQUEST);
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }

  async markAsSent(req: Request, res: Response) {
    const { id } = req.params;
    try {
      const invoice = await this.invoiceService.markAsSent(id);
      const response = createSuccessResponse(invoice, "Invoice marked as sent");
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (error.message === "Invoice not found") {
        const apiError = createErrorResponse(error.message, HttpStatus.NOT_FOUND);
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }

  async void(req: ValidatedRequest<any>, res: Response) {
    const { id } = req.params;
    const { reason } = req.validated;
    try {
      const invoice = await this.invoiceService.void(id, reason);
      const response = createSuccessResponse(invoice, "Invoice voided successfully");
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (error.message === "Invoice not found") {
        const apiError = createErrorResponse(error.message, HttpStatus.NOT_FOUND);
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }
}
