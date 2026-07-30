import { Request, Response, NextFunction } from "express";
import { asyncHandler, createSuccessResponse, HttpStatus } from "../utils";

export const roleController = {
  getAllRoles: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = [
        { id: "role-1", name: "Owner", description: "Vehicle owner" },
        { id: "role-2", name: "Staff", description: "Service center staff" },
      ];
      const response = createSuccessResponse(
        result,
        "Roles retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getRoleById: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        id: req.params.id,
        name: "Owner",
        description: "Vehicle owner",
      };
      const response = createSuccessResponse(
        result,
        "Role retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  createRole: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { id: "new-role-id", ...req.body };
      const response = createSuccessResponse(
        result,
        "Role created successfully",
        HttpStatus.CREATED,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  updateRole: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { id: req.params.id, ...req.body };
      const response = createSuccessResponse(
        result,
        "Role updated successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  deleteRole: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { id: req.params.id, deleted: true };
      const response = createSuccessResponse(
        result,
        "Role deleted successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getRolePermissions: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = [
        { id: "perm-1", name: "view_vehicles" },
        { id: "perm-2", name: "create_service_record" },
      ];
      const response = createSuccessResponse(
        result,
        "Role permissions retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  addPermissionToRole: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        roleId: req.params.id,
        permissionId: req.body.permissionId,
      };
      const response = createSuccessResponse(
        result,
        "Permission added to role successfully",
        HttpStatus.CREATED,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  removePermissionFromRole: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        roleId: req.params.id,
        permissionId: req.params.permissionId,
        removed: true,
      };
      const response = createSuccessResponse(
        result,
        "Permission removed from role successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  assignRoleToUser: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { roleId: req.params.id, accountId: req.body.accountId };
      const response = createSuccessResponse(
        result,
        "Role assigned to user successfully",
        HttpStatus.CREATED,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  removeRoleFromUser: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        roleId: req.params.id,
        accountId: req.params.accountId,
        removed: true,
      };
      const response = createSuccessResponse(
        result,
        "Role removed from user successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  seedSystemRoles: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { seeded: 5 };
      const response = createSuccessResponse(
        result,
        "System roles seeded successfully",
        HttpStatus.CREATED,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),
};
