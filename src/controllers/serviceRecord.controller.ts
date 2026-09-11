import { Request, Response } from "express";
import { ValidatedRequest } from "../middleware/validation.middleware";
import {
  ServiceRecordService,
  CreateServiceRecordInput,
  UpdateServiceRecordInput,
} from "../services/serviceRecord.service";
import { InvoiceService } from "../services/invoice.service";
import { VehicleService } from "../services/vehicle.service";
import { StaffProfileService } from "../services/staff.service";
import {
  HttpStatus,
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
} from "../utils";

export class ServiceRecordController {
  constructor(
    private readonly serviceRecordService: ServiceRecordService,
    private readonly invoiceService: InvoiceService,
    // Both used only to resolve fields the client can't be expected to know.
    private readonly vehicleService: VehicleService,
    private readonly staffProfileService: StaffProfileService,
  ) {}

  /** Loads a record or writes a 404 and returns null. */
  private async loadOr404(id: string, res: Response) {
    const record = await this.serviceRecordService.findById(id);
    if (!record) {
      const error = createErrorResponse("Service record not found", HttpStatus.NOT_FOUND);
      res.status(error.statusCode).json(error.toJSON());
      return null;
    }
    return record;
  }

  async getAll(req: Request, res: Response) {
    const filters = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      tenantId: req.query.tenantId as string,
      vehicleId: req.query.vehicleId as string,
      serviceCenterId: req.query.serviceCenterId as string,
      ownerId: req.query.ownerId as string,
      technicianId: req.query.technicianId as string,
      serviceType: req.query.serviceType as string,
      status: req.query.status as string,
      startDate: req.query.startDate
        ? new Date(req.query.startDate as string)
        : undefined,
      endDate: req.query.endDate
        ? new Date(req.query.endDate as string)
        : undefined,
    };

    const result = await this.serviceRecordService.findAll(filters);

