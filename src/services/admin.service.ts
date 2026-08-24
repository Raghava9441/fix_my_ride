import os from "os";
import { Tenant } from "../models/Tenant";
import { Account } from "../models/Account";
import { Vehicle } from "../models/Vehicle";
import { ServiceRecord } from "../models/ServiceRecord";
import { Payment } from "../models/Payment";
import { detailed as detailedHealth } from "./health.service";

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
}

export const adminService = new AdminService();
