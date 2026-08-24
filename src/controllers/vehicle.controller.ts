import { Request, Response } from "express";
import { ValidatedRequest } from "../middleware/validation.middleware";
import {
  VehicleService,
  CreateVehicleInput,
  UpdateVehicleInput,
  VehicleFilters,
} from "../services/vehicle.service";
import { DocumentService } from "../services/document.service";
import { ReminderService } from "../services/reminder.service";
import {
  HttpStatus,
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
} from "../utils";

export class VehicleController {
  constructor(
    private readonly vehicleService: VehicleService,
    private readonly documentService: DocumentService,
    private readonly reminderService: ReminderService,
  ) {}

  async getAllVehicles(req: Request, res: Response) {
    const filters: VehicleFilters = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      tenantId: req.query.tenantId as string,
      currentOwnerId: req.query.currentOwnerId as string,
      make: req.query.make as string,
      model: req.query.model as string,
      year: req.query.year ? parseInt(req.query.year as string) : undefined,
      fuelType: req.query.fuelType as string,
    };

    const result = await this.vehicleService.findAll(filters);

    const response = createPaginatedResponse(
      result.data,
      result.pagination.page,
      result.pagination.limit,
      result.pagination.total,
      "Vehicles retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async searchVehicles(req: Request, res: Response) {
    const error = createErrorResponse(
      "Not implemented — vehicle.service.ts findAll has no text-search filter to search on",
      HttpStatus.NOT_IMPLEMENTED,
    );
    return res.status(error.statusCode).json(error.toJSON());
  }

