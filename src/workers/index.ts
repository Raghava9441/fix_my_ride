// src/workers/index.ts
import { startWorker, registerHandler, stopAllWorkers } from "../services/queue.service";
import { emailHandlers } from "../jobs/email.job";
import { notificationHandlers } from "../jobs/notification.job";
import { startScheduledJobs, stopScheduledJobs } from "../jobs/scheduler";
import { logger } from "../config/logger";

export const EMAIL_QUEUE = "emails";

/**
 * Bootstrap background workers. Call once at startup after Redis is connected.
 */
export function startWorkers(): void {
  startWorker(EMAIL_QUEUE, { concurrency: 4, pollIntervalMs: 1000, maxAttempts: 5, backoffMs: 5000 });

  for (const [type, handler] of Object.entries(emailHandlers)) {
    registerHandler(EMAIL_QUEUE, type, (data) => handler(data));
  }
  for (const [type, handler] of Object.entries(notificationHandlers)) {
    registerHandler(EMAIL_QUEUE, type, (data, job) => handler(data, job));
  }

  startScheduledJobs();

  logger.info({ type: "workers_bootstrapped", queues: [EMAIL_QUEUE] });
}

export async function stopWorkers(): Promise<void> {
  stopScheduledJobs();
  await stopAllWorkers();
}
