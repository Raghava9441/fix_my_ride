import { OwnerProfile } from "../models/OwnerProfile";
import { Vehicle } from "../models/Vehicle";
import { ServiceRecord } from "../models/ServiceRecord";
import { Owner } from "../models/OwnerProfile";
import mongoose from "mongoose";

export interface CreateOwnerProfileInput {
  accountId: string;
  firstName: string;
  lastName: string;
  profileImage?: string;
  alternateEmail?: string;
  alternatePhone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    coordinates?: [number, number];
  };
  preferredServiceCenterId?: string;
}

export interface UpdateOwnerProfileInput {
  firstName?: string;
  lastName?: string;
  profileImage?: string;
  alternateEmail?: string;
  alternatePhone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    coordinates?: [number, number];
  };
  defaultVehicleId?: string;
  preferredServiceCenterId?: string;
  notificationPreferences?: {
    serviceReminders?: { email?: boolean; sms?: boolean; push?: boolean };
    invoiceNotifications?: { email?: boolean; sms?: boolean };
    centerCommunications?: { email?: boolean; sms?: boolean };
    quietHours?: { enabled?: boolean; start?: string; end?: string };
  };
}

export interface OwnerProfileFilters {
  page?: number;
  limit?: number;
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

export class OwnerProfileService {
  async findAll(filters?: OwnerProfileFilters): Promise<PaginatedResult<any>> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const [owners, total] = await Promise.all([
      OwnerProfile.find({ isDeleted: false })
        .populate("defaultVehicleId")
        .populate("preferredServiceCenterId", "name email phone")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      OwnerProfile.countDocuments({ isDeleted: false }),
    ]);

    return {
      data: owners,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string): Promise<any | null> {
    return OwnerProfile.findOne({ _id: id, isDeleted: false })
      .populate("defaultVehicleId")
      .populate("preferredServiceCenterId", "name email phone address");
  }

  async findByAccountId(accountId: string): Promise<any | null> {
    return OwnerProfile.findOne({ accountId: accountId, isDeleted: false })
      .populate("defaultVehicleId")
      .populate("preferredServiceCenterId", "name email phone");
  }

  async findByEmail(email: string): Promise<any | null> {
    return OwnerProfile.findOne({ "accountId.email": email, isDeleted: false });
  }

  async create(input: CreateOwnerProfileInput): Promise<any> {
    const existing = await OwnerProfile.findOne({
      accountId: input.accountId,
      isDeleted: false,
    });

    if (existing) {
      throw new Error("Owner profile already exists for this account");
    }

    const owner = await OwnerProfile.create({
      accountId: new mongoose.Types.ObjectId(input.accountId),
      firstName: input.firstName,
      lastName: input.lastName,
      profileImage: input.profileImage,
      alternateEmail: input.alternateEmail,
      alternatePhone: input.alternatePhone,
      address: input.address,
      preferredServiceCenterId: input.preferredServiceCenterId
        ? new mongoose.Types.ObjectId(input.preferredServiceCenterId)
        : undefined,
      vehicles: [],
      notificationPreferences: {
        serviceReminders: { email: true, sms: true, push: true },
        invoiceNotifications: { email: true, sms: false },
        centerCommunications: { email: true, sms: true },
        quietHours: { enabled: false },
      },
      stats: {
        totalVehicles: 0,
        totalServices: 0,
        totalSpent: 0,
        memberSince: new Date(),
      },
      isDeleted: false,
    });

    return owner;
  }

  async update(
    id: string,
    updates: UpdateOwnerProfileInput,
  ): Promise<any | null> {
    const owner = await OwnerProfile.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: updates },
      { new: true, runValidators: true },
    );

