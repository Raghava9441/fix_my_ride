import mongoose from "mongoose";
import { Vehicle } from "../models/Vehicle";
import { ServiceRecord } from "../models/ServiceRecord";
import { StaffProfile } from "../models/StaffProfile";
import { ServiceCenter } from "../models/ServiceCenter";
import { Tenant } from "../models/Tenant";
import { Payment } from "../models/Payment";
import { serviceRecordService } from "./serviceRecord.service";
import { ownerProfileService } from "./owner.service";
import { reminderService } from "./reminder.service";

function toDate(value: string | undefined, fallback: Date): Date {
  return value ? new Date(value) : fallback;
}

export class ReportService {
  // ─── Service center reports ────────────────────────────────────────────

  async getCenterDashboard(serviceCenterId: string) {
    const centerObjId = new mongoose.Types.ObjectId(serviceCenterId);

    const [vehicleCount, serviceRecordCount, revenueResult, activeCustomers] = await Promise.all([
      Vehicle.countDocuments({
        "authorizedServiceCenters.serviceCenterId": centerObjId,
        "authorizedServiceCenters.status": "active",
        isDeleted: false,
      }),
      ServiceRecord.countDocuments({ serviceCenterId: centerObjId, isDeleted: false }),
      ServiceRecord.aggregate([
        { $match: { serviceCenterId: centerObjId, status: "completed", isDeleted: false } },
        { $group: { _id: null, total: { $sum: "$cost.total" } } },
      ]),
      ServiceRecord.distinct("ownerId", { serviceCenterId: centerObjId, isDeleted: false }),
    ]);

    return {
      totalRevenue: revenueResult[0]?.total ?? 0,
      totalVehicles: vehicleCount,
      totalServiceRecords: serviceRecordCount,
      activeCustomers: activeCustomers.length,
    };
  }

  async getCenterRevenue(serviceCenterId: string, startDate?: string, endDate?: string) {
    const end = toDate(endDate, new Date());
    const start = toDate(startDate, new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000));
    const daily = await serviceRecordService.getRevenueReport(serviceCenterId, start, end);

