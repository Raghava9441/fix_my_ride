import { Router, Request, Response, NextFunction } from "express";
import { asyncHandler, createSuccessResponse, HttpStatus } from "../utils";

const router = Router();

const serviceCenterController = {
  getAllServiceCenters: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = [
        {
          id: "center-1",
          name: "Quick Fix Auto",
          address: "123 Main St",
          rating: 4.5,
        },
        {
          id: "center-2",
          name: "Premium Motors",
          address: "456 Oak Ave",
          rating: 4.8,
        },
      ];
      const response = createSuccessResponse(
        result,
        "Service centers retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getNearbyCenters: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = [
        {
          id: "center-1",
          name: "Quick Fix Auto",
          distance: "2.5 km",
          rating: 4.5,
        },
      ];
      const response = createSuccessResponse(
        result,
        "Nearby centers retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getServiceCenterById: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        id: req.params.id,
        name: "Quick Fix Auto",
        address: "123 Main St",
        phone: "+1234567890",
        rating: 4.5,
        verified: true,
      };
      const response = createSuccessResponse(
        result,
        "Service center retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  createServiceCenter: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { id: "new-center-id", ...req.body, status: "active" };
      const response = createSuccessResponse(
        result,
        "Service center created successfully",
        HttpStatus.CREATED,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  updateServiceCenter: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { id: req.params.id, ...req.body };
      const response = createSuccessResponse(
        result,
        "Service center updated successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  deleteServiceCenter: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        id: req.params.id,
        deleted: true,
        deletedAt: new Date().toISOString(),
      };
      const response = createSuccessResponse(
        result,
        "Service center deleted successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getCenterVehicles: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = [
        { id: "vehicle-1", registrationNumber: "ABC-1234", make: "Toyota" },
        { id: "vehicle-2", registrationNumber: "XYZ-5678", make: "Honda" },
      ];
      const response = createSuccessResponse(
        result,
        "Center vehicles retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getCenterStaff: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = [
        { id: "staff-1", name: "Mike Johnson", role: "Mechanic" },
        { id: "staff-2", name: "Sarah Williams", role: "Receptionist" },
      ];
      const response = createSuccessResponse(
        result,
        "Center staff retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getCenterServices: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = [
        {
          id: "service-1",
          name: "Oil Change",
          price: 5000,
          duration: "30 min",
        },
        {
          id: "service-2",
          name: "Tire Rotation",
          price: 3000,
          duration: "20 min",
        },
      ];
      const response = createSuccessResponse(
        result,
        "Services retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  addService: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { id: "new-service-id", ...req.body };
      const response = createSuccessResponse(
        result,
        "Service added successfully",
        HttpStatus.CREATED,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  updateService: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { id: req.params.serviceId, ...req.body };
      const response = createSuccessResponse(
        result,
        "Service updated successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  deleteService: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { id: req.params.serviceId, deleted: true };
      const response = createSuccessResponse(
        result,
        "Service deleted successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getCenterStats: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        totalVehicles: 150,
        totalServices: 320,
        revenue: 250000,
        rating: 4.5,
      };
      const response = createSuccessResponse(
        result,
        "Stats retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getCenterReviews: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = [
        { id: "review-1", rating: 5, comment: "Great service!" },
        { id: "review-2", rating: 4, comment: "Good experience" },
      ];
      const response = createSuccessResponse(
        result,
        "Reviews retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  addReview: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        id: "new-review-id",
        ...req.body,
        createdAt: new Date().toISOString(),
      };
      const response = createSuccessResponse(
        result,
        "Review added successfully",
        HttpStatus.CREATED,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  verifyCenter: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        id: req.params.id,
        verified: true,
        verifiedAt: new Date().toISOString(),
      };
      const response = createSuccessResponse(
        result,
        "Center verified successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  uploadDocument: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        id: "doc-id",
        filename: "document.pdf",
        url: "/uploads/doc.pdf",
      };
      const response = createSuccessResponse(
        result,
        "Document uploaded successfully",
        HttpStatus.CREATED,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getDocuments: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = [
        { id: "doc-1", filename: "license.pdf", url: "/uploads/license.pdf" },
        {
          id: "doc-2",
          filename: "insurance.pdf",
          url: "/uploads/insurance.pdf",
        },
      ];
      const response = createSuccessResponse(
        result,
        "Documents retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getSettings: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { workingHours: "9AM-6PM", allowOnlineBooking: true };
      const response = createSuccessResponse(
        result,
        "Settings retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  updateSettings: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { id: req.params.id, ...req.body };
      const response = createSuccessResponse(
        result,
        "Settings updated successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),
};

router.get("/service-centers", serviceCenterController.getAllServiceCenters);
router.get("/service-centers/nearby", serviceCenterController.getNearbyCenters);
router.get(
  "/service-centers/:id",
  serviceCenterController.getServiceCenterById,
);
router.post("/service-centers", serviceCenterController.createServiceCenter);
router.put("/service-centers/:id", serviceCenterController.updateServiceCenter);
router.delete(
  "/service-centers/:id",
  serviceCenterController.deleteServiceCenter,
);
router.get(
  "/service-centers/:id/vehicles",
  serviceCenterController.getCenterVehicles,
);
router.get(
  "/service-centers/:id/staff",
  serviceCenterController.getCenterStaff,
);
router.get(
  "/service-centers/:id/services",
  serviceCenterController.getCenterServices,
);
router.post(
  "/service-centers/:id/services",
  serviceCenterController.addService,
);
router.put(
  "/service-centers/:id/services/:serviceId",
  serviceCenterController.updateService,
);
router.delete(
  "/service-centers/:id/services/:serviceId",
  serviceCenterController.deleteService,
);
router.get(
  "/service-centers/:id/stats",
  serviceCenterController.getCenterStats,
);
router.get(
  "/service-centers/:id/reviews",
  serviceCenterController.getCenterReviews,
);
router.post("/service-centers/:id/reviews", serviceCenterController.addReview);
router.post(
  "/service-centers/:id/verify",
  serviceCenterController.verifyCenter,
);
router.post(
  "/service-centers/:id/documents",
  serviceCenterController.uploadDocument,
);
router.get(
  "/service-centers/:id/documents",
  serviceCenterController.getDocuments,
);
router.get(
  "/service-centers/:id/settings",
  serviceCenterController.getSettings,
);
router.put(
  "/service-centers/:id/settings",
  serviceCenterController.updateSettings,
);

export default router;
