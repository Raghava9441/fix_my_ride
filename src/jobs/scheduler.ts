// src/jobs/scheduler.ts
import cron, { ScheduledTask } from "node-cron";
import { checkReminders } from "./reminder.job";
import { checkExpiringSubscriptions } from "./subscription.job";
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

  tasks = [reminderTask, subscriptionTask];
  logger.info({
    type: "scheduled_jobs_bootstrapped",
    jobs: ["reminder_check (*/15 * * * *)", "subscription_expiry_check (0 6 * * *)"],
  });
}

export function stopScheduledJobs(): void {
  for (const task of tasks) {
    task.stop();
  }
  tasks = [];
}
