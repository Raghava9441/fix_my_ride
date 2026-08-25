import { Request, Response } from "express";
import { ValidatedRequest } from "../middleware/validation.middleware";
import { ReportService } from "../services/report.service";
import { StaffProfileService } from "../services/staff.service";
import { OwnerProfileService } from "../services/owner.service";
import { HttpStatus, createSuccessResponse, createErrorResponse } from "../utils";

export class ReportController {
  constructor(
    private readonly reportService: ReportService,
    private readonly staffProfileService: StaffProfileService,
    private readonly ownerProfileService: OwnerProfileService,
  ) {}

  private async resolveServiceCenterId(req: Request): Promise<string | null> {
    if (req.query.serviceCenterId) return req.query.serviceCenterId as string;
    const staff = await this.staffProfileService.findByAccountId(req.user!.id);
    return staff?.serviceCenterId?.toString() ?? null;
  }

  private async resolveOwnerId(req: Request): Promise<string | null> {
    if (req.query.ownerId) return req.query.ownerId as string;
    const owner = await this.ownerProfileService.findByAccountId(req.user!.id);
    return owner?._id?.toString() ?? null;
  }

  private missingCenter(res: Response) {
    const error = createErrorResponse(
      "serviceCenterId is required (pass it explicitly, or call this as staff belonging to a center)",
      HttpStatus.BAD_REQUEST,
    );
    return res.status(error.statusCode).json(error.toJSON());
  }

  private missingOwner(res: Response) {
    const error = createErrorResponse(
      "ownerId is required (pass it explicitly, or call this as an authenticated owner)",
      HttpStatus.BAD_REQUEST,
    );
    return res.status(error.statusCode).json(error.toJSON());
  }

