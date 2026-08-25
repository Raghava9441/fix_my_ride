// src/jobs/reminder.job.ts
import { Reminder } from "../models/Reminder";
import { OwnerProfile } from "../models/OwnerProfile";
import { notificationService } from "../services/notification.service";
import { enqueue } from "../services/queue.service";
import { logger } from "../config/logger";

// Matches EMAIL_QUEUE in src/workers/index.ts — kept as a literal here (rather
// than imported) to avoid a reminder.job -> workers -> scheduler -> reminder.job
// circular import.
const EMAIL_QUEUE = "emails";

const RENOTIFY_AFTER_MS = 24 * 60 * 60 * 1000; // don't re-notify inside 24h of the last attempt

/**
 * Sweeps every tenant for reminders that are due (or overdue) and haven't
 * been notified recently. Runs on a cron tick with no AsyncLocalStorage
 * request context, so the tenantPlugin leaves these queries unscoped by
 * design (see tenantPlugin.ts's "no context -> unscoped" branch) — a
 * cross-tenant sweep is exactly what this job needs to do.
 */
export async function checkReminders(): Promise<{ checked: number; notified: number }> {
  const now = new Date();

  const dueReminders = await Reminder.find({
    status: "pending",
    isDeleted: false,
    $and: [
      {
        $or: [
          { lastNotifiedAt: { $exists: false } },
          { lastNotifiedAt: null },
          { lastNotifiedAt: { $lt: new Date(now.getTime() - RENOTIFY_AFTER_MS) } },
        ],
      },
    ],
  });

  let notified = 0;

  for (const reminder of dueReminders) {
    try {
      const leadTimeMs = (reminder.notificationPreferences?.reminderLeadTime ?? 24) * 60 * 60 * 1000;
      const isDueSoon = reminder.dueDate.getTime() - now.getTime() <= leadTimeMs;
      if (!isDueSoon) continue;

      if (!reminder.notificationPreferences?.email) continue;
      if (!reminder.ownerId) continue;

      const owner = await OwnerProfile.findById(reminder.ownerId);
      if (!owner?.accountId) continue;

      const overdue = reminder.dueDate.getTime() < now.getTime();
      const notification = await notificationService.create({
        tenantId: reminder.tenantId ? String(reminder.tenantId) : undefined,
        recipientId: String(owner.accountId),
        recipientModel: "Account",
        title: overdue ? `Overdue: ${reminder.title}` : `Upcoming: ${reminder.title}`,
        content: `Your ${reminder.type} reminder "${reminder.title}" ${
          overdue ? "was due" : "is due"
        } on ${reminder.dueDate.toDateString()}.${
          reminder.description ? ` ${reminder.description}` : ""
        }`,
        channel: "email",
        type: "reminder_due",
        data: {
          vehicleId: reminder.vehicleId ? String(reminder.vehicleId) : undefined,
          dueDate: reminder.dueDate,
        },
        priority: reminder.priority === "urgent" ? "urgent" : "medium",
        status: "queued",
      });

      await enqueue(EMAIL_QUEUE, {
        type: "notification_email",
        data: { notificationId: String(notification._id) },
      });

      reminder.lastNotifiedAt = now;
      reminder.notificationCount = (reminder.notificationCount ?? 0) + 1;
      await reminder.save();
      notified += 1;
    } catch (err) {
      logger.error({
        type: "reminder_check_failed",
        reminderId: String(reminder._id),
        error: (err as Error).message,
      });
    }
  }

  logger.info({ type: "reminder_check_complete", checked: dueReminders.length, notified });
  return { checked: dueReminders.length, notified };
}
