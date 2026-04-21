import { StaffProfile } from "../models/StaffProfile";
import { Role } from "../models/Role";
import { ServiceCenter } from "../models/ServiceCenter";
import mongoose from "mongoose";

export interface CreateStaffProfileInput {
  accountId: string;
  serviceCenterId: string;
  roleId: string;
  employeeId?: string;
  employmentType?: "full_time" | "part_time" | "contractor" | "intern";
  workSchedule?: {
    monday?: { start?: string; end?: string; available?: boolean };
    tuesday?: { start?: string; end?: string; available?: boolean };
    wednesday?: { start?: string; end?: string; available?: boolean };
    thursday?: { start?: string; end?: string; available?: boolean };
    friday?: { start?: string; end?: string; available?: boolean };
    saturday?: { start?: string; end?: string; available?: boolean };
    sunday?: { start?: string; end?: string; available?: boolean };
  };
  skills?: Array<{
    name: string;
    level?: "beginner" | "intermediate" | "expert";
    certified?: boolean;
    certificationExpiry?: Date;
    yearsOfExperience?: number;
  }>;
  specializations?: string[];
}

export interface UpdateStaffProfileInput {
  roleId?: string;
  employeeId?: string;
  employmentStatus?: "active" | "on_leave" | "suspended" | "terminated";
  employmentType?: "full_time" | "part_time" | "contractor" | "intern";
  workSchedule?: {
    monday?: { start?: string; end?: string; available?: boolean };
    tuesday?: { start?: string; end?: string; available?: boolean };
    wednesday?: { start?: string; end?: string; available?: boolean };
    thursday?: { start?: string; end?: string; available?: boolean };
    friday?: { start?: string; end?: string; available?: boolean };
    saturday?: { start?: string; end?: string; available?: boolean };
    sunday?: { start?: string; end?: string; available?: boolean };
  };
  skills?: Array<{
    name: string;
    level?: "beginner" | "intermediate" | "expert";
    certified?: boolean;
    certificationExpiry?: Date;
    yearsOfExperience?: number;
  }>;
  specializations?: string[];
}

export interface StaffProfileFilters {
  page?: number;
  limit?: number;
  serviceCenterId?: string;
  employmentStatus?: string;
  roleId?: string;
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

export class StaffProfileService {
  async findAll(filters?: StaffProfileFilters): Promise<PaginatedResult<any>> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const query: any = { isDeleted: false };
    if (filters?.serviceCenterId)
      query.serviceCenterId = filters.serviceCenterId;
    if (filters?.employmentStatus)
      query.employmentStatus = filters.employmentStatus;
    if (filters?.roleId) query.roleId = filters.roleId;

    const [staff, total] = await Promise.all([
      StaffProfile.find(query)
        .populate("accountId", "email phone status")
        .populate("roleId", "name slug level")
        .populate("serviceCenterId", "name email")
        .skip(skip)
        .limit(limit)
        .sort({ joinedAt: -1 }),
      StaffProfile.countDocuments(query),
    ]);

    return {
      data: staff,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string): Promise<any | null> {
    return StaffProfile.findById(id)
      .populate("accountId", "email phone status lastLoginAt")
      .populate("roleId", "name slug level permissions")
      .populate("serviceCenterId", "name email phone address");
  }

  async findByAccountId(accountId: string): Promise<any | null> {
    return StaffProfile.findByAccount(accountId);
  }

  async findByServiceCenter(
    serviceCenterId: string,
    filters?: StaffProfileFilters,
  ): Promise<any[]> {
    return StaffProfile.findByServiceCenter(serviceCenterId, {
      roleId: filters?.roleId,
      status: filters?.employmentStatus,
    });
  }

  async create(input: CreateStaffProfileInput): Promise<any> {
    const existing = await StaffProfile.findOne({
      accountId: input.accountId,
      isDeleted: false,
    });

    if (existing) {
      throw new Error("Staff profile already exists for this account");
    }

    const role = await Role.findById(input.roleId);
    if (!role) {
      throw new Error("Role not found");
    }

    const serviceCenter = await ServiceCenter.findById(input.serviceCenterId);
    if (!serviceCenter) {
      throw new Error("Service center not found");
    }

    const staff = await StaffProfile.create({
      accountId: new mongoose.Types.ObjectId(input.accountId),
      serviceCenterId: new mongoose.Types.ObjectId(input.serviceCenterId),
      roleId: new mongoose.Types.ObjectId(input.roleId),
      employeeId: input.employeeId,
      employmentStatus: "active",
      employmentType: input.employmentType || "full_time",
      joinedAt: new Date(),
      workSchedule: input.workSchedule || {
        monday: { start: "09:00", end: "18:00", available: true },
        tuesday: { start: "09:00", end: "18:00", available: true },
        wednesday: { start: "09:00", end: "18:00", available: true },
        thursday: { start: "09:00", end: "18:00", available: true },
        friday: { start: "09:00", end: "18:00", available: true },
        saturday: { start: "09:00", end: "14:00", available: false },
        sunday: { available: false },
      },
      skills: input.skills || [],
      specializations: input.specializations || [],
      stats: {
        totalServicesPerformed: 0,
        totalRevenueGenerated: 0,
        customerSatisfaction: 0,
      },
      isDeleted: false,
    });

    return staff;
  }

