import { Router, Request, Response, NextFunction } from "express";
import { asyncHandler, createSuccessResponse, HttpStatus } from "../utils";

const router = Router();

const reminderController = {
  getAllReminders: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = [
        {
          id: "reminder-1",
          type: "service",
          title: "Oil Change Due",
          dueDate: "2024-04-01",
          completed: false,
        },
        {
          id: "reminder-2",
          type: "insurance",
          title: "Insurance Renewal",
          dueDate: "2024-05-01",
          completed: false,
        },
      ];
      const response = createSuccessResponse(
        result,
        "Reminders retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getUpcomingReminders: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = [
        {
          id: "reminder-1",
          type: "service",
          title: "Oil Change Due",
          dueDate: "2024-04-01",
          completed: false,
        },
      ];
      const response = createSuccessResponse(
        result,
        "Upcoming reminders retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getOverdueReminders: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = [
        {
          id: "reminder-1",
          type: "service",
          title: "Tire Rotation Overdue",
          dueDate: "2024-03-01",
          completed: false,
        },
      ];
      const response = createSuccessResponse(
        result,
        "Overdue reminders retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getReminderById: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        id: req.params.id,
        type: "service",
        title: "Oil Change Due",
        completed: false,
      };
      const response = createSuccessResponse(
        result,
        "Reminder retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  createReminder: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { id: "new-reminder-id", ...req.body, status: "pending" };
      const response = createSuccessResponse(
        result,
        "Reminder created successfully",
        HttpStatus.CREATED,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  updateReminder: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { id: req.params.id, ...req.body };
      const response = createSuccessResponse(
        result,
        "Reminder updated successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  deleteReminder: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { id: req.params.id, deleted: true };
      const response = createSuccessResponse(
        result,
        "Reminder deleted successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  acknowledgeReminder: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        id: req.params.id,
        acknowledged: true,
        acknowledgedAt: new Date().toISOString(),
      };
      const response = createSuccessResponse(
        result,
        "Reminder acknowledged successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  snoozeReminder: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        id: req.params.id,
        snoozedUntil: req.body.until || "2024-04-15",
      };
      const response = createSuccessResponse(
        result,
        "Reminder snoozed successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  completeReminder: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        id: req.params.id,
        completed: true,
        completedAt: new Date().toISOString(),
      };
      const response = createSuccessResponse(
        result,
        "Reminder completed successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  cancelReminder: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { id: req.params.id, status: "cancelled" };
      const response = createSuccessResponse(
        result,
        "Reminder cancelled successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  bulkAcknowledge: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { acknowledged: 5, ids: req.body.ids };
      const response = createSuccessResponse(
        result,
        "Reminders acknowledged successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  bulkCancel: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { cancelled: 3, ids: req.body.ids };
      const response = createSuccessResponse(
        result,
        "Reminders cancelled successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),
};

router.get("/reminders", reminderController.getAllReminders);
router.get("/reminders/upcoming", reminderController.getUpcomingReminders);
router.get("/reminders/overdue", reminderController.getOverdueReminders);
router.get("/reminders/:id", reminderController.getReminderById);
router.post("/reminders", reminderController.createReminder);
router.put("/reminders/:id", reminderController.updateReminder);
router.delete("/reminders/:id", reminderController.deleteReminder);
router.post(
  "/reminders/:id/acknowledge",
  reminderController.acknowledgeReminder,
);
router.post("/reminders/:id/snooze", reminderController.snoozeReminder);
router.post("/reminders/:id/complete", reminderController.completeReminder);
router.post("/reminders/:id/cancel", reminderController.cancelReminder);
router.post("/reminders/bulk/acknowledge", reminderController.bulkAcknowledge);
router.post("/reminders/bulk/cancel", reminderController.bulkCancel);

export default router;
