// src/config/redis.ts
import Redis from "ioredis";
import { logger } from "./logger";
import { config } from "./environment";

export const redisConfig = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  db: config.redis.db,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
};

let redisClient: Redis | null = null;
let redisSubscriber: Redis | null = null;

export const connectRedis = async (): Promise<Redis> => {
  if (redisClient && redisClient.status === "ready") {
    return redisClient;
  }

  redisClient = new Redis(redisConfig);

  redisClient.on("connect", () => {
    logger.info("Redis connected");
  });

  redisClient.on("error", (err) => {
    logger.error("Redis error:", err.message);
  });

  redisClient.on("ready", () => {
    logger.info("Redis ready");
  });

  await redisClient.connect();
  return redisClient;
};

export const getRedisClient = (): Redis => {
  if (!redisClient) {
    throw new Error("Redis not connected. Call connectRedis() first.");
  }
  return redisClient;
};

export const getRedisSubscriber = async (): Promise<Redis> => {
  if (redisSubscriber && redisSubscriber.status === "ready") {
    return redisSubscriber;
  }

  redisSubscriber = new Redis(redisConfig);
  await redisSubscriber.connect();
  return redisSubscriber;
};

export const disconnectRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
  if (redisSubscriber) {
    await redisSubscriber.quit();
    redisSubscriber = null;
  }
};

export const checkRedisHealth = async (): Promise<{
  status: string;
  message: string;
}> => {
  try {
    const client = getRedisClient();
    const result = await client.ping();
    if (result === "PONG") {
      return { status: "healthy", message: "Redis connected" };
    }
    return { status: "unhealthy", message: "Unexpected response" };
  } catch (err: any) {
    return { status: "unhealthy", message: err.message };
  }
};

export const cacheGet = async (key: string): Promise<string | null> => {
  const client = getRedisClient();
  return client.get(key);
};

export const cacheSet = async (
  key: string,
  value: string,
  ttlSeconds?: number,
): Promise<void> => {
  const client = getRedisClient();
  if (ttlSeconds) {
    await client.setex(key, ttlSeconds, value);
  } else {
    await client.set(key, value);
  }
};

export const cacheDel = async (key: string): Promise<void> => {
  const client = getRedisClient();
  await client.del(key);
};

export const cacheDelPattern = async (pattern: string): Promise<void> => {
  const client = getRedisClient();
  const keys = await client.keys(pattern);
  if (keys.length > 0) {
    await client.del(...keys);
  }
};
