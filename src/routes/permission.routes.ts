import { Router, Request, Response, NextFunction } from "express";
import { asyncHandler, createSuccessResponse, HttpStatus } from "../utils";

const router = Router();

const permissionController = {
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

const roleController = {
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

router.get("/permissions", permissionController.getAllPermissions);
router.get("/permissions/:id", permissionController.getPermissionById);
router.post("/permissions", permissionController.createPermission);
router.put("/permissions/:id", permissionController.updatePermission);
router.delete("/permissions/:id", permissionController.deletePermission);
router.post("/permissions/seed", permissionController.seedDefaultPermissions);

router.get("/roles", roleController.getAllRoles);
router.get("/roles/:id", roleController.getRoleById);
router.post("/roles", roleController.createRole);
router.put("/roles/:id", roleController.updateRole);
router.delete("/roles/:id", roleController.deleteRole);
router.get("/roles/:id/permissions", roleController.getRolePermissions);
router.post("/roles/:id/permissions", roleController.addPermissionToRole);
router.delete(
  "/roles/:id/permissions/:permissionId",
  roleController.removePermissionFromRole,
);
router.post("/roles/:id/assign", roleController.assignRoleToUser);
router.delete(
  "/roles/:id/assign/:accountId",
  roleController.removeRoleFromUser,
);
router.post("/roles/seed", roleController.seedSystemRoles);

export default router;