    return {
      daily,
      total: daily.reduce((sum: number, d: any) => sum + d.totalRevenue, 0),
    };
  }

  async getCenterVehiclesReport(serviceCenterId: string) {
    const centerObjId = new mongoose.Types.ObjectId(serviceCenterId);
    const [active, revoked, expired] = await Promise.all([
      Vehicle.countDocuments({
        "authorizedServiceCenters.serviceCenterId": centerObjId,
        "authorizedServiceCenters.status": "active",
        isDeleted: false,
      }),
      Vehicle.countDocuments({
        "authorizedServiceCenters.serviceCenterId": centerObjId,
        "authorizedServiceCenters.status": "revoked",
        isDeleted: false,
      }),
      Vehicle.countDocuments({
        "authorizedServiceCenters.serviceCenterId": centerObjId,
        "authorizedServiceCenters.status": "expired",
        isDeleted: false,
      }),
    ]);

    return { total: active + revoked + expired, active, inactive: revoked + expired };
  }

  async getCenterServicesReport(serviceCenterId: string, startDate?: string, endDate?: string) {
    return serviceRecordService.getServiceTypeBreakdown(
      serviceCenterId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  async getStaffPerformance(serviceCenterId: string) {
    const staff = await StaffProfile.find({
      serviceCenterId,
      isDeleted: false,
      employmentStatus: { $ne: "terminated" },
    })
      .populate("accountId", "email")
      .select("stats averageRating totalReviews accountId");

    return staff.map((s) => ({
      staffId: s._id,
      email: (s.accountId as any)?.email,
      servicesPerformed: s.stats.totalServicesPerformed,
      revenueGenerated: s.stats.totalRevenueGenerated,
      rating: s.averageRating,
      totalReviews: s.totalReviews,
    }));
  }

  async getCustomerSatisfaction(serviceCenterId: string) {
    const center = await ServiceCenter.findById(serviceCenterId).select("stats");
    const totalReviews = await StaffProfile.aggregate([
      { $match: { serviceCenterId: new mongoose.Types.ObjectId(serviceCenterId), isDeleted: false } },
      { $group: { _id: null, totalReviews: { $sum: "$totalReviews" } } },
    ]);

    return {
      averageRating: center?.stats?.averageRating ?? 0,
      totalReviews: totalReviews[0]?.totalReviews ?? 0,
    };
  }

  async getPartsUsage(serviceCenterId: string, startDate?: string, endDate?: string) {
    const match: any = {
      serviceCenterId: new mongoose.Types.ObjectId(serviceCenterId),
      isDeleted: false,
    };
    if (startDate || endDate) {
      match.serviceDate = {};
      if (startDate) match.serviceDate.$gte = new Date(startDate);
      if (endDate) match.serviceDate.$lte = new Date(endDate);
    }

    return ServiceRecord.aggregate([
      { $match: match },
      { $unwind: "$partsReplaced" },
      {
        $group: {
          _id: "$partsReplaced.partName",
          quantity: { $sum: "$partsReplaced.quantity" },
          cost: { $sum: "$partsReplaced.totalCost" },
        },
      },
      { $sort: { cost: -1 } },
      { $project: { _id: 0, part: "$_id", quantity: 1, cost: 1 } },
    ]);
  }

  // ─── Owner reports ──────────────────────────────────────────────────────

  async getOwnerExpenses(ownerId: string) {
    return ownerProfileService.getExpenses(ownerId);
  }

  async getOwnerServiceHistory(ownerId: string, limit?: number) {
    return ownerProfileService.getServiceHistory(ownerId, { limit });
  }

  async getUpcomingServices(ownerId: string) {
    return reminderService.findUpcoming(ownerId, 90);
  }

  async getMaintenanceSummary(ownerId: string) {
    const [scheduled, completed, cancelled] = await Promise.all([
      ServiceRecord.countDocuments({ ownerId, status: "scheduled", isDeleted: false }),
      ServiceRecord.countDocuments({ ownerId, status: "completed", isDeleted: false }),
      ServiceRecord.countDocuments({ ownerId, status: "cancelled", isDeleted: false }),
    ]);

    return { scheduled, completed, missed: cancelled };
  }

  // ─── Platform admin reports ─────────────────────────────────────────────

  async getTenantsReport() {
    const [total, active] = await Promise.all([
      Tenant.countDocuments({ isDeleted: false }),
      Tenant.countDocuments({ isDeleted: false, isActive: true }),
    ]);

    return { total, active, inactive: total - active };
  }

  async getSaaSRevenue(startDate?: string, endDate?: string) {
    const end = toDate(endDate, new Date());
    const start = toDate(startDate, new Date(end.getFullYear(), end.getMonth(), 1));

    const [totalResult, monthResult, activeTenants] = await Promise.all([
      Payment.aggregate([
        { $match: { status: "completed", isDeleted: false } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
      Payment.aggregate([
        { $match: { status: "completed", isDeleted: false, paidAt: { $gte: start, $lte: end } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
      Tenant.countDocuments({ isDeleted: false, isActive: true }),
    ]);

    const monthly = monthResult[0]?.total ?? 0;
    return {
      total: totalResult[0]?.total ?? 0,
      monthly,
      arpu: activeTenants > 0 ? Math.round((monthly / activeTenants) * 100) / 100 : 0,
    };
  }

  async getGrowthMetrics(startDate?: string, endDate?: string) {
    const end = toDate(endDate, new Date());
    const start = toDate(startDate, new Date(end.getFullYear(), end.getMonth(), 1));

    const [newTenants, cancelledTenants, totalAtStart] = await Promise.all([
      Tenant.countDocuments({ createdAt: { $gte: start, $lte: end }, isDeleted: false }),
      Tenant.countDocuments({
        "subscription.status": "cancelled",
        updatedAt: { $gte: start, $lte: end },
        isDeleted: false,
      }),
      Tenant.countDocuments({ createdAt: { $lt: start }, isDeleted: false }),
    ]);

    const churnRate = totalAtStart > 0 ? Math.round((cancelledTenants / totalAtStart) * 10000) / 100 : 0;
    const growthRate = totalAtStart > 0 ? Math.round(((newTenants - cancelledTenants) / totalAtStart) * 10000) / 100 : 0;

    return { newTenants, cancelledTenants, churnRatePercent: churnRate, growthRatePercent: growthRate };
  }

  async getRetentionReport(startDate?: string, endDate?: string) {
    const end = toDate(endDate, new Date());
    const start = toDate(startDate, new Date(end.getFullYear(), end.getMonth(), 1));

    const [activeAtStart, stillActive, revenueResult] = await Promise.all([
      Tenant.countDocuments({ createdAt: { $lt: start }, isDeleted: false }),
      Tenant.countDocuments({ createdAt: { $lt: start }, isDeleted: false, isActive: true }),
      Payment.aggregate([
        { $match: { status: "completed", isDeleted: false } },
        { $group: { _id: "$tenantId", total: { $sum: "$totalAmount" } } },
        { $group: { _id: null, avg: { $avg: "$total" } } },
      ]),
    ]);

    return {
      retentionRatePercent: activeAtStart > 0 ? Math.round((stillActive / activeAtStart) * 10000) / 100 : 0,
      averageRevenuePerTenant: Math.round((revenueResult[0]?.avg ?? 0) * 100) / 100,
    };
  }

  async getChurnReport(startDate?: string, endDate?: string) {
    const end = toDate(endDate, new Date());
    const start = toDate(startDate, new Date(end.getFullYear(), end.getMonth(), 1));

    const [churnedTenants, totalAtStart] = await Promise.all([
      Tenant.countDocuments({
        "subscription.status": "cancelled",
        updatedAt: { $gte: start, $lte: end },
        isDeleted: false,
      }),
      Tenant.countDocuments({ createdAt: { $lt: start }, isDeleted: false }),
    ]);

    return {
      churnedTenants,
      churnRatePercent: totalAtStart > 0 ? Math.round((churnedTenants / totalAtStart) * 10000) / 100 : 0,
    };
  }

  // ─── Export ─────────────────────────────────────────────────────────────

  toCsv(rows: Record<string, unknown>[]): string {
    if (rows.length === 0) return "";
    const headers = Object.keys(rows[0]);
    const escape = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")];
    for (const row of rows) {
      lines.push(headers.map((h) => escape((row as any)[h])).join(","));
    }
    return lines.join("\n");
  }
}

export const reportService = new ReportService();
