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

  private roles(req: Request): string[] {
    return req.user?.roles ?? (req.user?.role ? [req.user.role] : []);
  }

  private isAdmin(req: Request): boolean {
    return this.roles(req).includes("admin");
  }

  /**
   * Staff-side accounts may look at a customer's figures; customers may only
   * see their own. Decided by role *or* by holding a staff profile, because a
   * workspace owner carries the account role `owner` and is only recognisable
   * as staff by that profile.
   */
  private async isStaffSide(req: Request): Promise<boolean> {
    if (this.roles(req).some((r) => ["admin", "staff", "service_advisor", "fleet_manager"].includes(r))) {
      return true;
    }
    return Boolean(await this.staffProfileService.findByAccountId(req.user!.id));
  }

  private forbidden(res: Response, message: string) {
    const error = createErrorResponse(message, HttpStatus.FORBIDDEN);
    return res.status(error.statusCode).json(error.toJSON());
  }

  /**
   * The center a request is about.
   *
   * A non-admin is pinned to the center their staff profile belongs to, and
   * an account with no staff profile at all is refused. The query parameter
   * used to be trusted outright, which let any signed-in account - customers
   * included - read any center's report by passing its id.
   */
  private async resolveServiceCenterId(req: Request): Promise<string | "forbidden" | null> {
    const requested = req.query.serviceCenterId as string | undefined;
    if (this.isAdmin(req)) {
      if (requested) return requested;
    }

    const staff = await this.staffProfileService.findByAccountId(req.user!.id);
    const own = staff?.serviceCenterId?.toString() ?? null;

    if (this.isAdmin(req)) return own;
    // No staff profile means a customer account: these are workshop reports.
    if (!own) return "forbidden";
    if (requested && requested !== own) return "forbidden";
    return own;
  }

  /** The owner profile a request is about; same rule as the center, for customers. */
  private async resolveOwnerId(req: Request): Promise<string | "forbidden" | null> {
    const requested = req.query.ownerId as string | undefined;
    if (requested && (await this.isStaffSide(req))) return requested;

    const owner = await this.ownerProfileService.findByAccountId(req.user!.id);
    const own = owner?._id?.toString() ?? null;

    if (requested && requested !== own) return "forbidden";
    return own;
  }

  /**
   * Parses an optional ISO date query parameter.
   *
   * An unparseable value used to become `Invalid Date`, which Mongo rejects
   * with a cast error and the caller sees as a 500. Returns `"invalid"` so
   * the handler can answer 400 instead.
   */
  private dateQuery(value: unknown): string | undefined | "invalid" {
    if (typeof value !== "string" || value === "") return undefined;
    return Number.isNaN(new Date(value).getTime()) ? "invalid" : value;
  }

  private badRange(res: Response) {
    const error = createErrorResponse(
      "startDate and endDate must be valid ISO 8601 dates",
      HttpStatus.BAD_REQUEST,
    );
    return res.status(error.statusCode).json(error.toJSON());
  }

  private range(req: Request): { startDate?: string; endDate?: string } | "invalid" {
    const startDate = this.dateQuery(req.query.startDate);
    const endDate = this.dateQuery(req.query.endDate);
    if (startDate === "invalid" || endDate === "invalid") return "invalid";
    return { startDate, endDate };
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
    if (serviceCenterId === "forbidden") return this.forbidden(res, "You can only view reports for your own service center");
    if (!serviceCenterId) return this.missingCenter(res);

    const result = await this.reportService.getCenterDashboard(serviceCenterId);
    const response = createSuccessResponse(result, "Dashboard data retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getCenterRevenue(req: Request, res: Response) {
    const range = this.range(req);
    if (range === "invalid") return this.badRange(res);

    const serviceCenterId = await this.resolveServiceCenterId(req);
    if (serviceCenterId === "forbidden") return this.forbidden(res, "You can only view reports for your own service center");
    if (!serviceCenterId) return this.missingCenter(res);

    const result = await this.reportService.getCenterRevenue(
      serviceCenterId,
      range.startDate,
      range.endDate,
    );
    const response = createSuccessResponse(result, "Revenue report retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getCenterVehiclesReport(req: Request, res: Response) {
    const serviceCenterId = await this.resolveServiceCenterId(req);
    if (serviceCenterId === "forbidden") return this.forbidden(res, "You can only view reports for your own service center");
    if (!serviceCenterId) return this.missingCenter(res);

    const result = await this.reportService.getCenterVehiclesReport(serviceCenterId);
    const response = createSuccessResponse(result, "Vehicles report retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getCenterServicesReport(req: Request, res: Response) {
    const range = this.range(req);
    if (range === "invalid") return this.badRange(res);

    const serviceCenterId = await this.resolveServiceCenterId(req);
    if (serviceCenterId === "forbidden") return this.forbidden(res, "You can only view reports for your own service center");
    if (!serviceCenterId) return this.missingCenter(res);

    const result = await this.reportService.getCenterServicesReport(
      serviceCenterId,
      range.startDate,
      range.endDate,
    );
    const response = createSuccessResponse(result, "Services report retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getStaffPerformance(req: Request, res: Response) {
    const serviceCenterId = await this.resolveServiceCenterId(req);
    if (serviceCenterId === "forbidden") return this.forbidden(res, "You can only view reports for your own service center");
    if (!serviceCenterId) return this.missingCenter(res);

    const result = await this.reportService.getStaffPerformance(serviceCenterId);
    const response = createSuccessResponse(result, "Staff performance retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getCustomerSatisfaction(req: Request, res: Response) {
    const serviceCenterId = await this.resolveServiceCenterId(req);
    if (serviceCenterId === "forbidden") return this.forbidden(res, "You can only view reports for your own service center");
    if (!serviceCenterId) return this.missingCenter(res);

    const result = await this.reportService.getCustomerSatisfaction(serviceCenterId);
    const response = createSuccessResponse(
      result,
      "Customer satisfaction retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getPartsUsage(req: Request, res: Response) {
    const range = this.range(req);
    if (range === "invalid") return this.badRange(res);

    const serviceCenterId = await this.resolveServiceCenterId(req);
    if (serviceCenterId === "forbidden") return this.forbidden(res, "You can only view reports for your own service center");
    if (!serviceCenterId) return this.missingCenter(res);

    const result = await this.reportService.getPartsUsage(
      serviceCenterId,
      range.startDate,
      range.endDate,
    );
    const response = createSuccessResponse(result, "Parts usage retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getOwnerExpenses(req: Request, res: Response) {
    const ownerId = await this.resolveOwnerId(req);
    if (ownerId === "forbidden") return this.forbidden(res, "You can only view your own reports");
    if (!ownerId) return this.missingOwner(res);

    const result = await this.reportService.getOwnerExpenses(ownerId);
    const response = createSuccessResponse(result, "Owner expenses retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getOwnerServiceHistory(req: Request, res: Response) {
    const ownerId = await this.resolveOwnerId(req);
    if (ownerId === "forbidden") return this.forbidden(res, "You can only view your own reports");
    if (!ownerId) return this.missingOwner(res);

    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const result = await this.reportService.getOwnerServiceHistory(ownerId, limit);
    const response = createSuccessResponse(result, "Service history retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getUpcomingServices(req: Request, res: Response) {
    const ownerId = await this.resolveOwnerId(req);
    if (ownerId === "forbidden") return this.forbidden(res, "You can only view your own reports");
    if (!ownerId) return this.missingOwner(res);

    const result = await this.reportService.getUpcomingServices(ownerId);
    const response = createSuccessResponse(result, "Upcoming services retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getMaintenanceSummary(req: Request, res: Response) {
    const ownerId = await this.resolveOwnerId(req);
    if (ownerId === "forbidden") return this.forbidden(res, "You can only view your own reports");
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
    const range = this.range(req);
    if (range === "invalid") return this.badRange(res);
    const result = await this.reportService.getSaaSRevenue(range.startDate, range.endDate);
    const response = createSuccessResponse(result, "SaaS revenue retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getGrowthMetrics(req: Request, res: Response) {
    const range = this.range(req);
    if (range === "invalid") return this.badRange(res);
    const result = await this.reportService.getGrowthMetrics(range.startDate, range.endDate);
    const response = createSuccessResponse(result, "Growth metrics retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getRetentionReport(req: Request, res: Response) {
    const range = this.range(req);
    if (range === "invalid") return this.badRange(res);
    const result = await this.reportService.getRetentionReport(range.startDate, range.endDate);
    const response = createSuccessResponse(result, "Retention report retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getChurnReport(req: Request, res: Response) {
    const range = this.range(req);
    if (range === "invalid") return this.badRange(res);
    const result = await this.reportService.getChurnReport(range.startDate, range.endDate);
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

    // `tenant` and `growth` are platform-wide figures; the matching read
    // routes are admin-only, so the export of them must be too.
    if ((type === "tenant" || type === "growth") && !this.isAdmin(req)) {
      return this.forbidden(res, "Only platform admins can export platform reports");
    }

    const isExcel = format === "excel";
    const isPdf = format === "pdf";

    let rows: Record<string, unknown>[];
    switch (type) {
      case "revenue": {
        const serviceCenterId = await this.resolveServiceCenterId(req);
        if (serviceCenterId === "forbidden") return this.forbidden(res, "You can only export reports for your own service center");
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
        if (serviceCenterId === "forbidden") return this.forbidden(res, "You can only export reports for your own service center");
        if (!serviceCenterId) return this.missingCenter(res);
        rows = [await this.reportService.getCenterVehiclesReport(serviceCenterId)];
        break;
      }
      case "services": {
        const serviceCenterId = await this.resolveServiceCenterId(req);
        if (serviceCenterId === "forbidden") return this.forbidden(res, "You can only export reports for your own service center");
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
        if (serviceCenterId === "forbidden") return this.forbidden(res, "You can only export reports for your own service center");
        if (!serviceCenterId) return this.missingCenter(res);
        rows = await this.reportService.getStaffPerformance(serviceCenterId);
        break;
      }
      case "expenses": {
        const ownerId = await this.resolveOwnerId(req);
        if (ownerId === "forbidden") return this.forbidden(res, "You can only export your own reports");
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

    if (isPdf) {
      const title = `${type.charAt(0).toUpperCase()}${type.slice(1)} report`;
      const buffer = await this.reportService.toPdf(rows, title);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${type}-report.pdf"`);
      return res.status(HttpStatus.OK).send(buffer);
    }

    const csv = this.reportService.toCsv(rows);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${type}-report.csv"`);
    return res.status(HttpStatus.OK).send(csv);
  }
}