  async update(
    id: string,
    updates: UpdateStaffProfileInput,
  ): Promise<any | null> {
    const updateObj: any = { ...updates };

    if (updates.roleId) {
      const role = await Role.findById(updates.roleId);
      if (!role) {
        throw new Error("Role not found");
      }
      updateObj.roleId = new mongoose.Types.ObjectId(updates.roleId);
    }

    if (updates.employmentStatus === "terminated") {
      updateObj.leftAt = new Date();
    }

    const staff = await StaffProfile.findByIdAndUpdate(id, updateObj, {
      new: true,
      runValidators: true,
    })
      .populate("accountId", "email phone")
      .populate("roleId", "name slug");

    return staff;
  }

  async delete(id: string): Promise<any | null> {
    const staff = await StaffProfile.findOneAndUpdate(
      { _id: id, isDeleted: false },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          employmentStatus: "terminated",
          leftAt: new Date(),
        },
      },
      { new: true },
    );

    return staff;
  }

  async addPermission(
    staffId: string,
    permissionId: string,
    grantedBy: string,
    reason?: string,
    expiresAt?: Date,
  ): Promise<any> {
    const staff = await StaffProfile.findById(staffId);
    if (!staff) {
      throw new Error("Staff profile not found");
    }

    const existing = staff.customPermissions.find(
      (p) => p.permission.toString() === permissionId,
    );

    if (existing) {
      throw new Error("Permission already granted");
    }

    staff.customPermissions.push({
      permission: new mongoose.Types.ObjectId(permissionId),
      grantedBy: new mongoose.Types.ObjectId(grantedBy),
      grantedAt: new Date(),
      expiresAt,
      reason,
    });

    await staff.save();
    return staff;
  }

  async removePermission(staffId: string, permissionId: string): Promise<any> {
    const staff = await StaffProfile.findById(staffId);
    if (!staff) {
      throw new Error("Staff profile not found");
    }

    staff.customPermissions = staff.customPermissions.filter(
      (p) => p.permission.toString() !== permissionId,
    );

    await staff.save();
    return staff;
  }

  async denyPermission(
    staffId: string,
    permissionId: string,
    deniedBy: string,
    reason?: string,
  ): Promise<any> {
    const staff = await StaffProfile.findById(staffId);
    if (!staff) {
      throw new Error("Staff profile not found");
    }

    const existing = staff.deniedPermissions.find(
      (p) => p.permission.toString() === permissionId,
    );

    if (existing) {
      existing.deniedAt = new Date();
      existing.deniedBy = new mongoose.Types.ObjectId(deniedBy);
      existing.reason = reason;
    } else {
      staff.deniedPermissions.push({
        permission: new mongoose.Types.ObjectId(permissionId),
        deniedBy: new mongoose.Types.ObjectId(deniedBy),
        deniedAt: new Date(),
        reason,
      });
    }

    await staff.save();
    return staff;
  }

  async getPermissions(staffId: string): Promise<string[]> {
    const staff = await StaffProfile.findById(staffId);
    if (!staff) {
      throw new Error("Staff profile not found");
    }

    return staff.getPermissions();
  }

  async canAccess(
    staffId: string,
    permissionKey: string,
    resourceId?: string,
  ): Promise<boolean> {
    const staff = await StaffProfile.findById(staffId);
    if (!staff) {
      return false;
    }

    return staff.can(permissionKey, resourceId);
  }

  async isAdmin(staffId: string): Promise<boolean> {
    const staff = await StaffProfile.findById(staffId);
    if (!staff) {
      return false;
    }

    return staff.isAdmin();
  }

  async isManager(staffId: string): Promise<boolean> {
    const staff = await StaffProfile.findById(staffId);
    if (!staff) {
      return false;
    }

    return staff.isManager();
  }

  async getSchedule(staffId: string): Promise<any> {
    const staff = await StaffProfile.findById(staffId);
    if (!staff) {
      throw new Error("Staff profile not found");
    }

    return staff.workSchedule;
  }

  async updateSchedule(staffId: string, schedule: any): Promise<any> {
    const staff = await StaffProfile.findOneAndUpdate(
      { _id: staffId, isDeleted: false },
      { $set: { workSchedule: schedule } },
      { new: true },
    );

    if (!staff) {
      throw new Error("Staff profile not found");
    }

    return staff;
  }

  async getPerformance(staffId: string): Promise<any> {
    const staff = await StaffProfile.findById(staffId);
    if (!staff) {
      throw new Error("Staff profile not found");
    }

    return {
      servicesCompleted: staff.stats.totalServicesPerformed,
      revenueGenerated: staff.stats.totalRevenueGenerated,
      rating: staff.averageRating,
      totalReviews: staff.totalReviews,
    };
  }

  async updateStats(
    staffId: string,
    servicesPerformed: number = 0,
    revenueGenerated: number = 0,
  ): Promise<any> {
    const staff = await StaffProfile.findById(staffId);
    if (!staff) {
      throw new Error("Staff profile not found");
    }

    staff.stats.totalServicesPerformed += servicesPerformed;
    staff.stats.totalRevenueGenerated += revenueGenerated;

    await staff.save();
    return staff;
  }
}

export const staffProfileService = new StaffProfileService();
