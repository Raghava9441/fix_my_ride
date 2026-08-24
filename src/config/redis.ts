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

/**
 * Subset of the ioredis API actually used across the codebase (cache
 * helpers, the hand-rolled job queue, and the auth revocation denylist).
 * A real `Redis` instance satisfies this structurally; `InMemoryRedis`
 * below is the fallback implementation used when Redis is unreachable.
 */
export interface RedisClientLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: any[]): Promise<any>;
  setex(key: string, seconds: number, value: string): Promise<any>;
  del(...keys: string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  hset(key: string, ...args: any[]): Promise<any>;
  hgetall(key: string): Promise<Record<string, string>>;
  zadd(key: string, score: number, member: string): Promise<any>;
  zrem(key: string, member: string): Promise<any>;
  zrange(key: string, start: number, stop: number): Promise<string[]>;
  zcard(key: string): Promise<number>;
  zrangebyscore(key: string, min: number, max: number): Promise<string[]>;
  zremrangebyscore(key: string, min: number, max: number): Promise<any>;
  ping(): Promise<string>;
  quit(): Promise<any>;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function globToRegExp(pattern: string): RegExp {
  return new RegExp(`^${pattern.split("*").map(escapeRegExp).join(".*")}$`);
}

function sliceRange<T>(arr: T[], start: number, stop: number): T[] {
  const len = arr.length;
  const s = start < 0 ? Math.max(len + start, 0) : Math.min(start, len);
  const e = stop < 0 ? len + stop : Math.min(stop, len - 1);
  if (e < s || len === 0) return [];
  return arr.slice(s, e + 1);
}

/**
 * In-process, single-instance stand-in for Redis. Used automatically when
 * a real Redis server can't be reached (e.g. local dev with no Redis
 * installed) so the cache/queue/auth-revocation code paths keep working
 * instead of erroring on every call.
 *
 * Deliberately NOT a substitute for real Redis in staging/production: state
 * here is per-process (lost on restart, not shared across instances), so
 * distributed token revocation and multi-instance job queues won't work
 * correctly until a real Redis is configured.
 */
export class InMemoryRedis implements RedisClientLike {
  private strings = new Map<string, { value: string; expiresAt?: number }>();
  private hashes = new Map<string, Map<string, string>>();
  private zsets = new Map<string, Map<string, number>>();

  private isExpired(entry?: { expiresAt?: number }): boolean {
    return !!entry?.expiresAt && entry.expiresAt <= Date.now();
  }

  async get(key: string): Promise<string | null> {
    const entry = this.strings.get(key);
    if (!entry || this.isExpired(entry)) {
      this.strings.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ...args: any[]): Promise<"OK"> {
    let expiresAt: number | undefined;
    const exIdx = args.findIndex((a) => typeof a === "string" && a.toUpperCase() === "EX");
    if (exIdx !== -1 && args[exIdx + 1] !== undefined) {
      expiresAt = Date.now() + Number(args[exIdx + 1]) * 1000;
    }
    this.strings.set(key, { value: String(value), expiresAt });
    return "OK";
  }

  async setex(key: string, seconds: number, value: string): Promise<"OK"> {
    this.strings.set(key, { value: String(value), expiresAt: Date.now() + seconds * 1000 });
    return "OK";
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.strings.delete(key)) count++;
      if (this.hashes.delete(key)) count++;
      if (this.zsets.delete(key)) count++;
    }
    return count;
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = globToRegExp(pattern);
    const all = new Set<string>([...this.strings.keys(), ...this.hashes.keys(), ...this.zsets.keys()]);
    return [...all].filter((k) => regex.test(k));
  }

  async hset(key: string, ...args: any[]): Promise<number> {
    let hash = this.hashes.get(key);
    if (!hash) {
      hash = new Map();
      this.hashes.set(key, hash);
    }
    let added = 0;
    if (args.length === 1 && args[0] && typeof args[0] === "object") {
      for (const [field, value] of Object.entries(args[0])) {
        if (!hash.has(field)) added++;
        hash.set(field, String(value));
      }
    } else {
      for (let i = 0; i < args.length; i += 2) {
        const field = String(args[i]);
        if (!hash.has(field)) added++;
        hash.set(field, String(args[i + 1]));
      }
    }
    return added;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    const hash = this.hashes.get(key);
    return hash ? Object.fromEntries(hash) : {};
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    let zset = this.zsets.get(key);
    if (!zset) {
      zset = new Map();
      this.zsets.set(key, zset);
    }
    const isNew = !zset.has(member);
    zset.set(member, score);
    return isNew ? 1 : 0;
  }

  async zrem(key: string, member: string): Promise<number> {
    return this.zsets.get(key)?.delete(member) ? 1 : 0;
  }

  private sortedMembers(key: string): [string, number][] {
    const zset = this.zsets.get(key);
    return zset ? [...zset.entries()].sort((a, b) => a[1] - b[1]) : [];
  }

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    return sliceRange(this.sortedMembers(key).map(([m]) => m), start, stop);
  }

  async zcard(key: string): Promise<number> {
    return this.zsets.get(key)?.size ?? 0;
  }

  async zrangebyscore(key: string, min: number, max: number): Promise<string[]> {
    return this.sortedMembers(key)
      .filter(([, score]) => score >= min && score <= max)
      .map(([m]) => m);
  }

  async zremrangebyscore(key: string, min: number, max: number): Promise<number> {
    const zset = this.zsets.get(key);
    if (!zset) return 0;
    let removed = 0;
    for (const [member, score] of [...zset.entries()]) {
      if (score >= min && score <= max) {
        zset.delete(member);
        removed++;
      }
    }
    return removed;
  }

  async ping(): Promise<string> {
    return "PONG";
  }

  async quit(): Promise<"OK"> {
    return "OK";
  }
}