    return owner;
  }

  async delete(id: string): Promise<any | null> {
    const owner = await OwnerProfile.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true },
    );

    return owner;
  }

  async addVehicle(
    ownerId: string,
    vehicleId: string,
    isPrimary: boolean = false,
  ): Promise<any> {
    const owner = await OwnerProfile.findOne({
      _id: ownerId,
      isDeleted: false,
    });

    if (!owner) {
      throw new Error("Owner profile not found");
    }

    const vehicleExists = owner.vehicles.some(
      (v) => v.vehicleId.toString() === vehicleId,
    );

    if (vehicleExists) {
      throw new Error("Vehicle already added to this owner");
    }

    if (isPrimary) {
      owner.vehicles.forEach((v) => (v.isPrimary = false));
    }

    owner.vehicles.push({
      vehicleId: new mongoose.Types.ObjectId(vehicleId),
      addedAt: new Date(),
      isPrimary,
    });

    owner.stats.totalVehicles = owner.vehicles.length;

    if (isPrimary) {
      owner.defaultVehicleId = new mongoose.Types.ObjectId(vehicleId);
    }

    await owner.save();
    return owner;
  }

  async removeVehicle(ownerId: string, vehicleId: string): Promise<any> {
    const owner = await OwnerProfile.findOne({
      _id: ownerId,
      isDeleted: false,
    });

    if (!owner) {
      throw new Error("Owner profile not found");
    }

    owner.vehicles = owner.vehicles.filter(
      (v) => v.vehicleId.toString() !== vehicleId,
    );
    owner.stats.totalVehicles = owner.vehicles.length;

    if (owner.defaultVehicleId?.toString() === vehicleId) {
      owner.defaultVehicleId = owner.vehicles[0]?.vehicleId;
    }

    await owner.save();
    return owner;
  }

  async getVehicles(ownerId: string): Promise<any[]> {
    const owner = await OwnerProfile.findOne({
      _id: ownerId,
      isDeleted: false,
    }).populate({
      path: "vehicles.vehicleId",
      populate: [
        { path: "currentOwnerId", select: "firstName lastName" },
        { path: "authorizedServiceCenters.serviceCenterId", select: "name" },
      ],
    });

    if (!owner) {
      throw new Error("Owner profile not found");
    }

    return owner.vehicles.map((v) => ({
      ...v.vehicleId.toObject(),
      isPrimary: v.isPrimary,
      addedAt: v.addedAt,
    }));
  }

  async getServiceHistory(
    ownerId: string,
    filters?: { page?: number; limit?: number },
  ): Promise<PaginatedResult<any>> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      ServiceRecord.find({ ownerId: ownerId, isDeleted: false })
        .populate("vehicleId", "registrationNumber make model year")
        .populate("serviceCenterId", "name")
        .skip(skip)
        .limit(limit)
        .sort({ serviceDate: -1 }),
      ServiceRecord.countDocuments({ ownerId: ownerId, isDeleted: false }),
    ]);

    return {
      data: records,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getExpenses(ownerId: string): Promise<any> {
    const result = await ServiceRecord.aggregate([
      {
        $match: {
          ownerId: new mongoose.Types.ObjectId(ownerId),
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$cost.total" },
          byServiceType: {
            $push: {
              serviceType: "$serviceType",
              total: "$cost.total",
            },
          },
        },
      },
    ]);

    if (result.length === 0) {
      return { total: 0, currency: "USD", breakdown: {} };
    }

    const breakdown: Record<string, number> = {};
    result[0].byServiceType.forEach((item: any) => {
      breakdown[item.serviceType] =
        (breakdown[item.serviceType] || 0) + item.total;
    });

    return {
      total: result[0].total,
      currency: "USD",
      breakdown,
    };
  }

  async updateStats(ownerId: string): Promise<any> {
    const owner = await OwnerProfile.findOne({
      _id: ownerId,
      isDeleted: false,
    });

    if (!owner) {
      throw new Error("Owner profile not found");
    }

    const [vehicleCount, serviceCount, expenseResult] = await Promise.all([
      Vehicle.countDocuments({
        currentOwnerId: ownerId,
        isDeleted: false,
      }),
      ServiceRecord.countDocuments({
        ownerId: ownerId,
        isDeleted: false,
      }),
      ServiceRecord.aggregate([
        {
          $match: {
            ownerId: new mongoose.Types.ObjectId(ownerId),
            isDeleted: false,
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$cost.total" },
          },
        },
      ]),
    ]);

    owner.stats.totalVehicles = vehicleCount;
    owner.stats.totalServices = serviceCount;
    owner.stats.totalSpent = expenseResult[0]?.total || 0;

    await owner.save();
    return owner;
  }

  async canAccessResource(
    ownerId: string,
    resource: string,
    resourceId: string,
  ): Promise<boolean> {
    const owner = await OwnerProfile.findOne({
      _id: ownerId,
      isDeleted: false,
    });

    if (!owner) {
      return false;
    }

    return owner.ownsResource(resource, resourceId);
  }
}

export const ownerProfileService = new OwnerProfileService();
