import { Router, Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils";
import {
  validate,
  validateParams,
  ValidatedRequest,
} from "../middleware/validation.middleware";
import {
  CreateRoleSchema,
  UpdateRoleSchema,
  AddPermissionToRoleSchema,
} from "../dto/role.dto";
import { IdParamSchema } from "../dto/account.dto";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/authorization.middleware";
import { RoleController } from "../controllers/role.controller";
import { roleService } from "../services/role.service";

const router = Router();

const roleController = new RoleController(roleService);

router.use(authenticate);

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    await roleController.getAllRoles(req, res);
  }),
);

router.get(
  "/:id",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    req.params.id = req.validated?.id || req.params.id;
    await roleController.getRoleById(req, res);
  }),
);

router.post(
  "/",
  requireRole("admin"),
  validate(CreateRoleSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await roleController.createRole(req, res);
  }),
);

router.put(
  "/:id",
  requireRole("admin"),
  validateParams(IdParamSchema),
  validate(UpdateRoleSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await roleController.updateRole(req, res);
  }),
);

router.delete(
  "/:id",
  requireRole("admin"),
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await roleController.deleteRole(req, res);
  }),
);

router.get(
  "/:id/permissions",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await roleController.getRolePermissions(req, res);
  }),
);

router.post(
  "/:id/permissions",
  requireRole("admin"),
  validateParams(IdParamSchema),
  validate(AddPermissionToRoleSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await roleController.addPermissionToRole(req, res);
  }),
);

router.delete(
  "/:id/permissions/:permissionId",
  requireRole("admin"),
  validateParams(
    z.object({
      id: IdParamSchema.shape.id,
      permissionId: z.string().min(1),
    }),
  ),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await roleController.removePermissionFromRole(req, res);
  }),
);

router.post(
  "/:id/assign",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await roleController.assignRoleToUser(req, res);
  }),
);

router.delete(
  "/:id/assign/:accountId",
  validateParams(
    z.object({
      id: IdParamSchema.shape.id,
      accountId: IdParamSchema.shape.id,
    }),
  ),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await roleController.removeRoleFromUser(req, res);
  }),
);

router.post(
  "/seed",
  requireRole("admin"),
  asyncHandler(async (req: Request, res: Response) => {
    await roleController.seedSystemRoles(req, res);
  }),
);

export default router;