  async getDashboard(req: Request, res: Response) {
    const serviceCenterId = await this.resolveServiceCenterId(req);
    if (!serviceCenterId) return this.missingCenter(res);

    const result = await this.reportService.getCenterDashboard(serviceCenterId);
    const response = createSuccessResponse(result, "Dashboard data retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getCenterRevenue(req: Request, res: Response) {
    const serviceCenterId = await this.resolveServiceCenterId(req);
    if (!serviceCenterId) return this.missingCenter(res);

    const result = await this.reportService.getCenterRevenue(
      serviceCenterId,
      req.query.startDate as string,
      req.query.endDate as string,
    );
    const response = createSuccessResponse(result, "Revenue report retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getCenterVehiclesReport(req: Request, res: Response) {
    const serviceCenterId = await this.resolveServiceCenterId(req);
    if (!serviceCenterId) return this.missingCenter(res);

    const result = await this.reportService.getCenterVehiclesReport(serviceCenterId);
    const response = createSuccessResponse(result, "Vehicles report retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getCenterServicesReport(req: Request, res: Response) {
    const serviceCenterId = await this.resolveServiceCenterId(req);
    if (!serviceCenterId) return this.missingCenter(res);

    const result = await this.reportService.getCenterServicesReport(
      serviceCenterId,
      req.query.startDate as string,
      req.query.endDate as string,
    );
    const response = createSuccessResponse(result, "Services report retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getStaffPerformance(req: Request, res: Response) {
    const serviceCenterId = await this.resolveServiceCenterId(req);
    if (!serviceCenterId) return this.missingCenter(res);

    const result = await this.reportService.getStaffPerformance(serviceCenterId);
    const response = createSuccessResponse(result, "Staff performance retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getCustomerSatisfaction(req: Request, res: Response) {
    const serviceCenterId = await this.resolveServiceCenterId(req);
    if (!serviceCenterId) return this.missingCenter(res);

    const result = await this.reportService.getCustomerSatisfaction(serviceCenterId);
    const response = createSuccessResponse(
      result,
      "Customer satisfaction retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getPartsUsage(req: Request, res: Response) {
    const serviceCenterId = await this.resolveServiceCenterId(req);
    if (!serviceCenterId) return this.missingCenter(res);

    const result = await this.reportService.getPartsUsage(
      serviceCenterId,
      req.query.startDate as string,
      req.query.endDate as string,
    );
    const response = createSuccessResponse(result, "Parts usage retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getOwnerExpenses(req: Request, res: Response) {
    const ownerId = await this.resolveOwnerId(req);
    if (!ownerId) return this.missingOwner(res);

    const result = await this.reportService.getOwnerExpenses(ownerId);
    const response = createSuccessResponse(result, "Owner expenses retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getOwnerServiceHistory(req: Request, res: Response) {
    const ownerId = await this.resolveOwnerId(req);
    if (!ownerId) return this.missingOwner(res);

    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const result = await this.reportService.getOwnerServiceHistory(ownerId, limit);
    const response = createSuccessResponse(result, "Service history retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getUpcomingServices(req: Request, res: Response) {
    const ownerId = await this.resolveOwnerId(req);
    if (!ownerId) return this.missingOwner(res);

    const result = await this.reportService.getUpcomingServices(ownerId);
    const response = createSuccessResponse(result, "Upcoming services retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getMaintenanceSummary(req: Request, res: Response) {
    const ownerId = await this.resolveOwnerId(req);
    if (!ownerId) return this.missingOwner(res);

    const result = await this.reportService.getMaintenanceSummary(ownerId);
    const response = createSuccessResponse(
      result,
      "Maintenance summary retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getTenantsReport(req: Request, res: Response) {
    const result = await this.reportService.getTenantsReport();
    const response = createSuccessResponse(result, "Tenants report retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getSaaSRevenue(req: Request, res: Response) {
    const result = await this.reportService.getSaaSRevenue(
      req.query.startDate as string,
      req.query.endDate as string,
    );
    const response = createSuccessResponse(result, "SaaS revenue retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getGrowthMetrics(req: Request, res: Response) {
    const result = await this.reportService.getGrowthMetrics(
      req.query.startDate as string,
      req.query.endDate as string,
    );
    const response = createSuccessResponse(result, "Growth metrics retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getRetentionReport(req: Request, res: Response) {
    const result = await this.reportService.getRetentionReport(
      req.query.startDate as string,
      req.query.endDate as string,
    );
    const response = createSuccessResponse(result, "Retention report retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getChurnReport(req: Request, res: Response) {
    const result = await this.reportService.getChurnReport(
      req.query.startDate as string,
      req.query.endDate as string,
    );
    const response = createSuccessResponse(result, "Churn report retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async exportReport(req: ValidatedRequest<any>, res: Response) {
    const { type, format, startDate, endDate } = req.validated as {
      type: string;
      format: string;
      startDate?: string;
      endDate?: string;
    };

    const isExcel = format === "excel";
    if (format && format !== "csv" && !isExcel) {
      const error = createErrorResponse(
        `Not implemented — only "csv" and "excel" export are wired up (no PDF generation library in this codebase yet)`,
        HttpStatus.NOT_IMPLEMENTED,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    let rows: Record<string, unknown>[];
    switch (type) {
      case "revenue": {
        const serviceCenterId = await this.resolveServiceCenterId(req);
        if (!serviceCenterId) return this.missingCenter(res);
        const { daily } = await this.reportService.getCenterRevenue(
          serviceCenterId,
          startDate,
          endDate,
        );
        rows = daily;
        break;
      }
      case "vehicles": {
        const serviceCenterId = await this.resolveServiceCenterId(req);
        if (!serviceCenterId) return this.missingCenter(res);
        rows = [await this.reportService.getCenterVehiclesReport(serviceCenterId)];
        break;
      }
      case "services": {
        const serviceCenterId = await this.resolveServiceCenterId(req);
        if (!serviceCenterId) return this.missingCenter(res);
        rows = await this.reportService.getCenterServicesReport(
          serviceCenterId,
          startDate,
          endDate,
        );
        break;
      }
      case "staff": {
        const serviceCenterId = await this.resolveServiceCenterId(req);
        if (!serviceCenterId) return this.missingCenter(res);
        rows = await this.reportService.getStaffPerformance(serviceCenterId);
        break;
      }
      case "expenses": {
        const ownerId = await this.resolveOwnerId(req);
        if (!ownerId) return this.missingOwner(res);
        rows = [await this.reportService.getOwnerExpenses(ownerId)];
        break;
      }
      case "tenant": {
        rows = [await this.reportService.getTenantsReport()];
        break;
      }
      case "growth": {
        rows = [await this.reportService.getGrowthMetrics(startDate, endDate)];
        break;
      }
      default: {
        const error = createErrorResponse(`Unknown report type "${type}"`, HttpStatus.BAD_REQUEST);
        return res.status(error.statusCode).json(error.toJSON());
      }
    }

    if (isExcel) {
      const buffer = await this.reportService.toExcel(rows);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader("Content-Disposition", `attachment; filename="${type}-report.xlsx"`);
      return res.status(HttpStatus.OK).send(buffer);
    }

    const csv = this.reportService.toCsv(rows);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${type}-report.csv"`);
    return res.status(HttpStatus.OK).send(csv);
  }
}