  async getVehicleByRegistration(req: Request, res: Response) {
    const { regNumber } = req.params;

    const vehicle = await this.vehicleService.findByRegistration(
      regNumber,
      req.tenantId,
    );

    if (!vehicle) {
      const error = createErrorResponse(
        "Vehicle not found",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      vehicle,
      "Vehicle retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getVehicleByVin(req: Request, res: Response) {
    const { vin } = req.params;

    const vehicle = await this.vehicleService.findByVin(vin);

    if (!vehicle) {
      const error = createErrorResponse(
        "Vehicle not found",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      vehicle,
      "Vehicle retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getVehicleById(req: Request, res: Response) {
    const { id } = req.params;

    const vehicle = await this.vehicleService.findById(id);

    if (!vehicle) {
      const error = createErrorResponse(
        "Vehicle not found",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      vehicle,
      "Vehicle retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async createVehicle(req: ValidatedRequest<any>, res: Response) {
    const data = req.validated;

    if (!data.currentOdometer) {
      const error = createErrorResponse(
        "currentOdometer is required",
        HttpStatus.BAD_REQUEST,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const input: CreateVehicleInput = {
      tenantId: data.tenantId,
      registrationNumber: data.registrationNumber,
      vin: data.vin,
      make: data.make,
      model: data.model,
      year: data.year,
      fuelType: data.fuelType,
      transmission: data.transmission,
      color: data.color,
      currentOwnerId: data.currentOwnerId,
      currentOdometer: {
        value: data.currentOdometer.value,
        unit: data.currentOdometer.unit,
      },
      serviceSchedule: data.serviceSchedule,
    };

    try {
      const vehicle = await this.vehicleService.create(input);

      const response = createSuccessResponse(
        vehicle,
        "Vehicle created successfully",
        HttpStatus.CREATED,
      );
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (
        error.message === "Vehicle with this registration number already exists"
      ) {
        const apiError = createErrorResponse(
          error.message,
          HttpStatus.CONFLICT,
        );
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      if (error.message === "Owner profile not found") {
        const apiError = createErrorResponse(
          error.message,
          HttpStatus.NOT_FOUND,
        );
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }

  async updateVehicle(req: ValidatedRequest<any>, res: Response) {
    const { id } = req.params;
    const data = req.validated;

    const vehicle = await this.vehicleService.update(
      id,
      data as UpdateVehicleInput,
    );

    if (!vehicle) {
      const error = createErrorResponse(
        "Vehicle not found",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      vehicle,
      "Vehicle updated successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async deleteVehicle(req: Request, res: Response) {
    const { id } = req.params;

    const vehicle = await this.vehicleService.delete(id);

    if (!vehicle) {
      const error = createErrorResponse(
        "Vehicle not found",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      {
        id: vehicle._id,
        deleted: true,
        deletedAt: vehicle.deletedAt,
      },
      "Vehicle deleted successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getServiceRecords(req: Request, res: Response) {
    const { id } = req.params;
    const filters = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      serviceCenterId: req.query.serviceCenterId as string,
    };

    const result = await this.vehicleService.getServiceHistory(id, filters);

    const response = createPaginatedResponse(
      result.data,
      result.pagination.page,
      result.pagination.limit,
      result.pagination.total,
      "Service records retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getAuthorizedCenters(req: Request, res: Response) {
    const { id } = req.params;

    const vehicle = await this.vehicleService.findById(id);

    if (!vehicle) {
      const error = createErrorResponse(
        "Vehicle not found",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      vehicle.authorizedServiceCenters,
      "Authorized centers retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async authorizeCenter(req: ValidatedRequest<any>, res: Response) {
    const { id } = req.params;
    const { centerId, accessLevel } = req.validated;

    try {
      const vehicle = await this.vehicleService.authorizeServiceCenter(
        id,
        centerId,
        req.userId as string,
        accessLevel,
      );

      const response = createSuccessResponse(
        vehicle,
        "Center authorized successfully",
        HttpStatus.CREATED,
      );
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (
        error.message === "Vehicle not found" ||
        error.message === "Service center not found"
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

  async updateCenterAccess(req: ValidatedRequest<any>, res: Response) {
    const { id, centerId } = req.params;
    const updates = req.validated;

    try {
      const vehicle = await this.vehicleService.updateServiceCenterAccess(
        id,
        centerId,
        updates,
      );

      const response = createSuccessResponse(
        vehicle,
        "Center access updated successfully",
      );
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (
        error.message === "Vehicle not found" ||
        error.message === "Service center not authorized"
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

  async revokeCenterAccess(req: Request, res: Response) {
    const { id, centerId } = req.params;

    try {
      const vehicle = await this.vehicleService.revokeServiceCenter(
        id,
        centerId,
      );

      const response = createSuccessResponse(
        vehicle,
        "Center access revoked successfully",
      );
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (
        error.message === "Vehicle not found" ||
        error.message === "Service center not authorized"
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

  async getCurrentOdometer(req: Request, res: Response) {
    const { id } = req.params;

    const vehicle = await this.vehicleService.findById(id);

    if (!vehicle) {
      const error = createErrorResponse(
        "Vehicle not found",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      vehicle.currentOdometer,
      "Odometer reading retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async updateOdometer(req: ValidatedRequest<any>, res: Response) {
    const { id } = req.params;
    const { reading, unit, source } = req.validated;

    try {
      const vehicle = await this.vehicleService.updateOdometer(
        id,
        reading,
        unit,
        req.userId,
        source,
      );

      const response = createSuccessResponse(
        vehicle.currentOdometer,
        "Odometer updated successfully",
      );
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (error.message === "Vehicle not found") {
        const apiError = createErrorResponse(
          error.message,
          HttpStatus.NOT_FOUND,
        );
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      if (
        error.message ===
        "New odometer reading cannot be less than current reading"
      ) {
        const apiError = createErrorResponse(
          error.message,
          HttpStatus.BAD_REQUEST,
        );
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }

  async getOdometerHistory(req: Request, res: Response) {
    const { id } = req.params;
    const options = {
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      from: req.query.from ? new Date(req.query.from as string) : undefined,
      to: req.query.to ? new Date(req.query.to as string) : undefined,
    };

    const history = await this.vehicleService.getOdometerHistory(id, options);

    const response = createSuccessResponse(
      history,
      "Odometer history retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getDocuments(req: Request, res: Response) {
    const { id } = req.params;

    const documents = await this.documentService.findByEntity("vehicle", id);

    const response = createSuccessResponse(
      documents,
      "Documents retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async uploadDocument(req: Request, res: Response) {
    const error = createErrorResponse(
      "Not implemented — file-storage subsystem (multer + storage service) is not wired up yet",
      HttpStatus.NOT_IMPLEMENTED,
    );
    return res.status(error.statusCode).json(error.toJSON());
  }

  async deleteDocument(req: Request, res: Response) {
    const error = createErrorResponse(
      "Not implemented — file-storage subsystem (multer + storage service) is not wired up yet",
      HttpStatus.NOT_IMPLEMENTED,
    );
    return res.status(error.statusCode).json(error.toJSON());
  }

  async downloadDocument(req: Request, res: Response) {
    const error = createErrorResponse(
      "Not implemented — file-storage subsystem (multer + storage service) is not wired up yet",
      HttpStatus.NOT_IMPLEMENTED,
    );
    return res.status(error.statusCode).json(error.toJSON());
  }

  async getReminders(req: Request, res: Response) {
    const { id } = req.params;
    const filters = {
      vehicleId: id,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
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

  async getWarranty(req: Request, res: Response) {
    const error = createErrorResponse(
      "Not implemented — no warranty/insurance field on the Vehicle schema yet",
      HttpStatus.NOT_IMPLEMENTED,
    );
    return res.status(error.statusCode).json(error.toJSON());
  }

  async updateWarranty(req: Request, res: Response) {
    const error = createErrorResponse(
      "Not implemented — no warranty/insurance field on the Vehicle schema yet",
      HttpStatus.NOT_IMPLEMENTED,
    );
    return res.status(error.statusCode).json(error.toJSON());
  }

  async getInsurance(req: Request, res: Response) {
    const error = createErrorResponse(
      "Not implemented — no warranty/insurance field on the Vehicle schema yet",
      HttpStatus.NOT_IMPLEMENTED,
    );
    return res.status(error.statusCode).json(error.toJSON());
  }

  async updateInsurance(req: Request, res: Response) {
    const error = createErrorResponse(
      "Not implemented — no warranty/insurance field on the Vehicle schema yet",
      HttpStatus.NOT_IMPLEMENTED,
    );
    return res.status(error.statusCode).json(error.toJSON());
  }

  async transferOwnership(req: ValidatedRequest<any>, res: Response) {
    const { id } = req.params;
    const { newOwnerId, transferReason } = req.validated;

    try {
      const vehicle = await this.vehicleService.transferOwnership(
        id,
        newOwnerId,
        transferReason,
      );

      const response = createSuccessResponse(
        vehicle,
        "Ownership transferred successfully",
      );
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (
        error.message === "Vehicle not found" ||
        error.message === "New owner not found"
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

  async getVehicleStats(req: Request, res: Response) {
    const { id } = req.params;

    const vehicle = await this.vehicleService.findById(id);

    if (!vehicle) {
      const error = createErrorResponse(
        "Vehicle not found",
        HttpStatus.NOT_FOUND,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const history = await this.vehicleService.getServiceHistory(id, {
      limit: 1000,
    });

    const records = history.data;
    const totalServiceCost = records.reduce(
      (sum: number, record: any) => sum + (record.cost?.totalCost || 0),
      0,
    );

    let averageServiceIntervalDays: number | null = null;
    if (records.length >= 2) {
      const dates = records
        .map((r: any) => new Date(r.serviceDate).getTime())
        .sort((a: number, b: number) => a - b);
      const span = dates[dates.length - 1] - dates[0];
      averageServiceIntervalDays = Math.round(
        span / (dates.length - 1) / (1000 * 60 * 60 * 24),
      );
    }

    const response = createSuccessResponse(
      {
        totalServiceCost,
        serviceCount: history.pagination.total,
        averageServiceIntervalDays,
      },
      "Vehicle stats retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }
}
