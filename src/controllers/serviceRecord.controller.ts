import { Request, Response } from "express";
import { ValidatedRequest } from "../middleware/validation.middleware";
import {
  ServiceRecordService,
  CreateServiceRecordInput,
  UpdateServiceRecordInput,
} from "../services/serviceRecord.service";
import { DocumentService } from "../services/document.service";
import { StorageService } from "../services/storage.service";
import { InvoiceService } from "../services/invoice.service";
import {
  HttpStatus,
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
} from "../utils";

/** Value stored in `Document.entityType` for everything this controller attaches. */
const ENTITY_TYPE = "service_record" as const;

export class ServiceRecordController {
  constructor(
    private readonly serviceRecordService: ServiceRecordService,
    private readonly documentService: DocumentService,
    private readonly storageService: StorageService,
    private readonly invoiceService: InvoiceService,
  ) {}

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

    const input: CreateServiceRecordInput = {
      tenantId: data.tenantId,
      vehicleId: data.vehicleId,
      serviceCenterId: data.serviceCenterId,
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
      createdBy: data.createdBy,
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
    const { id } = req.params;
    const laborItems = await this.serviceRecordService.getLabor(id);

    if (laborItems === null) {
      const error = createErrorResponse("Service record not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(laborItems, "Labor items retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async addLabor(req: ValidatedRequest<any>, res: Response) {
    const { id } = req.params;
    const result = await this.serviceRecordService.addLabor(id, req.validated);

    if (!result) {
      const error = createErrorResponse("Service record not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      result.laborItem,
      "Labor item added successfully",
      HttpStatus.CREATED,
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getDocuments(req: Request, res: Response) {
    const { id } = req.params;

    const documents = await this.documentService.findByEntity(ENTITY_TYPE, id, {
      type: req.query.type as string,
    });

    const response = createSuccessResponse(documents, "Documents retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async uploadDocument(req: ValidatedRequest<any>, res: Response) {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      const error = createErrorResponse("No file was uploaded", HttpStatus.BAD_REQUEST);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const record = await this.serviceRecordService.findById(id);
    if (!record) {
      const error = createErrorResponse("Service record not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const data = req.validated;
    const stored = await this.storageService.saveFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      ENTITY_TYPE,
    );

    const document = await this.documentService.create({
      accountId: data.accountId ?? req.user?.id,
      originalName: stored.originalName,
      fileName: stored.fileName,
      mimeType: stored.mimeType,
      size: stored.size,
      extension: stored.extension,
      storageProvider: stored.storageProvider,
      url: stored.url,
      path: stored.path,
      entityType: ENTITY_TYPE,
      entityId: id,
      documentType: data.documentType,
      description: data.description,
      tags: data.tags,
      isPublic: data.isPublic,
      allowedRoles: data.allowedRoles,
      allowedAccounts: data.allowedAccounts,
      validFrom: data.validFrom ? new Date(data.validFrom) : undefined,
      validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
      metadata: data.metadata,
    });

    const response = createSuccessResponse(
      document,
      "Document uploaded successfully",
      HttpStatus.CREATED,
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async deleteDocument(req: Request, res: Response) {
    const { id, documentId } = req.params;
    const document = await this.documentService.findById(documentId);

    // Scoped by entity on purpose: the document id comes from the URL, so
    // without this a caller could delete any document in the tenant through
    // a service record they happen to have access to.
    if (!document || document.entityType !== ENTITY_TYPE || String(document.entityId) !== id) {
      const error = createErrorResponse("Document not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    await this.documentService.softDelete(documentId, req.user!.id);
    await this.storageService.deleteFile(ENTITY_TYPE, document.fileName).catch(() => undefined);

    const response = createSuccessResponse(
      { id: document._id, deleted: true },
      "Document deleted successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getInvoice(req: Request, res: Response) {
    const { id } = req.params;
    const invoice = await this.invoiceService.findByServiceRecord(id);

    if (!invoice) {
      const error = createErrorResponse(
        "No invoice has been generated for this service record",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(invoice, "Invoice retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async generateInvoice(req: ValidatedRequest<any>, res: Response) {
    const { id } = req.params;

    try {
      const invoice = await this.invoiceService.generateForServiceRecord(id, req.validated ?? {});

      const response = createSuccessResponse(
        invoice,
        "Invoice generated successfully",
        HttpStatus.CREATED,
      );
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (error.message === "Service record not found") {
        const apiError = createErrorResponse(error.message, HttpStatus.NOT_FOUND);
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      if (error.message === "Owner profile not found for this service record") {
        const apiError = createErrorResponse(error.message, HttpStatus.NOT_FOUND);
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      if (error.message === "Invoice already exists for this service record") {
        const apiError = createErrorResponse(error.message, HttpStatus.CONFLICT);
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }

  async downloadInvoice(req: Request, res: Response) {
    const { id } = req.params;
    const invoice = await this.invoiceService.findByServiceRecord(id);

    if (!invoice) {
      const error = createErrorResponse(
        "No invoice has been generated for this service record",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const buffer = await this.invoiceService.toExcel(invoice);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="invoice-${invoice.invoiceNumber}.xlsx"`,
    );
    return res.status(HttpStatus.OK).send(buffer);
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
    const feedback = await this.serviceRecordService.addFeedback(
      id,
      req.validated,
      req.user?.id,
    );

    if (!feedback) {
      const error = createErrorResponse("Service record not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      feedback,
      "Feedback submitted successfully",
      HttpStatus.CREATED,
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getFeedback(req: Request, res: Response) {
    const { id } = req.params;
    const feedback = await this.serviceRecordService.getFeedback(id);

    if (feedback === undefined) {
      const error = createErrorResponse("Service record not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(feedback, "Feedback retrieved successfully");
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
