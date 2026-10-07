// src/jobs/whatsapp.job.ts
import { Notification } from "../models/Notification";
import { Account } from "../models/Account";
import { normalizeWhatsAppNumber, sendWhatsAppNotification } from "../config/whatsapp";
import { logger } from "../config/logger";
import type { QueuedJob } from "../services/queue.service";

export type WhatsAppJobType = "whatsapp_message";

/**
 * Delivers a Notification to its recipient's WhatsApp. Skips (returns
 * quietly, no retry) when there is nothing deliverable — no phone, invalid
 * number, or the owner opted out. Throws on transient provider errors so the
 * queue retries with backoff. The outcome is recorded on
 * notification.metadata.whatsapp, separate from the notification's own
 * channel status, and later updated by the WhatsApp webhook
 * (sent -> delivered -> read / failed).
 */
export const whatsappHandlers: Record<
  WhatsAppJobType,
  (data: Record<string, any>, job: QueuedJob) => Promise<void>
> = {
  async whatsapp_message(data) {
    const notification = await Notification.findById(data.notificationId);
    if (!notification || notification.recipientModel !== "Account") return;

    const account = await Account.findById(notification.recipientId).select("phone preferences");
    if (!account) return;

    const skip = async (reason: string) => {
      logger.info({ type: "whatsapp_skipped", notificationId: String(notification._id), reason });
    };

    if (account.preferences?.notificationPreferences?.whatsapp?.enabled === false) {
      return skip("opted_out");
    }
    const to = normalizeWhatsAppNumber(account.phone);
    if (!to) return skip(account.phone ? "invalid_phone" : "no_phone");

    const result = await sendWhatsAppNotification(to, notification.title, notification.content);

    notification.metadata = {
      ...(notification.metadata ?? {}),
      whatsapp: result.success
        ? { messageId: result.messageId, status: "sent", sentAt: new Date() }
        : { status: "failed", error: result.error, updatedAt: new Date() },
    };
    notification.markModified("metadata");
    await notification.save();

    if (!result.success && !result.permanent) {
      throw new Error(result.error || "WhatsApp send failed");
    }
  },
};
