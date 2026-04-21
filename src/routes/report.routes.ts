import { Router, Request, Response, NextFunction } from "express";
import { asyncHandler, createSuccessResponse, HttpStatus } from "../utils";

const router = Router();

const reportController = {
  getDashboard: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        totalRevenue: 500000,
        totalVehicles: 150,
        totalServiceRecords: 320,
        activeCustomers: 100,
      };
      const response = createSuccessResponse(
        result,
        "Dashboard data retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getCenterRevenue: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { total: 250000, monthly: 50000, daily: 5000 };
      const response = createSuccessResponse(
        result,
        "Revenue report retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getCenterVehiclesReport: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { total: 150, active: 100, inactive: 50 };
      const response = createSuccessResponse(
        result,
        "Vehicles report retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getCenterServicesReport: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = [
        { service: "Oil Change", count: 50, revenue: 250000 },
        { service: "Tire Rotation", count: 30, revenue: 90000 },
      ];
      const response = createSuccessResponse(
        result,
        "Services report retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getStaffPerformance: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = [
        { staffId: "staff-1", name: "Mike Johnson", services: 50, rating: 4.5 },
        {
          staffId: "staff-2",
          name: "Sarah Williams",
          services: 45,
          rating: 4.8,
        },
      ];
      const response = createSuccessResponse(
        result,
        "Staff performance retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getCustomerSatisfaction: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { averageRating: 4.5, totalReviews: 100 };
      const response = createSuccessResponse(
        result,
        "Customer satisfaction retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getPartsUsage: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = [
        { part: "Oil Filter", quantity: 50, cost: 25000 },
        { part: "Air Filter", quantity: 30, cost: 9000 },
      ];
      const response = createSuccessResponse(
        result,
        "Parts usage retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getOwnerExpenses: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        total: 8000,
        byService: { oilChange: 5000, tireRotation: 3000 },
        currency: "INR",
      };
      const response = createSuccessResponse(
        result,
        "Owner expenses retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getOwnerServiceHistory: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = [
        { date: "2024-01-15", service: "Oil Change", cost: 5000 },
        { date: "2024-02-20", service: "Tire Rotation", cost: 3000 },
      ];
      const response = createSuccessResponse(
        result,
        "Service history retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getUpcomingServices: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = [
        { service: "Oil Change", dueDate: "2024-04-01", mileage: 55000 },
      ];
      const response = createSuccessResponse(
        result,
        "Upcoming services retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getMaintenanceSummary: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { scheduled: 5, completed: 10, missed: 2 };
      const response = createSuccessResponse(
        result,
        "Maintenance summary retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getTenantsReport: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { total: 50, active: 45, inactive: 5 };
      const response = createSuccessResponse(
        result,
        "Tenants report retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getSaaSRevenue: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { total: 500000, monthly: 50000, arpu: 1000 };
      const response = createSuccessResponse(
        result,
        "SaaS revenue retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getGrowthMetrics: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { newTenants: 10, churnRate: "2%", growthRate: "15%" };
      const response = createSuccessResponse(
        result,
        "Growth metrics retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getRetentionReport: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { retentionRate: "95%", ltv: 5000 };
      const response = createSuccessResponse(
        result,
        "Retention report retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getChurnReport: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { churnRate: "2%", churnedTenants: 1 };
      const response = createSuccessResponse(
        result,
        "Churn report retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  exportReport: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        url: "/uploads/reports/export.csv",
        type: req.body.type,
      };
      const response = createSuccessResponse(
        result,
        "Report exported successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),
};

router.get("/reports/dashboard", reportController.getDashboard);
router.get(
  "/reports/service-center/revenue",
  reportController.getCenterRevenue,
);
router.get(
  "/reports/service-center/vehicles",
  reportController.getCenterVehiclesReport,
);
router.get(
  "/reports/service-center/services",
  reportController.getCenterServicesReport,
);
router.get(
  "/reports/service-center/staff-performance",
  reportController.getStaffPerformance,
);
router.get(
  "/reports/service-center/customer-satisfaction",
  reportController.getCustomerSatisfaction,
);
router.get(
  "/reports/service-center/parts-usage",
  reportController.getPartsUsage,
);
router.get("/reports/owner/expenses", reportController.getOwnerExpenses);
router.get(
  "/reports/owner/service-history",
  reportController.getOwnerServiceHistory,
);
router.get(
  "/reports/owner/upcoming-services",
  reportController.getUpcomingServices,
);
router.get(
  "/reports/owner/maintenance-summary",
  reportController.getMaintenanceSummary,
);
router.get("/reports/admin/tenants", reportController.getTenantsReport);
router.get("/reports/admin/revenue", reportController.getSaaSRevenue);
router.get("/reports/admin/growth", reportController.getGrowthMetrics);
router.get("/reports/admin/retention", reportController.getRetentionReport);
router.get("/reports/admin/churn", reportController.getChurnReport);
router.post("/reports/export", reportController.exportReport);

export default router;
