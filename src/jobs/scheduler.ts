// src/jobs/scheduler.ts
import cron, { ScheduledTask } from "node-cron";
import { checkReminders } from "./reminder.job";
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

  tasks = [reminderTask];
  logger.info({ type: "scheduled_jobs_bootstrapped", jobs: ["reminder_check (*/15 * * * *)"] });
}

export function stopScheduledJobs(): void {
  for (const task of tasks) {
    task.stop();
  }
  tasks = [];
}
