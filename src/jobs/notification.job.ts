// src/jobs/notification.job.ts
import { Notification } from "../models/Notification";
import { sendEmail } from "../config/email";
import { notificationService } from "../services/notification.service";
import { logger } from "../config/logger";
import type { QueuedJob } from "../services/queue.service";

export type NotificationJobType = "notification_email";

/**
 * Handlers consumed by the queue worker (registered on the "emails" queue
 * alongside emailHandlers — see src/workers/index.ts). Delivers a queued
 * Notification document for the "email" channel. SMS/push channels are not
 * handled here — no provider is integrated for those yet.
 */
export const notificationHandlers: Record<
  NotificationJobType,
  (data: Record<string, any>, job: QueuedJob) => Promise<void>
> = {
  async notification_email(data, job) {
    const notificationId = data.notificationId;
    if (!notificationId) {
      throw new Error("notification_email job missing notificationId");
    }

    const notification = await Notification.findById(notificationId);
    if (!notification) {
      throw new Error(`Notification ${notificationId} not found`);
    }

    try {
      const recipient = await notification.getRecipientModel();
      const to = recipient?.email as string | undefined;
      if (!to) {
        throw new Error(`Notification ${notificationId} recipient has no email address`);
      }

      const result = await sendEmail({
        to,
        subject: notification.title,
        html: `<p>${notification.content}</p>`,
        text: notification.content,
      });

      if (!result.success) {
        throw new Error(result.error || "Email send failed");
      }

      await notificationService.markAsSent(String(notification._id), result.messageId);
    } catch (err) {
      // Only mark as permanently failed once the queue has exhausted its
      // retries — otherwise every transient failure would flip status to
      // "failed" even though a retry is still coming.
      const maxAttempts = job.options?.attempts ?? 3;
      const isFinalAttempt = job.attemptsMade + 1 >= maxAttempts;
      if (isFinalAttempt) {
        await notificationService
          .markAsFailed(String(notification._id), (err as Error).message)
          .catch((markErr) =>
            logger.error({
              type: "notification_mark_failed_error",
              notificationId,
              error: (markErr as Error).message,
            }),
          );
      }
      throw err;
    }
  },
};
