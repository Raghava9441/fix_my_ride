// src/jobs/scheduler.ts
import cron, { ScheduledTask } from "node-cron";
import { checkReminders } from "./reminder.job";
import { checkExpiringSubscriptions } from "./subscription.job";
import { markOverdueInvoices } from "./invoice.job";
import { runCleanup } from "./cleanup.job";
import { logger } from "../config/logger";

let tasks: ScheduledTask[] = [];

/**
 * Bootstrap periodic (cron-driven) jobs. Call once at startup, after workers
 * are started. Nothing else in this codebase triggers reminder checks —
 * without this, reminders/notifications are written but never delivered.
 */
export function startScheduledJobs(): void {
  const reminderTask = cron.schedule("*/15 * * * *", () => {
    void checkReminders().catch((err) =>
      logger.error({ type: "reminder_check_job_failed", error: (err as Error).message }),
    );
  });

  // Once daily is enough for renewal reminders (vs. every 15 min for
  // time-sensitive vehicle reminders above).
  const subscriptionTask = cron.schedule("0 6 * * *", () => {
    void checkExpiringSubscriptions().catch((err) =>
      logger.error({ type: "subscription_expiry_job_failed", error: (err as Error).message }),
    );
  });

  const invoiceTask = cron.schedule("0 7 * * *", () => {
    void markOverdueInvoices().catch((err) =>
      logger.error({ type: "invoice_overdue_job_failed", error: (err as Error).message }),
    );
  });

  const cleanupTask = cron.schedule("30 3 * * *", () => {
    void runCleanup().catch((err) =>
      logger.error({ type: "cleanup_job_failed", error: (err as Error).message }),
    );
  });

  tasks = [reminderTask, subscriptionTask, invoiceTask, cleanupTask];
  logger.info({
    type: "scheduled_jobs_bootstrapped",
    jobs: [
      "reminder_check (*/15 * * * *)",
      "subscription_expiry_check (0 6 * * *)",
      "invoice_overdue_check (0 7 * * *)",
      "cleanup (30 3 * * *)",
    ],
  });
}

export function stopScheduledJobs(): void {
  for (const task of tasks) {
    task.stop();
  }
  tasks = [];
}