let redisClient: Redis | null = null;
let redisSubscriber: Redis | null = null;
let fallbackClient: InMemoryRedis | null = null;
let usingFallback = false;

const getFallback = (): InMemoryRedis => {
  if (!fallbackClient) fallbackClient = new InMemoryRedis();
  return fallbackClient;
};

const fallBackToMemory = (err: unknown): RedisClientLike => {
  usingFallback = true;
  redisClient = null;
  logger.warn(
    "Redis unavailable — falling back to an in-memory cache/queue/revocation-list for this process. " +
      "This is fine for local development, but state is NOT shared across instances or restarts; " +
      `configure a real Redis before deploying. (${(err as Error)?.message ?? err})`,
  );
  return getFallback();
};

export const connectRedis = async (): Promise<RedisClientLike> => {
  if (redisClient && redisClient.status === "ready") {
    return redisClient;
  }
  if (usingFallback) {
    return getFallback();
  }

  const client = new Redis(redisConfig);

  client.on("connect", () => {
    logger.info("Redis connected");
  });

  client.on("error", (err) => {
    // Once we've fallen back, ioredis may still retry in the background;
    // avoid re-logging every retry as a fresh error.
    if (!usingFallback) logger.error("Redis error:", err.message);
  });

  client.on("ready", () => {
    logger.info("Redis ready");
  });

  try {
    await client.connect();
    redisClient = client;
    usingFallback = false;
    return client;
  } catch (err) {
    // Stop ioredis's own retry loop — we've already switched to the
    // in-memory fallback, so repeated background reconnect attempts would
    // just spam "Redis error" forever without ever being used.
    client.disconnect();
    return fallBackToMemory(err);
  }
};

export const getRedisClient = (): RedisClientLike => {
  if (usingFallback) return getFallback();
  if (!redisClient) {
    // Nothing has attempted a connection yet (or it never got the chance to
    // fail cleanly) — degrade gracefully instead of throwing.
    return fallBackToMemory(new Error("Redis not connected"));
  }
  return redisClient;
};

export const isUsingInMemoryRedisFallback = (): boolean => usingFallback;

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
  usingFallback = false;
  fallbackClient = null;
};

export const checkRedisHealth = async (): Promise<{
  status: string;
  message: string;
}> => {
  if (usingFallback) {
    return { status: "degraded", message: "Using in-memory fallback (Redis unreachable)" };
  }
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
