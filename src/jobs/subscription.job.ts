// src/jobs/subscription.job.ts
import { Subscription } from "../models/Subscription";
import { Tenant } from "../models/Tenant";
import { notificationService } from "../services/notification.service";
import { enqueue } from "../services/queue.service";
import { logger } from "../config/logger";

// Matches EMAIL_QUEUE in src/workers/index.ts — kept as a literal to avoid a
// circular import (same reasoning as reminder.job.ts).
const EMAIL_QUEUE = "emails";

const RENOTIFY_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Sweeps for subscriptions expiring within 7 days and emails the tenant's
 * owner a renewal reminder. Runs with no AsyncLocalStorage request context,
 * so — like reminder.job.ts's checkReminders() — this is an intentional
 * cross-tenant sweep, not a tenant-isolation leak.
 */
export async function checkExpiringSubscriptions(): Promise<{ checked: number; notified: number }> {
  const expiring = await Subscription.findExpiring(7);
  let notified = 0;

  for (const subscription of expiring) {
    try {
      if (!subscription.tenantId) continue;

      const recentlyNotified =
        subscription.lastRenewalReminderAt &&
        Date.now() - subscription.lastRenewalReminderAt.getTime() < RENOTIFY_AFTER_MS;
      if (recentlyNotified) continue;

      const tenant = await Tenant.findById(subscription.tenantId);
      if (!tenant?.ownerId) continue;

      const notification = await notificationService.create({
        tenantId: String(subscription.tenantId),
        recipientId: String(tenant.ownerId),
        recipientModel: "Account",
        title: "Your subscription is renewing soon",
        content: `Your ${tenant.name} subscription renews on ${subscription.currentPeriodEnd.toDateString()}. No action is needed if your payment method is up to date.`,
        channel: "email",
        type: "subscription_expiring",
        data: { dueDate: subscription.currentPeriodEnd },
        priority: "medium",
        status: "queued",
      });

      await enqueue(EMAIL_QUEUE, {
        type: "notification_email",
        data: { notificationId: String(notification._id) },
      });

      subscription.lastRenewalReminderAt = new Date();
      await subscription.save();

      notified += 1;
    } catch (err) {
      logger.error({
        type: "subscription_expiry_check_failed",
        subscriptionId: String(subscription._id),
        error: (err as Error).message,
      });
    }
  }

  logger.info({ type: "subscription_expiry_check_complete", checked: expiring.length, notified });
  return { checked: expiring.length, notified };
}
