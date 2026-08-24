import { Request, Response } from "express";
import { ValidatedRequest } from "../middleware/validation.middleware";
import {
  ServiceRecordService,
  CreateServiceRecordInput,
  UpdateServiceRecordInput,
} from "../services/serviceRecord.service";
import {
  HttpStatus,
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
} from "../utils";

export class ServiceRecordController {
  constructor(private readonly serviceRecordService: ServiceRecordService) {}

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
    const error = createErrorResponse(
      "Itemized labor tracking is not implemented; ServiceRecord only stores a single cost.laborTotal figure",
      HttpStatus.NOT_IMPLEMENTED,
    );
    return res.status(error.statusCode).json(error.toJSON());
  }

  async addLabor(req: Request, res: Response) {
    const error = createErrorResponse(
      "Itemized labor tracking is not implemented; ServiceRecord only stores a single cost.laborTotal figure",
      HttpStatus.NOT_IMPLEMENTED,
    );
    return res.status(error.statusCode).json(error.toJSON());
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

  async getInvoice(req: Request, res: Response) {
    const error = createErrorResponse(
      "Invoice retrieval is not implemented yet; no invoice.service.ts exists",
      HttpStatus.NOT_IMPLEMENTED,
    );
    return res.status(error.statusCode).json(error.toJSON());
  }

  async generateInvoice(req: Request, res: Response) {
    const error = createErrorResponse(
      "Invoice generation is not implemented yet; no invoice.service.ts exists",
      HttpStatus.NOT_IMPLEMENTED,
    );
    return res.status(error.statusCode).json(error.toJSON());
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

  async addFeedback(req: Request, res: Response) {
    const error = createErrorResponse(
      "Service record feedback is not implemented yet; ServiceRecord has no feedback field",
      HttpStatus.NOT_IMPLEMENTED,
    );
    return res.status(error.statusCode).json(error.toJSON());
  }

  async getFeedback(req: Request, res: Response) {
    const error = createErrorResponse(
      "Service record feedback is not implemented yet; ServiceRecord has no feedback field",
      HttpStatus.NOT_IMPLEMENTED,
    );
    return res.status(error.statusCode).json(error.toJSON());
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
