import { Router } from "express";
import { reminderController } from "../controllers/reminder.controller";

const router = Router();

router.get("/", reminderController.getAllReminders);
router.get("/upcoming", reminderController.getUpcomingReminders);
router.get("/overdue", reminderController.getOverdueReminders);
router.get("/:id", reminderController.getReminderById);
router.post("/", reminderController.createReminder);
router.put("/:id", reminderController.updateReminder);
router.delete("/:id", reminderController.deleteReminder);
router.post(
  "/:id/acknowledge",
  reminderController.acknowledgeReminder,
);
router.post("/:id/snooze", reminderController.snoozeReminder);
router.post("/:id/complete", reminderController.completeReminder);
router.post("/:id/cancel", reminderController.cancelReminder);
router.post("/bulk/acknowledge", reminderController.bulkAcknowledge);
router.post("/bulk/cancel", reminderController.bulkCancel);

export default router;
