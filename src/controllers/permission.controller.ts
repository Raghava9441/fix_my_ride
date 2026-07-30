import { Request, Response, NextFunction } from "express";
import { asyncHandler, createSuccessResponse, HttpStatus } from "../utils";

export const permissionController = {
  getAllPermissions: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = [
        {
          id: "perm-1",
          name: "view_vehicles",
          description: "Can view vehicles",
        },
        {
          id: "perm-2",
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

  getPermissionById: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        id: req.params.id,
        name: "view_vehicles",
        description: "Can view vehicles",
      };
      const response = createSuccessResponse(
        result,
        "Permission retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  createPermission: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { id: "new-perm-id", ...req.body };
      const response = createSuccessResponse(
        result,
        "Permission created successfully",
        HttpStatus.CREATED,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  updatePermission: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { id: req.params.id, ...req.body };
      const response = createSuccessResponse(
        result,
        "Permission updated successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  deletePermission: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { id: req.params.id, deleted: true };
      const response = createSuccessResponse(
        result,
        "Permission deleted successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  seedDefaultPermissions: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { seeded: 10 };
      const response = createSuccessResponse(
        result,
        "Default permissions seeded successfully",
        HttpStatus.CREATED,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),
};
