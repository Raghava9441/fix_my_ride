// src/services/queue.service.ts
import { getRedisClient } from "../config/redis";
import {
  addJob,
  moveJobToActive,
  moveJobToCompleted,
  moveJobToFailed,
  updateJobProgress,
  getWaitingJobs,
} from "../config/queue";
import { logger } from "../config/logger";
import { randomUUID } from "crypto";

export type JobHandler = (data: Record<string, any>, job: QueuedJob) => Promise<void>;

export interface QueuedJob {
  id: string;
  type: string;
  data: Record<string, any>;
  attemptsMade: number;
  options?: {
    priority?: number;
    delay?: number;
    attempts?: number;
    backoff?: number;
    dedupeKey?: string;
  };
}

interface WorkerOptions {
  concurrency?: number;
  pollIntervalMs?: number;
  maxAttempts?: number;
  backoffMs?: number;
  paused?: boolean;
}

interface WorkerState {
  queueName: string;
  handlers: Map<string, JobHandler>;
  running: boolean;
  inFlight: Set<string>;
  options: Required<WorkerOptions>;
  timer?: ReturnType<typeof setTimeout>;
}

const workers = new Map<string, WorkerState>();

/**
 * Register a handler for a specific job type on a queue.
 */
export function registerHandler(queueName: string, type: string, handler: JobHandler): void {
  const state = workers.get(queueName);
  if (!state) {
    throw new Error(`Worker for queue "${queueName}" is not initialized. Call startWorker() first.`);
  }
  state.handlers.set(type, handler);
}

/**
 * Enqueue a job. Returns the job id.
 */
export async function enqueue(
  queueName: string,
  job: {
    type: string;
    data: Record<string, any>;
    options?: QueuedJob["options"];
  },
): Promise<string> {
  return addJob(queueName, {
    id: job.options?.dedupeKey ? `dedupe:${job.options.dedupeKey}` : randomUUID(),
    type: job.type,
    data: job.data,
    options: {
      priority: job.options?.priority,
      delay: job.options?.delay,
      attempts: job.options?.attempts ?? 3,
      backoff: job.options?.backoff ?? 5000,
    },
  });
}

/**
 * Start a worker that polls the queue and processes jobs.
 */
export function startWorker(queueName: string, options: WorkerOptions = {}): void {
  if (workers.has(queueName)) {
    logger.warn({ type: "queue_worker_already_running", queueName });
    return;
  }

  const state: WorkerState = {
    queueName,
    handlers: new Map(),
    running: true,
    inFlight: new Set(),
    options: {
      concurrency: options.concurrency ?? 4,
      pollIntervalMs: options.pollIntervalMs ?? 1000,
      maxAttempts: options.maxAttempts ?? 3,
      backoffMs: options.backoffMs ?? 5000,
      paused: options.paused ?? false,
    },
  };

  workers.set(queueName, state);
  logger.info({ type: "queue_worker_started", queueName, concurrency: state.options.concurrency });

  void poll(state);
}

async function poll(state: WorkerState): Promise<void> {
  if (!state.running) return;

  try {
    if (!state.options.paused && state.inFlight.size < state.options.concurrency) {
      const slots = state.options.concurrency - state.inFlight.size;
      const waiting = await getWaitingJobs(state.queueName, 0, slots - 1);
      for (const jobKey of waiting) {
        if (state.inFlight.has(jobKey)) continue;
        state.inFlight.add(jobKey);
        void processJob(state, jobKey).finally(() => state.inFlight.delete(jobKey));
      }
    }
  } catch (err) {
    logger.error({ type: "queue_poll_error", queueName: state.queueName, error: (err as Error).message });
  } finally {
    if (state.running) {
      state.timer = setTimeout(() => void poll(state), state.options.pollIntervalMs);
    }
  }
}

async function processJob(state: WorkerState, jobKey: string): Promise<void> {
  const redis = getRedisClient();
  const raw = await redis.hgetall(jobKey);
  if (!raw || Object.keys(raw).length === 0) return;

  const job: QueuedJob = {
    id: raw.id,
    type: raw.type,
    data: safeParse(raw.data, {}),
    attemptsMade: Number(raw.attemptsMade ?? 0),
    options: safeParse(raw.options, {}),
  };

  const handler = state.handlers.get(job.type);
  if (!handler) {
    logger.error({ type: "queue_no_handler", queueName: state.queueName, jobType: job.type, jobId: job.id });
    await moveJobToFailed(state.queueName, job.id, `No handler for job type "${job.type}"`);
    return;
  }

  await moveJobToActive(state.queueName, job.id);
  await updateJobProgress(state.queueName, job.id, 0);

  try {
    await handler(job.data, job);
    await updateJobProgress(state.queueName, job.id, 100);
    await moveJobToCompleted(state.queueName, job.id);
  } catch (err) {
    const nextAttempts = job.attemptsMade + 1;
    const maxAttempts = job.options?.attempts ?? state.options.maxAttempts;
    const message = (err as Error).message;

    if (nextAttempts < maxAttempts) {
      const backoff = job.options?.backoff ?? state.options.backoffMs;
      logger.warn({
        type: "queue_job_retry",
        queueName: state.queueName,
        jobId: job.id,
        attempt: nextAttempts,
        maxAttempts,
        error: message,
      });
      // Re-enqueue with a delay (re-add to waiting set)
      await redis.hset(jobKey, "attemptsMade", nextAttempts);
      await redis.zadd(`${queuePrefix(state.queueName)}:waiting`, Date.now() + backoff, jobKey);
    } else {
      logger.error({
        type: "queue_job_failed",
        queueName: state.queueName,
        jobId: job.id,
        attempts: nextAttempts,
        error: message,
      });
      await moveJobToFailed(state.queueName, job.id, message);
    }
  }
}

function queuePrefix(queueName: string): string {
  return `queue:${queueName}`;
}

function safeParse(value: any, fallback: any): any {
  if (typeof value !== "string") return value ?? fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/**
 * Stop a single worker (drains in-flight jobs, then stops polling).
 */
export async function stopWorker(queueName: string): Promise<void> {
  const state = workers.get(queueName);
  if (!state) return;
  state.running = false;
  if (state.timer) clearTimeout(state.timer);

  // Allow in-flight jobs a grace period to finish.
  const deadline = Date.now() + 10_000;
  while (state.inFlight.size > 0 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 200));
  }
  workers.delete(queueName);
  logger.info({ type: "queue_worker_stopped", queueName });
}

/**
 * Stop all workers (used during graceful shutdown).
 */
export async function stopAllWorkers(): Promise<void> {
  const names = Array.from(workers.keys());
  await Promise.all(names.map((n) => stopWorker(n)));
}
