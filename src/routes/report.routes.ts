import { Router } from "express";
import { reportController } from "../controllers/report.controller";

const router = Router();

router.get("/dashboard", reportController.getDashboard);
router.get(
  "/service-center/revenue",
  reportController.getCenterRevenue,
);
router.get(
  "/service-center/vehicles",
  reportController.getCenterVehiclesReport,
);
router.get(
  "/service-center/services",
  reportController.getCenterServicesReport,
);
router.get(
  "/service-center/staff-performance",
  reportController.getStaffPerformance,
);
router.get(
  "/service-center/customer-satisfaction",
  reportController.getCustomerSatisfaction,
);
router.get(
  "/service-center/parts-usage",
  reportController.getPartsUsage,
);
router.get("/owner/expenses", reportController.getOwnerExpenses);
router.get(
  "/owner/service-history",
  reportController.getOwnerServiceHistory,
);
router.get(
  "/owner/upcoming-services",
  reportController.getUpcomingServices,
);
router.get(
  "/owner/maintenance-summary",
  reportController.getMaintenanceSummary,
);
router.get("/admin/tenants", reportController.getTenantsReport);
router.get("/admin/revenue", reportController.getSaaSRevenue);
router.get("/admin/growth", reportController.getGrowthMetrics);
router.get("/admin/retention", reportController.getRetentionReport);
router.get("/admin/churn", reportController.getChurnReport);
router.post("/export", reportController.exportReport);

export default router;
