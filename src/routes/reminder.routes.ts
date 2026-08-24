import { Router, Request, Response } from "express";
import { asyncHandler } from "../utils";
import { authenticate } from "../middleware/auth.middleware";
import {
  validate,
  validateParams,
  ValidatedRequest,
} from "../middleware/validation.middleware";
import {
  CreateReminderSchema,
  UpdateReminderSchema,
  SnoozeReminderSchema,
  BulkReminderActionSchema,
} from "../dto/reminder.dto";
import { IdParamSchema } from "../dto/account.dto";
import { ReminderController } from "../controllers/reminder.controller";
import { reminderService } from "../services/reminder.service";

const router = Router();

const reminderController = new ReminderController(reminderService);

router.use(authenticate);

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    await reminderController.getAllReminders(req, res);
  }),
);

router.get(
  "/upcoming",
  asyncHandler(async (req: Request, res: Response) => {
    await reminderController.getUpcomingReminders(req, res);
  }),
);

router.get(
  "/overdue",
  asyncHandler(async (req: Request, res: Response) => {
    await reminderController.getOverdueReminders(req, res);
  }),
);

router.get(
  "/:id",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await reminderController.getReminderById(req, res);
  }),
);

router.post(
  "/",
  validate(CreateReminderSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await reminderController.createReminder(req, res);
  }),
);

router.put(
  "/:id",
  validateParams(IdParamSchema),
  validate(UpdateReminderSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await reminderController.updateReminder(req, res);
  }),
);

router.delete(
  "/:id",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await reminderController.deleteReminder(req, res);
  }),
);

router.post(
  "/:id/acknowledge",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await reminderController.acknowledgeReminder(req, res);
  }),
);

router.post(
  "/:id/snooze",
  validateParams(IdParamSchema),
  validate(SnoozeReminderSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await reminderController.snoozeReminder(req, res);
  }),
);

router.post(
  "/:id/complete",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await reminderController.completeReminder(req, res);
  }),
);

router.post(
  "/:id/cancel",
  validateParams(IdParamSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await reminderController.cancelReminder(req, res);
  }),
);

router.post(
  "/bulk/acknowledge",
  validate(BulkReminderActionSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await reminderController.bulkAcknowledge(req, res);
  }),
);

router.post(
  "/bulk/cancel",
  validate(BulkReminderActionSchema),
  asyncHandler(async (req: ValidatedRequest<any>, res: Response) => {
    await reminderController.bulkCancel(req, res);
  }),
);

export default router;
