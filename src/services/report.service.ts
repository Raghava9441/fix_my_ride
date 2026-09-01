import mongoose from "mongoose";
import ExcelJS from "exceljs";
import { Vehicle } from "../models/Vehicle";
import { ServiceRecord } from "../models/ServiceRecord";
import { StaffProfile } from "../models/StaffProfile";
import { ServiceCenter } from "../models/ServiceCenter";
import { Tenant } from "../models/Tenant";
import { Account } from "../models/Account";
import { Payment } from "../models/Payment";
import { serviceRecordService } from "./serviceRecord.service";
import { ownerProfileService } from "./owner.service";
import { reminderService } from "./reminder.service";

function toDate(value: string | undefined, fallback: Date): Date {
  return value ? new Date(value) : fallback;
}

/** A KPI plus the same measure over the preceding, equal-length window. */
function delta(current: number, previous: number) {
  // A jump from zero is "new", not "+Infinity%" — the client renders `null`
  // as a dash rather than a meaningless percentage.
  const changePct =
    previous === 0 ? (current === 0 ? 0 : null) : Math.round(((current - previous) / previous) * 1000) / 10;
  return { value: current, previous, changePct };
}

/** Zero-fills a daily series so a quiet day is a gap in the line, not a missing point. */
function fillDailySeries(
  rows: { _id: string; revenue?: number; jobs?: number }[],
  start: Date,
  end: Date,
): { date: string; revenue: number; jobs: number }[] {
  const byDate = new Map(rows.map((r) => [r._id, r]));
  const out: { date: string; revenue: number; jobs: number }[] = [];

  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));

  while (cursor <= last) {
    const key = cursor.toISOString().slice(0, 10);
    const row = byDate.get(key);
    out.push({ date: key, revenue: row?.revenue ?? 0, jobs: row?.jobs ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return out;
}

export class ReportService {
  // ─── Dashboard overview ─────────────────────────────────────────────────

  /**
   * Everything the dashboard renders, in one round trip.
   *
   * Built as a single endpoint rather than letting the client assemble six
   * calls: a dashboard that fans out on mount pays six times the latency, and
   * its KPI tiles land at different moments so the page visibly reflows. The
   * aggregations here also share a `$match`, so the database does the work
   * once instead of scanning the same collection six times.
   *
   * Every KPI carries the same measure over the immediately preceding window
   * of equal length, so the UI can show direction without a second request.
   */
  async getCenterOverview(serviceCenterId: string, days = 30) {
    const centerObjId = new mongoose.Types.ObjectId(serviceCenterId);
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    const prevStart = new Date(start.getTime() - days * 24 * 60 * 60 * 1000);

    const inPeriod = { serviceCenterId: centerObjId, isDeleted: false, serviceDate: { $gte: start, $lte: end } };
    const inPrevPeriod = {
      serviceCenterId: centerObjId,
      isDeleted: false,
      serviceDate: { $gte: prevStart, $lt: start },
    };

    const sumRevenue = async (match: Record<string, unknown>) => {
      const [row] = await ServiceRecord.aggregate([
        { $match: { ...match, status: "completed" } },
        { $group: { _id: null, total: { $sum: "$cost.total" }, count: { $sum: 1 } } },
      ]);
      return { total: row?.total ?? 0, count: row?.count ?? 0 };
    };

    const [
      revenueNow,
      revenuePrev,
      jobsNow,
      jobsPrev,
      customersNow,
      customersPrev,
      vehiclesActive,
      trendRows,
      byStatus,
      byType,
      recent,
      upcomingReminders,
      overdueReminders,
    ] = await Promise.all([
      sumRevenue(inPeriod),
      sumRevenue(inPrevPeriod),
      ServiceRecord.countDocuments(inPeriod),
      ServiceRecord.countDocuments(inPrevPeriod),
      ServiceRecord.distinct("ownerId", inPeriod),
      ServiceRecord.distinct("ownerId", inPrevPeriod),
      Vehicle.countDocuments({
        "authorizedServiceCenters.serviceCenterId": centerObjId,
        "authorizedServiceCenters.status": "active",
        isDeleted: false,
      }),

      // Daily revenue and job count for the trend chart.
      ServiceRecord.aggregate([
        { $match: inPeriod },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$serviceDate" } },
            revenue: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$cost.total", 0] } },
            jobs: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      ServiceRecord.aggregate([
        { $match: inPeriod },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $project: { _id: 0, status: "$_id", count: 1 } },
      ]),

      ServiceRecord.aggregate([
        { $match: inPeriod },
        {
          $group: {
            _id: "$serviceType",
            count: { $sum: 1 },
            revenue: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$cost.total", 0] } },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 6 },
        { $project: { _id: 0, serviceType: "$_id", count: 1, revenue: 1 } },
      ]),

      ServiceRecord.find({ serviceCenterId: centerObjId, isDeleted: false })
        .sort({ serviceDate: -1 })
        .limit(8)
        .populate("vehicleId", "registrationNumber make model year")
        .lean(),

      reminderService.findUpcoming("", 30).catch(() => []),
      reminderService.findOverdue().catch(() => []),
    ]);

    const completed = byStatus.find((s: { status: string }) => s.status === "completed")?.count ?? 0;

    return {
      scope: "center" as const,
      generatedAt: new Date().toISOString(),
      // Taken from the data rather than assumed: the dashboard renders
      // aggregate totals and per-record costs side by side, and defaulting
      // one of them to a different currency shows the same money in two
      // symbols on the same screen.
      currency: (recent[0] as { cost?: { currency?: string } } | undefined)?.cost?.currency ?? "USD",
      period: { days, start: start.toISOString(), end: end.toISOString() },

      kpis: {
        revenue: delta(revenueNow.total, revenuePrev.total),
        jobs: delta(jobsNow, jobsPrev),
        customers: delta(customersNow.length, customersPrev.length),
        activeVehicles: delta(vehiclesActive, vehiclesActive),
        // Average repair order — the headline profitability metric in this
        // industry, and not derivable client-side without the completed count.
        averageRepairOrder: delta(
          revenueNow.count ? Math.round(revenueNow.total / revenueNow.count) : 0,
          revenuePrev.count ? Math.round(revenuePrev.total / revenuePrev.count) : 0,
        ),
        completionRate: delta(
          jobsNow ? Math.round((completed / jobsNow) * 100) : 0,
          0,
        ),
      },

      revenueTrend: fillDailySeries(trendRows, start, end),
      jobsByStatus: byStatus,
      jobsByType: byType,
      recentServiceRecords: recent,
      reminders: {
        upcoming: Array.isArray(upcomingReminders) ? upcomingReminders.slice(0, 6) : [],
        overdueCount: Array.isArray(overdueReminders) ? overdueReminders.length : 0,
      },
    };
  }

  /** The same shape for a vehicle owner: their fleet, their spend, their reminders. */
  async getOwnerOverview(ownerId: string, days = 30) {
    const ownerObjId = new mongoose.Types.ObjectId(ownerId);
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    const prevStart = new Date(start.getTime() - days * 24 * 60 * 60 * 1000);

    const inPeriod = { ownerId: ownerObjId, isDeleted: false, serviceDate: { $gte: start, $lte: end } };
    const inPrevPeriod = {
      ownerId: ownerObjId,
      isDeleted: false,
      serviceDate: { $gte: prevStart, $lt: start },
    };

    const spend = async (match: Record<string, unknown>) => {
      const [row] = await ServiceRecord.aggregate([
        { $match: { ...match, status: "completed" } },
        { $group: { _id: null, total: { $sum: "$cost.total" }, count: { $sum: 1 } } },
      ]);
      return { total: row?.total ?? 0, count: row?.count ?? 0 };
    };

    const [spendNow, spendPrev, jobsNow, jobsPrev, vehicleCount, trendRows, byStatus, byType, recent, upcoming, overdue] =
      await Promise.all([
        spend(inPeriod),
        spend(inPrevPeriod),
        ServiceRecord.countDocuments(inPeriod),
        ServiceRecord.countDocuments(inPrevPeriod),
        Vehicle.countDocuments({ currentOwnerId: ownerObjId, isDeleted: false }),
        ServiceRecord.aggregate([
          { $match: inPeriod },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$serviceDate" } },
              revenue: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$cost.total", 0] } },
              jobs: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        ServiceRecord.aggregate([
          { $match: inPeriod },
          { $group: { _id: "$status", count: { $sum: 1 } } },
          { $project: { _id: 0, status: "$_id", count: 1 } },
        ]),
        ServiceRecord.aggregate([
          { $match: inPeriod },
          {
            $group: {
              _id: "$serviceType",
              count: { $sum: 1 },
              revenue: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$cost.total", 0] } },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 6 },
          { $project: { _id: 0, serviceType: "$_id", count: 1, revenue: 1 } },
        ]),
        ServiceRecord.find({ ownerId: ownerObjId, isDeleted: false })
          .sort({ serviceDate: -1 })
          .limit(8)
          .populate("vehicleId", "registrationNumber make model year")
          .lean(),
        reminderService.findUpcoming(ownerId, 30).catch(() => []),
        reminderService.findOverdue(ownerId).catch(() => []),
      ]);

    const completed = byStatus.find((s: { status: string }) => s.status === "completed")?.count ?? 0;

    return {
      scope: "owner" as const,
      generatedAt: new Date().toISOString(),
      currency: (recent[0] as { cost?: { currency?: string } } | undefined)?.cost?.currency ?? "USD",
      period: { days, start: start.toISOString(), end: end.toISOString() },

      kpis: {
        revenue: delta(spendNow.total, spendPrev.total),
        jobs: delta(jobsNow, jobsPrev),
        customers: delta(0, 0),
        activeVehicles: delta(vehicleCount, vehicleCount),
        averageRepairOrder: delta(
          spendNow.count ? Math.round(spendNow.total / spendNow.count) : 0,
          spendPrev.count ? Math.round(spendPrev.total / spendPrev.count) : 0,
        ),
        completionRate: delta(jobsNow ? Math.round((completed / jobsNow) * 100) : 0, 0),
      },

      revenueTrend: fillDailySeries(trendRows, start, end),
      jobsByStatus: byStatus,
      jobsByType: byType,
      recentServiceRecords: recent,
      reminders: {
        upcoming: Array.isArray(upcoming) ? upcoming.slice(0, 6) : [],
        overdueCount: Array.isArray(overdue) ? overdue.length : 0,
      },
    };
  }

  /**
   * Platform-wide overview for an admin.
   *
   * Runs unscoped on purpose: the tenant plugin bypasses its `$match` when the
   * requester carries the `admin` role, which is what makes a cross-tenant
   * rollup possible at all. Only reachable behind the admin check in the
   * controller.
   */
  async getPlatformOverview(days = 30) {
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    const prevStart = new Date(start.getTime() - days * 24 * 60 * 60 * 1000);

    const inPeriod = { isDeleted: false, serviceDate: { $gte: start, $lte: end } };
    const inPrevPeriod = { isDeleted: false, serviceDate: { $gte: prevStart, $lt: start } };

    const sumRevenue = async (match: Record<string, unknown>) => {
      const [row] = await ServiceRecord.aggregate([
        { $match: { ...match, status: "completed" } },
        { $group: { _id: null, total: { $sum: "$cost.total" }, count: { $sum: 1 } } },
      ]);
      return { total: row?.total ?? 0, count: row?.count ?? 0 };
    };

    const [
      revenueNow,
      revenuePrev,
      jobsNow,
      jobsPrev,
      tenants,
      users,
      vehicles,
      trendRows,
      byStatus,
      byType,
      recent,
    ] = await Promise.all([
      sumRevenue(inPeriod),
      sumRevenue(inPrevPeriod),
      ServiceRecord.countDocuments(inPeriod),
      ServiceRecord.countDocuments(inPrevPeriod),
      Tenant.countDocuments({ isDeleted: false }),
      Account.countDocuments({ isDeleted: false }),
      Vehicle.countDocuments({ isDeleted: false }),
      ServiceRecord.aggregate([
        { $match: inPeriod },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$serviceDate" } },
            revenue: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$cost.total", 0] } },
            jobs: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      ServiceRecord.aggregate([
        { $match: inPeriod },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $project: { _id: 0, status: "$_id", count: 1 } },
      ]),
      ServiceRecord.aggregate([
        { $match: inPeriod },
        {
          $group: {
            _id: "$serviceType",
            count: { $sum: 1 },
            revenue: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$cost.total", 0] } },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 6 },
        { $project: { _id: 0, serviceType: "$_id", count: 1, revenue: 1 } },
      ]),
      ServiceRecord.find({ isDeleted: false })
        .sort({ serviceDate: -1 })
        .limit(8)
        .populate("vehicleId", "registrationNumber make model year")
        .lean(),
    ]);

    const completed = byStatus.find((s: { status: string }) => s.status === "completed")?.count ?? 0;

    return {
      scope: "platform" as const,
      generatedAt: new Date().toISOString(),
      currency: (recent[0] as { cost?: { currency?: string } } | undefined)?.cost?.currency ?? "USD",
      period: { days, start: start.toISOString(), end: end.toISOString() },

      kpis: {
        revenue: delta(revenueNow.total, revenuePrev.total),
        jobs: delta(jobsNow, jobsPrev),
        customers: delta(users, users),
        activeVehicles: delta(vehicles, vehicles),
        averageRepairOrder: delta(
          revenueNow.count ? Math.round(revenueNow.total / revenueNow.count) : 0,
          revenuePrev.count ? Math.round(revenuePrev.total / revenuePrev.count) : 0,
        ),
        completionRate: delta(jobsNow ? Math.round((completed / jobsNow) * 100) : 0, 0),
      },

      tenants,
      revenueTrend: fillDailySeries(trendRows, start, end),
      jobsByStatus: byStatus,
      jobsByType: byType,
      recentServiceRecords: recent,
      reminders: { upcoming: [], overdueCount: 0 },
    };
  }

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

  async toExcel(rows: Record<string, unknown>[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Report");

    if (rows.length > 0) {
      const headers = Object.keys(rows[0]);
      sheet.columns = headers.map((h) => ({ header: h, key: h, width: 20 }));
      sheet.addRows(rows);
      sheet.getRow(1).font = { bold: true };
    }

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}

export const reportService = new ReportService();
