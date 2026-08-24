import { Router, Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils";
import {
  validate,
  validateParams,
  ValidatedRequest,
} from "../middleware/validation.middleware";
import { authenticate } from "../middleware/auth.middleware";
import { UpdateOwnerSchema } from "../dto/owner.dto";
import { IdParamSchema } from "../dto/account.dto";
import { OwnerController } from "../controllers/owner.controller";
import { ownerProfileService } from "../services/owner.service";

const router = Router();

router.use(authenticate);

const ownerController = new OwnerController(ownerProfileService);

// Body schema for adding a vehicle reference to an owner profile.
// No dedicated DTO exists for this in owner.dto.ts, so it's defined
// locally here, reusing the shared ObjectId validation from IdParamSchema.
const AddVehicleToOwnerSchema = z.object({
  vehicleId: IdParamSchema.shape.id,
  isPrimary: z.boolean().optional(),
});

// Compound params schema for the notification-scoped sub-route.
const NotificationParamSchema = z.object({
  id: IdParamSchema.shape.id,
  notificationId: IdParamSchema.shape.id,
});

// Body schema for updating notification preferences. This reuses the
// notificationPreferences shape already defined inside UpdateOwnerSchema
// (which matches the actual OwnerProfile.notificationPreferences field),
// rather than the unrelated UpdateOwnerPreferencesSchema in owner.dto.ts.
const UpdateOwnerPreferencesBodySchema =
  UpdateOwnerSchema.shape.notificationPreferences;

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    await ownerController.getAll(req, res);
  }),
);

router.get(
  "/:id",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    req.params.id = req.validated?.id || req.params.id;
    await ownerController.getById(req, res);
  }),
);

router.put(
  "/:id",
  validateParams(IdParamSchema),
  validate(UpdateOwnerSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await ownerController.update(req, res);
  }),
);

router.delete(
  "/:id",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await ownerController.delete(req, res);
  }),
);

router.get(
  "/:id/vehicles",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await ownerController.getVehicles(req, res);
  }),
);

router.post(
  "/:id/vehicles",
  validateParams(IdParamSchema),
  validate(AddVehicleToOwnerSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await ownerController.addVehicle(req, res);
  }),
);

router.get(
  "/:id/service-history",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await ownerController.getServiceHistory(req, res);
  }),
);

router.get(
  "/:id/expenses",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await ownerController.getExpenses(req, res);
  }),
);

router.get(
  "/:id/notifications",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await ownerController.getNotifications(req, res);
  }),
);

router.patch(
  "/:id/notifications/:notificationId/read",
  validateParams(NotificationParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await ownerController.markNotificationRead(req, res);
  }),
);

router.delete(
  "/:id/notifications",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await ownerController.deleteNotifications(req, res);
  }),
);

router.get(
  "/:id/preferences",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await ownerController.getPreferences(req, res);
  }),
);

router.put(
  "/:id/preferences",
  validateParams(IdParamSchema),
  validate(UpdateOwnerPreferencesBodySchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await ownerController.updatePreferences(req, res);
  }),
);

export default router;
