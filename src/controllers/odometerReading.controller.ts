import { Request, Response } from "express";
import { ValidatedRequest } from "../middleware/validation.middleware";
import { OdometerReadingService } from "../services/odometerReading.service";
import { HttpStatus, createSuccessResponse, createErrorResponse } from "../utils";

export class OdometerReadingController {
  constructor(private readonly odometerReadingService: OdometerReadingService) {}

  async getHistory(req: ValidatedRequest<any>, res: Response) {
    const { id } = req.params;
    const query = req.validated ?? {};
    const history = await this.odometerReadingService.getHistory(id, {
      limit: query.limit,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });

    const response = createSuccessResponse(history, "Odometer readings retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getById(req: Request, res: Response) {
    const { readingId } = req.params;
    const reading = await this.odometerReadingService.findById(readingId);

    if (!reading) {
      const error = createErrorResponse("Odometer reading not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(reading, "Odometer reading retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async create(req: ValidatedRequest<any>, res: Response) {
    const { id } = req.params;
    const data = req.validated;

    try {
      const reading = await this.odometerReadingService.record({
        ...data,
        vehicleId: id,
        recordedBy: data.recordedBy ?? req.user?.id,
      });

      const response = createSuccessResponse(
        reading,
        "Odometer reading recorded successfully",
        HttpStatus.CREATED,
      );
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (error.message === "Vehicle not found") {
        const apiError = createErrorResponse(error.message, HttpStatus.NOT_FOUND);
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      if (error.message === "New odometer reading cannot be less than current reading") {
        const apiError = createErrorResponse(error.message, HttpStatus.BAD_REQUEST);
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }

  async update(req: ValidatedRequest<any>, res: Response) {
    const { readingId } = req.params;
    const reading = await this.odometerReadingService.update(readingId, req.validated);

    if (!reading) {
      const error = createErrorResponse("Odometer reading not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(reading, "Odometer reading updated successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async verify(req: ValidatedRequest<any>, res: Response) {
    const { readingId } = req.params;
    const { verifiedBy } = req.validated;
    const reading = await this.odometerReadingService.verify(readingId, verifiedBy);

    if (!reading) {
      const error = createErrorResponse("Odometer reading not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(reading, "Odometer reading verified successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async delete(req: Request, res: Response) {
    const { readingId } = req.params;
    const reading = await this.odometerReadingService.delete(readingId);

    if (!reading) {
      const error = createErrorResponse("Odometer reading not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(
      { id: reading._id, deleted: true },
      "Odometer reading deleted successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }
}
