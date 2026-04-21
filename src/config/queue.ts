// src/config/queue.ts
import { getRedisClient } from "./redis";
import { logger } from "./logger";
import { config } from "./environment";

export interface QueueJob {
  id?: string;
  type: string;
  data: Record<string, any>;
  options?: {
    priority?: number;
    delay?: number;
    attempts?: number;
    backoff?: number;
    ttl?: number;
  };
}

export interface QueueConfig {
  name: string;
  defaultJobOptions?: {
    attempts: number;
    backoff: { type: string; delay: number };
    removeOnComplete: boolean | number;
    removeOnFail: boolean | number;
  };
}

const getPrefix = (queueName: string): string => `queue:${queueName}`;
const getJobKey = (queueName: string, jobId: string): string =>
  `${getPrefix(queueName)}:jobs:${jobId}`;
const getWaitingKey = (queueName: string): string =>
  `${getPrefix(queueName)}:waiting`;
const getActiveKey = (queueName: string): string =>
  `${getPrefix(queueName)}:active`;
const getCompletedKey = (queueName: string): string =>
  `${getPrefix(queueName)}:completed`;
const getFailedKey = (queueName: string): string =>
  `${getPrefix(queueName)}:failed`;

export const createQueue = (
  name: string,
  _options?: Partial<QueueConfig>,
): string => {
  const queueKey = getPrefix(name);
  logger.info(`Queue created: ${queueKey}`);
  return queueKey;
};

export const addJob = async (
  queueName: string,
  job: QueueJob,
): Promise<string> => {
  const redis = getRedisClient();
  const jobId =
    job.id || `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const jobData = {
    id: jobId,
    type: job.type,
    data: job.data,
    progress: 0,
    attemptsMade: 0,
    createdAt: Date.now(),
    processedAt: null,
  };

  const jobKey = getJobKey(queueName, jobId);
  await redis.hset(jobKey, jobData);
  await redis.zadd(getWaitingKey(queueName), Date.now(), jobKey);

  logger.info(`Job added to queue ${queueName}: ${jobId}`);
  return jobId;
};

export const getJob = async (
  queueName: string,
  jobId: string,
): Promise<QueueJob | null> => {
  const redis = getRedisClient();
  const jobKey = getJobKey(queueName, jobId);
  const job = await redis.hgetall(jobKey);
  return Object.keys(job).length > 0 ? job : null;
};

export const getWaitingJobs = async (
  queueName: string,
  start = 0,
  end = 10,
): Promise<string[]> => {
  const redis = getRedisClient();
  return redis.zrange(getWaitingKey(queueName), start, end);
};

export const getActiveJobs = async (
  queueName: string,
  start = 0,
  end = 10,
): Promise<string[]> => {
  const redis = getRedisClient();
  return redis.zrange(getActiveKey(queueName), start, end);
};

export const getCompletedJobs = async (
  queueName: string,
  start = 0,
  end = 10,
): Promise<string[]> => {
  const redis = getRedisClient();
  return redis.zrange(getCompletedKey(queueName), start, end);
};

export const getFailedJobs = async (
  queueName: string,
  start = 0,
  end = 10,
): Promise<string[]> => {
  const redis = getRedisClient();
  return redis.zrange(getFailedKey(queueName), start, end);
};

export const moveJobToActive = async (
  queueName: string,
  jobId: string,
): Promise<void> => {
  const redis = getRedisClient();
  const jobKey = getJobKey(queueName, jobId);

  await redis.zrem(getWaitingKey(queueName), jobKey);
  await redis.zadd(getActiveKey(queueName), Date.now(), jobKey);
  await redis.hset(jobKey, "processedAt", Date.now());
};

export const moveJobToCompleted = async (
  queueName: string,
  jobId: string,
): Promise<void> => {
  const redis = getRedisClient();
  const jobKey = getJobKey(queueName, jobId);

  await redis.zrem(getActiveKey(queueName), jobKey);
  await redis.zadd(getCompletedKey(queueName), Date.now(), jobKey);
  await redis.hset(jobKey, "completedAt", Date.now());

  logger.info(`Job completed in queue ${queueName}: ${jobId}`);
};

export const moveJobToFailed = async (
  queueName: string,
  jobId: string,
  error?: string,
): Promise<void> => {
  const redis = getRedisClient();
  const jobKey = getJobKey(queueName, jobId);

  await redis.zrem(getActiveKey(queueName), jobKey);
  await redis.zadd(getFailedKey(queueName), Date.now(), jobKey);
  await redis.hset(jobKey, "failedAt", Date.now());
  if (error) {
    await redis.hset(jobKey, "error", error);
  }

  logger.error(`Job failed in queue ${queueName}: ${jobId}`, error);
};

export const updateJobProgress = async (
  queueName: string,
  jobId: string,
  progress: number,
): Promise<void> => {
  const redis = getRedisClient();
  const jobKey = getJobKey(queueName, jobId);
  await redis.hset(jobKey, "progress", progress);
};

export const removeJob = async (
  queueName: string,
  jobId: string,
): Promise<void> => {
  const redis = getRedisClient();
  const jobKey = getJobKey(queueName, jobId);

  await redis.zrem(getWaitingKey(queueName), jobKey);
  await redis.zrem(getActiveKey(queueName), jobKey);
  await redis.zrem(getCompletedKey(queueName), jobKey);
  await redis.zrem(getFailedKey(queueName), jobKey);
  await redis.del(jobKey);
};

export const getQueueStats = async (
  queueName: string,
): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}> => {
  const redis = getRedisClient();
  const [waiting, active, completed, failed] = await Promise.all([
    redis.zcard(getWaitingKey(queueName)),
    redis.zcard(getActiveKey(queueName)),
    redis.zcard(getCompletedKey(queueName)),
    redis.zcard(getFailedKey(queueName)),
  ]);

  return { waiting, active, completed, failed };
};

export const cleanOldJobs = async (
  queueName: string,
  completedTs: number,
  failedTs: number,
): Promise<number> => {
  const redis = getRedisClient();
  let cleaned = 0;

  if (completedTs > 0) {
    const completedJobs = await redis.zrangebyscore(
      getCompletedKey(queueName),
      0,
      completedTs,
    );
    for (const jobKey of completedJobs) {
      await redis.del(jobKey);
      cleaned++;
    }
    await redis.zremrangebyscore(getCompletedKey(queueName), 0, completedTs);
  }

  if (failedTs > 0) {
    const failedJobs = await redis.zrangebyscore(
      getFailedKey(queueName),
      0,
      failedTs,
    );
    for (const jobKey of failedJobs) {
      await redis.del(jobKey);
      cleaned++;
    }
    await redis.zremrangebyscore(getFailedKey(queueName), 0, failedTs);
  }

  logger.info(`Cleaned ${cleaned} old jobs from queue ${queueName}`);
  return cleaned;
};

export const closeQueue = async (): Promise<void> => {
  logger.info("Queues closed");
};
