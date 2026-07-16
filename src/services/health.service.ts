// src/services/health.service.ts
import mongoose from "mongoose";
import { checkRedisHealth } from "../config/redis";
import { logger } from "../config/logger";

export interface HealthCheck {
  status: "healthy" | "unhealthy" | "degraded";
  message?: string;
  details?: Record<string, any>;
}

/**
 * Liveness: is the process up? Does not depend on external services.
 */
export function liveness(): HealthCheck {
  return { status: "healthy", message: "Service is alive" };
}

/**
 * Readiness: can the service handle traffic? Checks critical dependencies.
 */
export async function readiness(): Promise<HealthCheck> {
  const checks: Record<string, HealthCheck> = {};

  // Database
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db?.admin().ping();
      checks.database = { status: "healthy", message: "MongoDB connected" };
    } else {
      checks.database = { status: "unhealthy", message: "MongoDB not connected" };
    }
  } catch (err) {
    checks.database = { status: "unhealthy", message: (err as Error).message };
  }

  // Redis
  try {
    const redis = await checkRedisHealth();
    checks.redis = redis as HealthCheck;
  } catch (err) {
    checks.redis = { status: "unhealthy", message: (err as Error).message };
  }

  const allHealthy = Object.values(checks).every((c) => c.status === "healthy");
  return {
    status: allHealthy ? "healthy" : "unhealthy",
    message: allHealthy ? "All dependencies ready" : "One or more dependencies unavailable",
    details: checks,
  };
}

/**
 * Detailed: aggregate health with extra diagnostics.
 */
export async function detailed(): Promise<HealthCheck> {
  const base = await readiness();
  const details: Record<string, any> = { ...(base.details ?? {}) };

  details.process = {
    uptimeSeconds: Math.floor(process.uptime()),
    memoryMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    nodeVersion: process.version,
    pid: process.pid,
  };

  details.database = {
    ...details.database,
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host,
    name: mongoose.connection.name,
  };

  return {
    status: base.status,
    message: base.message,
    details,
  };
}
