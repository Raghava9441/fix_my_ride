import { Router, Request, Response, NextFunction } from "express";
import { asyncHandler, createSuccessResponse, HttpStatus } from "../utils";

const router = Router();

const staffController = {
  getAllStaff: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = [
        {
          id: "staff-1",
          name: "Mike Johnson",
          role: "Mechanic",
          status: "active",
        },
        {
          id: "staff-2",
          name: "Sarah Williams",
          role: "Receptionist",
          status: "active",
        },
      ];
      const response = createSuccessResponse(
        result,
        "Staff retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getStaffById: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        id: req.params.id,
        name: "Mike Johnson",
        role: "Mechanic",
        status: "active",
      };
      const response = createSuccessResponse(
        result,
        "Staff retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  createStaff: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { id: "new-staff-id", ...req.body, status: "active" };
      const response = createSuccessResponse(
        result,
        "Staff created successfully",
        HttpStatus.CREATED,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  updateStaff: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { id: req.params.id, ...req.body };
      const response = createSuccessResponse(
        result,
        "Staff updated successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  deleteStaff: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        id: req.params.id,
        deleted: true,
        deletedAt: new Date().toISOString(),
      };
      const response = createSuccessResponse(
        result,
        "Staff deleted successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getStaffPermissions: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = [
        {
          id: "perm-1",
          name: "create_service_record",
          description: "Can create service records",
        },
      ];
      const response = createSuccessResponse(
        result,
        "Permissions retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  addPermission: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        staffId: req.params.id,
        permissionId: req.body.permissionId,
      };
      const response = createSuccessResponse(
        result,
        "Permission added successfully",
        HttpStatus.CREATED,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  removePermission: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        staffId: req.params.id,
        permissionId: req.params.permissionId,
        removed: true,
      };
      const response = createSuccessResponse(
        result,
        "Permission removed successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getSchedule: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        monday: "9AM-6PM",
        tuesday: "9AM-6PM",
        wednesday: "9AM-6PM",
      };
      const response = createSuccessResponse(
        result,
        "Schedule retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  updateSchedule: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { staffId: req.params.id, ...req.body };
      const response = createSuccessResponse(
        result,
        "Schedule updated successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getPerformance: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        servicesCompleted: 50,
        rating: 4.5,
        averageTime: "45 min",
      };
      const response = createSuccessResponse(
        result,
        "Performance retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getStaffServices: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = [
        { id: "service-1", name: "Oil Change", count: 20 },
        { id: "service-2", name: "Tire Rotation", count: 15 },
      ];
      const response = createSuccessResponse(
        result,
        "Staff services retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),
};

router.get("/staff", staffController.getAllStaff);
router.get("/staff/:id", staffController.getStaffById);
router.post("/staff", staffController.createStaff);
router.put("/staff/:id", staffController.updateStaff);
router.delete("/staff/:id", staffController.deleteStaff);
router.get("/staff/:id/permissions", staffController.getStaffPermissions);
router.post("/staff/:id/permissions", staffController.addPermission);
router.delete(
  "/staff/:id/permissions/:permissionId",
  staffController.removePermission,
);
router.get("/staff/:id/schedule", staffController.getSchedule);
router.put("/staff/:id/schedule", staffController.updateSchedule);
router.get("/staff/:id/performance", staffController.getPerformance);
router.get("/staff/:id/services", staffController.getStaffServices);

export default router;