    const response = createPaginatedResponse(
      result.data,
      result.pagination.page,
      result.pagination.limit,
      result.pagination.total,
      "Service records retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getById(req: Request, res: Response) {
    const { id } = req.params;

    const record = await this.serviceRecordService.findById(id);

    if (!record) {
      const error = createErrorResponse(
        "Service record not found",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      record,
      "Service record retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async create(req: ValidatedRequest<any>, res: Response) {
    const data = req.validated;

    /*
     * Resolve the service centre, which the client can't know.
     *
     * The vehicle is loaded here (the service loads it again) because the
     * centre fallback below needs its authorised-centre list. The owner is
     * *not* resolved here — `serviceRecordService.create` already derives it
     * from the vehicle, and duplicating that would give two places to change.
     */
    const vehicle = await this.vehicleService.findById(data.vehicleId);
    if (!vehicle) {
      const error = createErrorResponse("Vehicle not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    let serviceCenterId = data.serviceCenterId;
    if (!serviceCenterId) {
      const staff = await this.staffProfileService.findByAccountId(req.user!.id);
      serviceCenterId = staff?.serviceCenterId?.toString();
    }
    if (!serviceCenterId) {
      // Fall back to the vehicle's primary authorised centre, which is the
      // right answer when an owner books their own service.
      const centers = vehicle.authorizedServiceCenters ?? [];
      const primary =
        centers.find((c: any) => c.isPrimary && c.status === "active") ??
        centers.find((c: any) => c.status === "active");
      serviceCenterId = primary?.serviceCenterId?.toString();
    }

    if (!serviceCenterId) {
      const error = createErrorResponse(
        "serviceCenterId is required (pass it explicitly, or authorise a service center on this vehicle first)",
        HttpStatus.BAD_REQUEST,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const input: CreateServiceRecordInput = {
      tenantId: data.tenantId,
      vehicleId: data.vehicleId,
      serviceCenterId,
      // Taken from the session, never the request body.
      createdBy: {
        accountId: req.user!.id,
        role: req.user?.roles?.includes("staff") ? "staff" : "owner",
      },
      technicianId: data.technicianId,
      serviceDate: data.serviceDate ? new Date(data.serviceDate) : undefined,
      serviceType: data.serviceType,
      odometerReading: data.odometerReading,
      description: data.description,
      cost: data.cost,
      partsReplaced: data.partsReplaced,
      nextService: data.nextService
        ? {
            recommendedDate: data.nextService.recommendedDate
              ? new Date(data.nextService.recommendedDate)
              : undefined,
            recommendedOdometer: data.nextService.recommendedOdometer,
            serviceType: data.nextService.serviceType,
          }
        : undefined,
      status: data.status,
    };

    try {
      const record = await this.serviceRecordService.create(input);

      const response = createSuccessResponse(
        record,
        "Service record created successfully",
        HttpStatus.CREATED,
      );
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (
        error.message === "Vehicle not found" ||
        error.message === "Service center not found" ||
        error.message === "Owner not found"
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

    const updates: UpdateServiceRecordInput = {
      serviceDate: data.serviceDate ? new Date(data.serviceDate) : undefined,
      serviceType: data.serviceType,
      odometerReading: data.odometerReading,
      description: data.description,
      cost: data.cost,
      status: data.status,
    };

    const record = await this.serviceRecordService.update(id, updates);

    if (!record) {
      const error = createErrorResponse(
        "Service record not found",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      record,
      "Service record updated successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async delete(req: Request, res: Response) {
    const { id } = req.params;

    const record = await this.serviceRecordService.delete(id);

    if (!record) {
      const error = createErrorResponse(
        "Service record not found",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      {
        id: record._id,
        deleted: true,
        deletedAt: record.deletedAt,
      },
      "Service record deleted successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getParts(req: Request, res: Response) {
    const { id } = req.params;

    const record = await this.serviceRecordService.findById(id);

    if (!record) {
      const error = createErrorResponse(
        "Service record not found",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      record.partsReplaced,
      "Parts retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async addPart(req: ValidatedRequest<any>, res: Response) {
    const { id } = req.params;
    const data = req.validated;

    const record = await this.serviceRecordService.findById(id);

    if (!record) {
      const error = createErrorResponse(
        "Service record not found",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const partsReplaced = [
      ...record.partsReplaced.toObject(),
      {
        partName: data.partName,
        partNumber: data.partNumber,
        quantity: data.quantity,
        unitCost: data.unitCost,
        totalCost: data.totalCost,
        warrantyMonths: data.warrantyMonths,
      },
    ];

    const updated = await this.serviceRecordService.update(id, {
      partsReplaced,
    });

    const newPart = updated.partsReplaced[updated.partsReplaced.length - 1];

    const response = createSuccessResponse(
      newPart,
      "Part added successfully",
      HttpStatus.CREATED,
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async updatePart(req: ValidatedRequest<any>, res: Response) {
    const { id, partId } = req.params;
    const data = req.validated;

    const record = await this.serviceRecordService.findById(id);

    if (!record) {
      const error = createErrorResponse(
        "Service record not found",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const parts = record.partsReplaced.toObject();
    const index = parts.findIndex((p: any) => String(p._id) === partId);

    if (index === -1) {
      const error = createErrorResponse("Part not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    parts[index] = { ...parts[index], ...data };

    const updated = await this.serviceRecordService.update(id, {
      partsReplaced: parts,
    });

    const updatedPart = updated.partsReplaced.find(
      (p: any) => String(p._id) === partId,
    );

    const response = createSuccessResponse(
      updatedPart,
      "Part updated successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async removePart(req: Request, res: Response) {
    const { id, partId } = req.params;

    const record = await this.serviceRecordService.findById(id);

    if (!record) {
      const error = createErrorResponse(
        "Service record not found",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const parts = record.partsReplaced.toObject();
    const exists = parts.some((p: any) => String(p._id) === partId);

    if (!exists) {
      const error = createErrorResponse("Part not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const partsReplaced = parts.filter((p: any) => String(p._id) !== partId);

    await this.serviceRecordService.update(id, { partsReplaced });

    const response = createSuccessResponse(
      { id: partId, removed: true },
      "Part removed successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getLabor(req: Request, res: Response) {
    const record = await this.loadOr404(req.params.id, res);
    if (!record) return;

    const response = createSuccessResponse(
      record.laborItems ?? [],
      "Labor retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  /**
   * Appends a labour line and re-derives the cost totals from it.
   *
   * `cost.laborTotal` is recomputed from the lines rather than trusted from
   * the client: it is what the invoice bills and what revenue reports sum, so
   * letting the two disagree would put a number on an invoice that its own
   * line items don't add up to.
   */
  async addLabor(req: ValidatedRequest<any>, res: Response) {
    const { id } = req.params;
    const data = req.validated;

    const record = await this.loadOr404(id, res);
    if (!record) return;

    const laborItems = [
      ...(record.laborItems?.toObject?.() ?? record.laborItems ?? []),
      {
        description: data.description,
        hours: data.hours,
        rate: data.rate,
        total: data.total,
      },
    ];

    const updated = await this.serviceRecordService.update(id, {
      laborItems,
      cost: this.recalculateCost(record, { laborItems }),
    } as any);

    const added = updated.laborItems[updated.laborItems.length - 1];

    const response = createSuccessResponse(
      added,
      "Labor added successfully",
      HttpStatus.CREATED,
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  /**
   * Edits one labour line. Parts already had update and remove; labour
   * didn't, which made a mistyped line permanent.
   */
  async updateLabor(req: ValidatedRequest<any>, res: Response) {
    const { id, laborId } = req.params;
    const data = req.validated;

    const record = await this.loadOr404(id, res);
    if (!record) return;

    const existing = record.laborItems?.toObject?.() ?? record.laborItems ?? [];
    const index = existing.findIndex((item: any) => item._id?.toString() === laborId);

    if (index === -1) {
      const error = createErrorResponse("Labor item not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const laborItems = [...existing];
    laborItems[index] = { ...laborItems[index], ...data };

    const updated = await this.serviceRecordService.update(id, {
      laborItems,
      cost: this.recalculateCost(record, { laborItems }),
    } as any);

    const response = createSuccessResponse(
      updated.laborItems[index],
      "Labor updated successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async removeLabor(req: Request, res: Response) {
    const { id, laborId } = req.params;

    const record = await this.loadOr404(id, res);
    if (!record) return;

    const existing = record.laborItems?.toObject?.() ?? record.laborItems ?? [];
    const laborItems = existing.filter((item: any) => item._id?.toString() !== laborId);

    if (laborItems.length === existing.length) {
      const error = createErrorResponse("Labor item not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    await this.serviceRecordService.update(id, {
      laborItems,
      cost: this.recalculateCost(record, { laborItems }),
    } as any);

    const response = createSuccessResponse(null, "Labor removed successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  /**
   * Recomputes the cost block from the parts and labour actually on the
   * record. Tax and discount are carried over — they are entered, not derived.
   */
  private recalculateCost(
    record: any,
    overrides: { partsReplaced?: any[]; laborItems?: any[] } = {},
  ) {
    const parts = overrides.partsReplaced ?? record.partsReplaced ?? [];
    const labor = overrides.laborItems ?? record.laborItems ?? [];

    const partsTotal = parts.reduce((sum: number, p: any) => sum + (p.totalCost ?? 0), 0);
    const laborTotal = labor.reduce((sum: number, l: any) => sum + (l.total ?? 0), 0);

    const tax = record.cost?.tax ?? 0;
    const discount = record.cost?.discount ?? 0;
    const subtotal = partsTotal + laborTotal;

    return {
      ...(record.cost?.toObject?.() ?? record.cost ?? {}),
      partsTotal,
      laborTotal,
      subtotal,
      tax,
      discount,
      total: Math.max(0, subtotal + tax - discount),
    };
  }

  async getDocuments(req: Request, res: Response) {
    const error = createErrorResponse(
      "Service record documents are not implemented yet",
      HttpStatus.NOT_IMPLEMENTED,
    );
    return res.status(error.statusCode).json(error.toJSON());
  }

  async uploadDocument(req: Request, res: Response) {
    const error = createErrorResponse(
      "Service record documents are not implemented yet",
      HttpStatus.NOT_IMPLEMENTED,
    );
    return res.status(error.statusCode).json(error.toJSON());
  }

  async deleteDocument(req: Request, res: Response) {
    const error = createErrorResponse(
      "Service record documents are not implemented yet",
      HttpStatus.NOT_IMPLEMENTED,
    );
    return res.status(error.statusCode).json(error.toJSON());
  }

  /*
   * Invoicing.
   *
   * `invoice.service.ts` does exist — the previous stub message claiming
   * otherwise was stale. These wire the record to it.
   */
  async getInvoice(req: Request, res: Response) {
    const record = await this.loadOr404(req.params.id, res);
    if (!record) return;

    const invoices = await this.invoiceService.findAll({
      serviceRecordId: req.params.id,
      limit: 1,
    } as any);

    const response = createSuccessResponse(
      invoices.data?.[0] ?? null,
      "Invoice retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async generateInvoice(req: ValidatedRequest<any>, res: Response) {
    const { id } = req.params;
    const record = await this.loadOr404(id, res);
    if (!record) return;

    // An invoice bills for work done. Generating one against a scheduled or
    // cancelled job would put a charge on a customer for a service that
    // hasn't happened.
    if (record.status !== "completed") {
      const error = createErrorResponse(
        "An invoice can only be generated for a completed service",
        HttpStatus.BAD_REQUEST,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    if (record.cost?.invoiceNumber) {
      const error = createErrorResponse(
        `This service already has invoice ${record.cost.invoiceNumber}`,
        HttpStatus.CONFLICT,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const taxRate = req.validated?.taxRate ?? 0;

    // One line per part, plus one for labour — so the invoice itemises the
    // same work the record does rather than showing a single opaque total.
    const lineItems = [
      ...(record.partsReplaced ?? []).map((part: any) => ({
        description: part.partName ?? "Part",
        quantity: part.quantity ?? 1,
        unitPrice: part.unitCost ?? 0,
      })),
    ];

    if ((record.cost?.laborTotal ?? 0) > 0) {
      lineItems.push({
        description: "Labour",
        quantity: 1,
        unitPrice: record.cost.laborTotal,
      });
    }

    if (lineItems.length === 0) {
      const error = createErrorResponse(
        "Nothing to invoice — add parts or labour first",
        HttpStatus.BAD_REQUEST,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const subtotal = lineItems.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);

    // Default to net-14 when the caller doesn't specify a due date.
    const dueDate = req.validated?.dueDate
      ? new Date(req.validated.dueDate)
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const invoice = await this.invoiceService.create({
      tenantId: record.tenantId?.toString(),
      accountId: record.ownerId?.toString(),
      serviceCenterId: record.serviceCenterId?.toString(),
      serviceRecordIds: [id],
      lineItems,
      taxAmount: Math.round(subtotal * (taxRate / 100)),
      dueDate,
    });

    // Stamp the number back onto the record so the conflict check above can
    // see it, and so the record shows which invoice covers it.
    await this.serviceRecordService.update(id, {
      cost: {
        ...(record.cost?.toObject?.() ?? record.cost ?? {}),
        invoiceNumber: invoice.invoiceNumber,
      },
    } as any);

    const response = createSuccessResponse(
      invoice,
      "Invoice generated successfully",
      HttpStatus.CREATED,
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async downloadInvoice(req: Request, res: Response) {
    const error = createErrorResponse(
      "Invoice download is not implemented yet; no invoice.service.ts exists",
      HttpStatus.NOT_IMPLEMENTED,
    );
    return res.status(error.statusCode).json(error.toJSON());
  }

  async updateStatus(req: ValidatedRequest<any>, res: Response) {
    const { id } = req.params;
    const { status } = req.validated;

    try {
      const record = await this.serviceRecordService.updateStatus(id, status);

      const response = createSuccessResponse(
        record,
        "Status updated successfully",
      );
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (error.message === "Service record not found") {
        const apiError = createErrorResponse(
          "Service record not found",
          HttpStatus.NOT_FOUND,
        );
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }

  async addFeedback(req: ValidatedRequest<any>, res: Response) {
    const { id } = req.params;
    const { rating, comment } = req.validated;

    const record = await this.loadOr404(id, res);
    if (!record) return;

    // Feedback is about work that happened. Accepting it on a scheduled or
    // cancelled job would let a rating attach to a service nobody performed.
    if (record.status !== "completed") {
      const error = createErrorResponse(
        "Feedback can only be left on a completed service",
        HttpStatus.BAD_REQUEST,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const updated = await this.serviceRecordService.update(id, {
      feedback: { rating, comment, submittedAt: new Date() },
    } as any);

    const response = createSuccessResponse(
      updated.feedback,
      "Feedback submitted successfully",
      HttpStatus.CREATED,
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getFeedback(req: Request, res: Response) {
    const record = await this.loadOr404(req.params.id, res);
    if (!record) return;

    // `{}` rather than 404: "not rated yet" is a normal state, and a 404 here
    // would make every client special-case an un-reviewed job.
    const response = createSuccessResponse(
      record.feedback ?? {},
      "Feedback retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async setNextService(req: ValidatedRequest<any>, res: Response) {
    const { id } = req.params;
    const { date, mileage, serviceType } = req.validated;

    const record = await this.serviceRecordService.update(id, {
      nextService: {
        recommendedDate: new Date(date),
        recommendedOdometer: mileage,
        serviceType,
      },
    });

    if (!record) {
      const error = createErrorResponse(
        "Service record not found",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      record.nextService,
      "Next service scheduled successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getNextService(req: Request, res: Response) {
    const { id } = req.params;

    const record = await this.serviceRecordService.findById(id);

    if (!record) {
      const error = createErrorResponse(
        "Service record not found",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      record.nextService,
      "Next service information retrieved",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }
}
