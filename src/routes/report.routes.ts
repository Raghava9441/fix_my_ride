import { Router, Request, Response } from "express";
import { asyncHandler } from "../utils";
import { authenticate } from "../middleware/auth.middleware";
import { validate, ValidatedRequest } from "../middleware/validation.middleware";
import { ExportReportSchema } from "../dto/report.dto";
import { ReportController } from "../controllers/report.controller";
import { reportService } from "../services/report.service";
import { staffProfileService } from "../services/staff.service";
import { ownerProfileService } from "../services/owner.service";

const router = Router();

const reportController = new ReportController(reportService, staffProfileService, ownerProfileService);

router.use(authenticate);

router.get("/dashboard", asyncHandler(async (req: Request, res: Response) => {
  await reportController.getDashboard(req, res);
}));
router.get("/service-center/revenue", asyncHandler(async (req: Request, res: Response) => {
  await reportController.getCenterRevenue(req, res);
}));
router.get("/service-center/vehicles", asyncHandler(async (req: Request, res: Response) => {
  await reportController.getCenterVehiclesReport(req, res);
}));
router.get("/service-center/services", asyncHandler(async (req: Request, res: Response) => {
  await reportController.getCenterServicesReport(req, res);
}));
router.get("/service-center/staff-performance", asyncHandler(async (req: Request, res: Response) => {
  await reportController.getStaffPerformance(req, res);
}));
router.get("/service-center/customer-satisfaction", asyncHandler(async (req: Request, res: Response) => {
  await reportController.getCustomerSatisfaction(req, res);
}));
router.get("/service-center/parts-usage", asyncHandler(async (req: Request, res: Response) => {
  await reportController.getPartsUsage(req, res);
}));
router.get("/owner/expenses", asyncHandler(async (req: Request, res: Response) => {
  await reportController.getOwnerExpenses(req, res);
}));
router.get("/owner/service-history", asyncHandler(async (req: Request, res: Response) => {
  await reportController.getOwnerServiceHistory(req, res);
}));
router.get("/owner/upcoming-services", asyncHandler(async (req: Request, res: Response) => {
  await reportController.getUpcomingServices(req, res);
}));
router.get("/owner/maintenance-summary", asyncHandler(async (req: Request, res: Response) => {
  await reportController.getMaintenanceSummary(req, res);
}));
router.get("/admin/tenants", asyncHandler(async (req: Request, res: Response) => {
  await reportController.getTenantsReport(req, res);
}));
router.get("/admin/revenue", asyncHandler(async (req: Request, res: Response) => {
  await reportController.getSaaSRevenue(req, res);
}));
router.get("/admin/growth", asyncHandler(async (req: Request, res: Response) => {
  await reportController.getGrowthMetrics(req, res);
}));
router.get("/admin/retention", asyncHandler(async (req: Request, res: Response) => {
  await reportController.getRetentionReport(req, res);
}));
router.get("/admin/churn", asyncHandler(async (req: Request, res: Response) => {
  await reportController.getChurnReport(req, res);
}));
router.post(
  "/export",
  validate(ExportReportSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await reportController.exportReport(req, res);
  }),
);

export default router;
