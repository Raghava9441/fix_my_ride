import { Router, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils";
import {
  validate,
  validateParams,
  ValidatedRequest,
} from "../middleware/validation.middleware";
import { authenticate } from "../middleware/auth.middleware";
import {
  CreateStaffSchema,
  UpdateStaffSchema,
  UpdateStaffScheduleSchema,
  AddCustomPermissionSchema,
} from "../dto/staff.dto";
import { IdParamSchema } from "../dto/common.dto";
import { StaffController } from "../controllers/staff.controller";
import { staffProfileService } from "../services/staff.service";
import { serviceRecordService } from "../services/serviceRecord.service";

const router = Router();

router.use(authenticate);

const staffController = new StaffController(
  staffProfileService,
  serviceRecordService,
);

router.get(
  "/",
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await staffController.getAll(req, res);
  }),
);

router.get(
  "/:id",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await staffController.getById(req, res);
  }),
);

router.post(
  "/",
  validate(CreateStaffSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await staffController.create(req, res);
  }),
);

router.put(
  "/:id",
  validateParams(IdParamSchema),
  validate(UpdateStaffSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await staffController.update(req, res);
  }),
);

router.delete(
  "/:id",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await staffController.delete(req, res);
  }),
);

router.get(
  "/:id/permissions",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await staffController.getPermissions(req, res);
  }),
);

router.post(
  "/:id/permissions",
  validateParams(IdParamSchema),
  validate(AddCustomPermissionSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await staffController.addPermission(req, res);
  }),
);

router.delete(
  "/:id/permissions/:permissionId",
  validateParams(
    z.object({
      id: IdParamSchema.shape.id,
      permissionId: IdParamSchema.shape.id,
    }),
  ),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await staffController.removePermission(req, res);
  }),
);

router.get(
  "/:id/schedule",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await staffController.getSchedule(req, res);
  }),
);

router.put(
  "/:id/schedule",
  validateParams(IdParamSchema),
  validate(UpdateStaffScheduleSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await staffController.updateSchedule(req, res);
  }),
);

router.get(
  "/:id/performance",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await staffController.getPerformance(req, res);
  }),
);

router.get(
  "/:id/services",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await staffController.getStaffServices(req, res);
  }),
);

export default router;
