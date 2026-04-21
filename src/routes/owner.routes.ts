import { Router, Request, Response, NextFunction } from "express";
import { asyncHandler, createSuccessResponse, HttpStatus } from "../utils";

const router = Router();

const ownerController = {
  getAllOwners: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = [
        { id: "owner-1", name: "John Doe", email: "john@example.com" },
        { id: "owner-2", name: "Jane Smith", email: "jane@example.com" },
      ];
      const response = createSuccessResponse(
        result,
        "Owners retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getOwnerById: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        id: req.params.id,
        name: "John Doe",
        email: "john@example.com",
        phone: "+1234567890",
      };
      const response = createSuccessResponse(
        result,
        "Owner retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  updateOwner: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { id: req.params.id, ...req.body };
      const response = createSuccessResponse(
        result,
        "Owner updated successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  deleteOwner: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        id: req.params.id,
        deleted: true,
        deletedAt: new Date().toISOString(),
      };
      const response = createSuccessResponse(
        result,
        "Owner deleted successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getOwnerVehicles: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = [
        {
          id: "vehicle-1",
          registrationNumber: "ABC-1234",
          make: "Toyota",
          model: "Camry",
        },
        {
          id: "vehicle-2",
          registrationNumber: "XYZ-5678",
          make: "Honda",
          model: "Civic",
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

  addVehicleToOwner: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        id: "new-vehicle-id",
        ...req.body,
        ownerId: req.params.id,
      };
      const response = createSuccessResponse(
        result,
        "Vehicle added successfully",
        HttpStatus.CREATED,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getServiceHistory: asyncHandler(
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
        "Service history retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getExpenses: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        total: 8000,
        currency: "INR",
        breakdown: { oilChange: 5000, tireRotation: 3000 },
      };
      const response = createSuccessResponse(
        result,
        "Expenses retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getNotifications: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = [
        {
          id: "notif-1",
          title: "Service Due",
          message: "Your vehicle needs service",
          read: false,
        },
        {
          id: "notif-2",
          title: "Reminder",
          message: "Insurance renewal",
          read: true,
        },
      ];
      const response = createSuccessResponse(
        result,
        "Notifications retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  markNotificationRead: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { id: req.params.notificationId, read: true };
      const response = createSuccessResponse(
        result,
        "Notification marked as read",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  deleteNotifications: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { deleted: true, count: 2 };
      const response = createSuccessResponse(
        result,
        "Notifications deleted successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getPreferences: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { language: "en", notifications: true, theme: "light" };
      const response = createSuccessResponse(
        result,
        "Preferences retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  updatePreferences: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { id: req.params.id, ...req.body };
      const response = createSuccessResponse(
        result,
        "Preferences updated successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),
};

router.get("/owners", ownerController.getAllOwners);
router.get("/owners/:id", ownerController.getOwnerById);
router.put("/owners/:id", ownerController.updateOwner);
router.delete("/owners/:id", ownerController.deleteOwner);
router.get("/owners/:id/vehicles", ownerController.getOwnerVehicles);
router.post("/owners/:id/vehicles", ownerController.addVehicleToOwner);
router.get("/owners/:id/service-history", ownerController.getServiceHistory);
router.get("/owners/:id/expenses", ownerController.getExpenses);
router.get("/owners/:id/notifications", ownerController.getNotifications);
router.patch(
  "/owners/:id/notifications/:notificationId/read",
  ownerController.markNotificationRead,
);
router.delete("/owners/:id/notifications", ownerController.deleteNotifications);
router.get("/owners/:id/preferences", ownerController.getPreferences);
router.put("/owners/:id/preferences", ownerController.updatePreferences);

export default router;
