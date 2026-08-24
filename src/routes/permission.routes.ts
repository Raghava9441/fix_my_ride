import { Router, Request, Response } from "express";
import { asyncHandler } from "../utils";
import {
  validate,
  validateParams,
  ValidatedRequest,
} from "../middleware/validation.middleware";
import {
  CreatePermissionSchema,
  UpdatePermissionSchema,
} from "../dto/permission.dto";
import { IdParamSchema } from "../dto/account.dto";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/authorization.middleware";
import { PermissionController } from "../controllers/permission.controller";
import { permissionService } from "../services/permission.service";

const router = Router();

const permissionController = new PermissionController(permissionService);

router.use(authenticate);

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    await permissionController.getAllPermissions(req, res);
  }),
);

router.get(
  "/:id",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    req.params.id = req.validated?.id || req.params.id;
    await permissionController.getPermissionById(req, res);
  }),
);

router.post(
  "/",
  requireRole("admin"),
  validate(CreatePermissionSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await permissionController.createPermission(req, res);
  }),
);

router.put(
  "/:id",
  requireRole("admin"),
  validateParams(IdParamSchema),
  validate(UpdatePermissionSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await permissionController.updatePermission(req, res);
  }),
);

router.delete(
  "/:id",
  requireRole("admin"),
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await permissionController.deletePermission(req, res);
  }),
);

router.post(
  "/seed",
  requireRole("admin"),
  asyncHandler(async (req: Request, res: Response) => {
    await permissionController.seedDefaultPermissions(req, res);
  }),
);

export default router;
