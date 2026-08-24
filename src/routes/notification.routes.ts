import { Router, Request, Response } from "express";
import { asyncHandler } from "../utils";
import { authenticate } from "../middleware/auth.middleware";
import { validateParams, ValidatedRequest } from "../middleware/validation.middleware";
import { IdParamSchema } from "../dto/account.dto";
import { NotificationController } from "../controllers/notification.controller";
import { notificationService } from "../services/notification.service";

const router = Router();

const notificationController = new NotificationController(notificationService);

router.use(authenticate);

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    await notificationController.getMine(req, res);
  }),
);

router.get(
  "/unread",
  asyncHandler(async (req: Request, res: Response) => {
    await notificationController.getUnread(req, res);
  }),
);

router.get(
  "/stats",
  asyncHandler(async (req: Request, res: Response) => {
    await notificationController.getStats(req, res);
  }),
);

router.post(
  "/read-all",
  asyncHandler(async (req: Request, res: Response) => {
    await notificationController.markAllAsRead(req, res);
  }),
);

router.get(
  "/:id",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await notificationController.getById(req, res);
  }),
);

router.patch(
  "/:id/read",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await notificationController.markAsRead(req, res);
  }),
);

router.patch(
  "/:id/clicked",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await notificationController.markAsClicked(req, res);
  }),
);

router.delete(
  "/:id",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await notificationController.delete(req, res);
  }),
);

export default router;
