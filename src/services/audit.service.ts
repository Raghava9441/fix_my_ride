import { AuditLog } from "../models/AuditLog";
import mongoose from "mongoose";

export interface CreateAuditLogInput {
  tenantId?: string;
  actorId: string;
  actorRole: "owner" | "staff" | "admin" | "system";
  actorEmail?: string;
  action:
    | "CREATE"
    | "READ"
    | "UPDATE"
    | "DELETE"
    | "LOGIN"
    | "LOGOUT"
    | "GRANT_ACCESS"
    | "REVOKE_ACCESS";
  entityType:
    | "Vehicle"
    | "ServiceRecord"
    | "Account"
    | "OwnerProfile"
    | "StaffProfile"
    | "ServiceCenter";
  entityId: string;
  changes?: Array<{
    field: string;
    oldValue: any;
    newValue: any;
  }>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogFilters {
  page?: number;
  limit?: number;
  tenantId?: string;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class AuditLogService {
  async findAll(filters?: AuditLogFilters): Promise<PaginatedResult<any>> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const query: any = {};
    if (filters?.tenantId) query.tenantId = filters.tenantId;
    if (filters?.actorId) query.actorId = filters.actorId;
    if (filters?.entityType) query.entityType = filters.entityType;
    if (filters?.entityId) query.entityId = filters.entityId;
    if (filters?.action) query.action = filters.action;
    if (filters?.startDate || filters?.endDate) {
      query.recordedAt = {};
      if (filters?.startDate) query.recordedAt.$gte = filters.startDate;
      if (filters?.endDate) query.recordedAt.$lte = filters.endDate;
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate("actorId", "email")
        .skip(skip)
        .limit(limit)
        .sort({ recordedAt: -1 }),
      AuditLog.countDocuments(query),
    ]);

    return {
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string): Promise<any | null> {
    return AuditLog.findById(id);
  }

  async findByEntity(
    entityType: string,
    entityId: string,
    options?: { limit?: number },
  ): Promise<any[]> {
    return AuditLog.find({
      entityType,
      entityId,
    })
      .populate("actorId", "email")
      .sort({ recordedAt: -1 })
      .limit(options?.limit || 50);
  }

  async findByActor(
    actorId: string,
    options?: { limit?: number; startDate?: Date; endDate?: Date },
  ): Promise<any[]> {
    const query: any = { actorId };
    if (options?.startDate || options?.endDate) {
      query.recordedAt = {};
      if (options?.startDate) query.recordedAt.$gte = options.startDate;
      if (options?.endDate) query.recordedAt.$lte = options.endDate;
    }

    return AuditLog.find(query)
      .sort({ recordedAt: -1 })
      .limit(options?.limit || 50);
  }

  async create(input: CreateAuditLogInput): Promise<any> {
    const log = await AuditLog.create({
      tenantId: input.tenantId
        ? new mongoose.Types.ObjectId(input.tenantId)
        : undefined,
      actorId: new mongoose.Types.ObjectId(input.actorId),
      actorRole: input.actorRole,
      actorEmail: input.actorEmail,
      action: input.action,
      entityType: input.entityType,
      entityId: new mongoose.Types.ObjectId(input.entityId),
      changes: input.changes || [],
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      recordedAt: new Date(),
    });

    return log;
  }

  async logAction(
    actorId: string,
    actorRole: string,
    actorEmail: string,
    action: string,
    entityType: string,
    entityId: string,
    changes?: Array<{ field: string; oldValue: any; newValue: any }>,
    ipAddress?: string,
    userAgent?: string,
    tenantId?: string,
  ): Promise<any> {
    return this.create({
      tenantId,
      actorId,
      actorRole: actorRole as any,
      actorEmail,
      action: action as any,
      entityType,
      entityId,
      changes,
      ipAddress,
      userAgent,
    });
  }

  async getEntityHistory(entityType: string, entityId: string): Promise<any[]> {
    return this.findByEntity(entityType, entityId, { limit: 100 });
  }

  async getActorActivity(
    actorId: string,
    options?: { limit?: number },
  ): Promise<any[]> {
    return this.findByActor(actorId, options);
  }

  async getRecentActivity(
    tenantId?: string,
    limit: number = 50,
  ): Promise<any[]> {
    const query: any = {};
    if (tenantId) query.tenantId = tenantId;

    return AuditLog.find(query)
      .populate("actorId", "email")
      .sort({ recordedAt: -1 })
      .limit(limit);
  }

  async getActivitySummary(
    tenantId?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<any> {
    const query: any = {};
    if (tenantId) query.tenantId = tenantId;
    if (startDate || endDate) {
      query.recordedAt = {};
      if (startDate) query.recordedAt.$gte = startDate;
      if (endDate) query.recordedAt.$lte = endDate;
    }

    const result = await AuditLog.aggregate([
      { $match: query },
      {
        $group: {
          _id: { action: "$action", entityType: "$entityType" },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    return result;
  }

  async getUserActivitySummary(
    actorId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<any> {
    const match: any = { actorId: new mongoose.Types.ObjectId(actorId) };
    if (startDate || endDate) {
      match.recordedAt = {};
      if (startDate) match.recordedAt.$gte = startDate;
      if (endDate) match.recordedAt.$lte = endDate;
    }

    const result = await AuditLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$action",
          count: { $sum: 1 },
        },
      },
    ]);

    return result;
  }

  async deleteOld(daysToKeep: number = 730): Promise<{ deleted: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await AuditLog.deleteMany({
      recordedAt: { $lt: cutoffDate },
    });

    return { deleted: result.deletedCount };
  }
}

export const auditLogService = new AuditLogService();
