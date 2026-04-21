import { Router, Request, Response, NextFunction } from "express";
import { asyncHandler, createSuccessResponse, HttpStatus } from "../utils";

const router = Router();

const vehicleController = {
  getAllVehicles: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = [
        {
          id: "vehicle-1",
          registrationNumber: "ABC-1234",
          make: "Toyota",
          model: "Camry",
          year: 2022,
        },
        {
          id: "vehicle-2",
          registrationNumber: "XYZ-5678",
          make: "Honda",
          model: "Civic",
          year: 2021,
        },
      ];
      const response = createSuccessResponse(
        result,
        "Vehicles retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  searchVehicles: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = [
        { id: "vehicle-1", registrationNumber: "ABC-1234", make: "Toyota" },
      ];
      const response = createSuccessResponse(
        result,
        "Vehicles found successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getVehicleByRegistration: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        id: "vehicle-1",
        registrationNumber: req.params.regNumber,
        make: "Toyota",
        model: "Camry",
      };
      const response = createSuccessResponse(
        result,
        "Vehicle retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getVehicleByVin: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        id: "vehicle-1",
        vin: req.params.vin,
        make: "Toyota",
        model: "Camry",
      };
      const response = createSuccessResponse(
        result,
        "Vehicle retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getVehicleById: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        id: req.params.id,
        registrationNumber: "ABC-1234",
        make: "Toyota",
        model: "Camry",
        year: 2022,
      };
      const response = createSuccessResponse(
        result,
        "Vehicle retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  createVehicle: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { id: "new-vehicle-id", ...req.body, status: "active" };
      const response = createSuccessResponse(
        result,
        "Vehicle created successfully",
        HttpStatus.CREATED,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  updateVehicle: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { id: req.params.id, ...req.body };
      const response = createSuccessResponse(
        result,
        "Vehicle updated successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  deleteVehicle: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        id: req.params.id,
        deleted: true,
        deletedAt: new Date().toISOString(),
      };
      const response = createSuccessResponse(
        result,
        "Vehicle deleted successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getServiceRecords: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = [
        {
          id: "record-1",
          serviceDate: "2024-01-15",
          serviceType: "oil-change",
          cost: 5000,
        },
        {
          id: "record-2",
          serviceDate: "2024-02-20",
          serviceType: "tire-rotation",
          cost: 3000,
        },
      ];
      const response = createSuccessResponse(
        result,
        "Service records retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getAuthorizedCenters: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = [
        { id: "center-1", name: "Quick Fix Auto", authorized: true },
        { id: "center-2", name: "Premium Motors", authorized: true },
      ];
      const response = createSuccessResponse(
        result,
        "Authorized centers retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  authorizeCenter: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        vehicleId: req.params.id,
        centerId: req.body.centerId,
        authorized: true,
      };
      const response = createSuccessResponse(
        result,
        "Center authorized successfully",
        HttpStatus.CREATED,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  updateCenterAccess: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        vehicleId: req.params.id,
        centerId: req.params.centerId,
        ...req.body,
      };
      const response = createSuccessResponse(
        result,
        "Center access updated successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  revokeCenterAccess: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        vehicleId: req.params.id,
        centerId: req.params.centerId,
        authorized: false,
      };
      const response = createSuccessResponse(
        result,
        "Center access revoked successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getCurrentOdometer: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        reading: 50000,
        unit: "km",
        updatedAt: new Date().toISOString(),
      };
      const response = createSuccessResponse(
        result,
        "Odometer reading retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  updateOdometer: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        vehicleId: req.params.id,
        reading: req.body.reading,
        updatedAt: new Date().toISOString(),
      };
      const response = createSuccessResponse(
        result,
        "Odometer updated successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getOdometerHistory: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = [
        { reading: 45000, date: "2024-01-01" },
        { reading: 50000, date: "2024-03-01" },
      ];
      const response = createSuccessResponse(
        result,
        "Odometer history retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getDocuments: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = [
        { id: "doc-1", name: "Registration", type: "pdf" },
        { id: "doc-2", name: "Insurance", type: "pdf" },
      ];
      const response = createSuccessResponse(
        result,
        "Documents retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  uploadDocument: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        id: "new-doc-id",
        vehicleId: req.params.id,
        ...req.body,
      };
      const response = createSuccessResponse(
        result,
        "Document uploaded successfully",
        HttpStatus.CREATED,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  deleteDocument: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { id: req.params.documentId, deleted: true };
      const response = createSuccessResponse(
        result,
        "Document deleted successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  downloadDocument: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { url: "/uploads/documents/document.pdf" };
      const response = createSuccessResponse(
        result,
        "Document download URL retrieved",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getReminders: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = [
        {
          id: "reminder-1",
          type: "service",
          dueDate: "2024-04-01",
          completed: false,
        },
      ];
      const response = createSuccessResponse(
        result,
        "Reminders retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getWarranty: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        provider: "Toyota",
        expires: "2025-12-31",
        coverage: "5 years",
      };
      const response = createSuccessResponse(
        result,
        "Warranty information retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  updateWarranty: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { vehicleId: req.params.id, ...req.body };
      const response = createSuccessResponse(
        result,
        "Warranty updated successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getInsurance: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        provider: "ABC Insurance",
        policyNumber: "POL-123456",
        expires: "2025-06-30",
      };
      const response = createSuccessResponse(
        result,
        "Insurance information retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  updateInsurance: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { vehicleId: req.params.id, ...req.body };
      const response = createSuccessResponse(
        result,
        "Insurance updated successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  transferOwnership: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        vehicleId: req.params.id,
        previousOwnerId: "old-owner",
        newOwnerId: req.body.newOwnerId,
      };
      const response = createSuccessResponse(
        result,
        "Ownership transferred successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getVehicleStats: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        totalServiceCost: 8000,
        serviceCount: 5,
        averageServiceInterval: "60 days",
      };
      const response = createSuccessResponse(
        result,
        "Vehicle stats retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),
};

router.get("/vehicles", vehicleController.getAllVehicles);
router.get("/vehicles/search", vehicleController.searchVehicles);
router.get(
  "/vehicles/registration/:regNumber",
  vehicleController.getVehicleByRegistration,
);
router.get("/vehicles/vin/:vin", vehicleController.getVehicleByVin);
router.get("/vehicles/:id", vehicleController.getVehicleById);
router.post("/vehicles", vehicleController.createVehicle);
router.put("/vehicles/:id", vehicleController.updateVehicle);
router.delete("/vehicles/:id", vehicleController.deleteVehicle);
router.get(
  "/vehicles/:id/service-records",
  vehicleController.getServiceRecords,
);
router.get(
  "/vehicles/:id/service-centers",
  vehicleController.getAuthorizedCenters,
);
router.post("/vehicles/:id/service-centers", vehicleController.authorizeCenter);
router.put(
  "/vehicles/:id/service-centers/:centerId",
  vehicleController.updateCenterAccess,
);
router.delete(
  "/vehicles/:id/service-centers/:centerId",
  vehicleController.revokeCenterAccess,
);
router.get("/vehicles/:id/odometer", vehicleController.getCurrentOdometer);
router.post("/vehicles/:id/odometer", vehicleController.updateOdometer);
router.get(
  "/vehicles/:id/odometer/history",
  vehicleController.getOdometerHistory,
);
router.get("/vehicles/:id/documents", vehicleController.getDocuments);
router.post("/vehicles/:id/documents", vehicleController.uploadDocument);
router.delete(
  "/vehicles/:id/documents/:documentId",
  vehicleController.deleteDocument,
);
router.get(
  "/vehicles/:id/documents/:documentId/download",
  vehicleController.downloadDocument,
);
router.get("/vehicles/:id/reminders", vehicleController.getReminders);
router.get("/vehicles/:id/warranty", vehicleController.getWarranty);
router.put("/vehicles/:id/warranty", vehicleController.updateWarranty);
router.get("/vehicles/:id/insurance", vehicleController.getInsurance);
router.put("/vehicles/:id/insurance", vehicleController.updateInsurance);
router.post("/vehicles/:id/transfer", vehicleController.transferOwnership);
router.get("/vehicles/:id/stats", vehicleController.getVehicleStats);

export default router;
