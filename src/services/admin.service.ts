import os from "os";
import fs from "fs/promises";
import path from "path";
import { monitorEventLoopDelay } from "perf_hooks";
import { execFile } from "child_process";
import { promisify } from "util";
import { Tenant } from "../models/Tenant";
import { Account } from "../models/Account";
import { Vehicle } from "../models/Vehicle";
import { ServiceRecord } from "../models/ServiceRecord";
import { Payment } from "../models/Payment";
import { detailed as detailedHealth } from "./health.service";
import { config } from "../config/environment";
import { logger } from "../config/logger";

const execFileAsync = promisify(execFile);

// Sampled continuously from process start so getSystemMetrics() always has
// data to report, rather than needing to wait out a fresh sampling window.
const eventLoopMonitor = monitorEventLoopDelay({ resolution: 20 });
eventLoopMonitor.enable();

export interface DashboardStats {
  totalTenants: number;
  totalUsers: number;
  totalVehicles: number;
  totalServiceRecords: number;
  revenue: number;
}

export interface ProcessStats {
  cpuLoadAverage: number[];
  cpuCount: number;
  memory: {
    totalMB: number;
    freeMB: number;
    usedMB: number;
    usedPercent: number;
  };
  processUptimeSeconds: number;
  systemUptimeSeconds: number;
  nodeVersion: string;
}

export class AdminService {
  async getDashboard(): Promise<DashboardStats> {
    const [totalTenants, totalUsers, totalVehicles, totalServiceRecords, revenueResult] =
      await Promise.all([
        Tenant.countDocuments({ isDeleted: false }),
        Account.countDocuments({ isDeleted: false }),
        Vehicle.countDocuments({ isDeleted: false }),
        ServiceRecord.countDocuments({ isDeleted: false }),
        Payment.aggregate([
          { $match: { status: "completed", isDeleted: false } },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]),
      ]);

    return {
      totalTenants,
      totalUsers,
      totalVehicles,
      totalServiceRecords,
      revenue: revenueResult[0]?.total ?? 0,
    };
  }

  getSystemStats(): ProcessStats {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return {
      cpuLoadAverage: os.loadavg(),
      cpuCount: os.cpus().length,
      memory: {
        totalMB: Math.round(totalMem / 1024 / 1024),
        freeMB: Math.round(freeMem / 1024 / 1024),
        usedMB: Math.round(usedMem / 1024 / 1024),
        usedPercent: Math.round((usedMem / totalMem) * 100),
      },
      processUptimeSeconds: Math.round(process.uptime()),
      systemUptimeSeconds: Math.round(os.uptime()),
      nodeVersion: process.version,
    };
  }

  async getSystemHealth() {
    return detailedHealth();
  }

  /**
   * Tails the winston file transports. Those are only registered when
   * `!config.logging.prettyPrint` (production/staging — see
   * src/config/logger.ts), so in local dev this returns an empty array with
   * a `note` rather than an error — there's no file to read yet.
   */
  async getSystemLogs(
    level: "combined" | "error" = "combined",
    limit = 200,
  ): Promise<{ entries: Record<string, unknown>[]; note?: string }> {
    const fileName = level === "error" ? "error.log" : "combined.log";
    const filePath = path.join("logs", fileName);

    let raw: string;
    try {
      raw = await fs.readFile(filePath, "utf-8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return {
          entries: [],
          note: `${filePath} doesn't exist — file logging is only enabled when LOG_PRETTY=false (production/staging).`,
        };
      }
      throw err;
    }

    const lines = raw.split("\n").filter(Boolean).slice(-limit);
    const entries = lines.map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { raw: line };
      }
    });

    return { entries };
  }

  getSystemMetrics(): ProcessStats & {
    process: { memory: NodeJS.MemoryUsage; cpu: NodeJS.CpuUsage };
    eventLoopDelayMs: { mean: number; max: number; p99: number };
  } {
    return {
      ...this.getSystemStats(),
      process: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
      },
      eventLoopDelayMs: {
        mean: eventLoopMonitor.mean / 1e6,
        max: eventLoopMonitor.max / 1e6,
        p99: eventLoopMonitor.percentile(99) / 1e6,
      },
    };
  }

  /**
   * Shells out to `mongodump`. Requires the binary to be present in the
   * runtime environment — fails with a clear error rather than a fake
   * success when it isn't.
   */
  async createBackup(): Promise<{ path: string; createdAt: string }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outDir = path.join("backups", timestamp);
    await fs.mkdir(outDir, { recursive: true });

    try {
      await execFileAsync("mongodump", ["--uri", config.db.uri, "--out", outDir]);
    } catch (err) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === "ENOENT") {
        throw new Error(
          "mongodump is not installed in this environment — cannot create a backup.",
        );
      }
      logger.error({ type: "backup_failed", error: nodeErr.message });
      throw new Error(`mongodump failed: ${nodeErr.message}`);
    }

    return { path: outDir, createdAt: new Date().toISOString() };
  }
}

export const adminService = new AdminService();
