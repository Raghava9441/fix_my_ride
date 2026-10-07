// src/jobs/cleanup.job.ts
import { Notification } from "../models/Notification";
import { logger } from "../config/logger";

const NOTIFICATION_RETENTION_DAYS = 90;

/**
 * Retention sweep. Soft-archives notifications older than the retention
 * window (see Notification.deleteOldNotifications). Invitations don't need
 * handling here — they carry a TTL index (expiresAt) and Mongo reaps them.
 */
export async function runCleanup(): Promise<{ notificationsArchived: number }> {
  const result = await Notification.deleteOldNotifications(NOTIFICATION_RETENTION_DAYS);
  const notificationsArchived = result.modifiedCount ?? 0;
  logger.info({ type: "cleanup_complete", notificationsArchived });
  return { notificationsArchived };
}
