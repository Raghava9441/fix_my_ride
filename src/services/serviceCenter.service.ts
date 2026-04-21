import { ServiceCenter } from "../models/ServiceCenter";
import { SubscriptionPlan } from "../models/SubscriptionPlan";
import { StaffProfile } from "../models/StaffProfile";
import { Vehicle } from "../models/Vehicle";
import { ServiceRecord } from "../models/ServiceRecord";
import mongoose from "mongoose";

export interface CreateServiceCenterInput {
  tenantId: string;
  name: string;
  slug?: string;
  businessRegistrationNumber: string;
  email: string;
  phone: string;
  website?: string;
  address?: {
    street?: string;
    city: string;
    state?: string;
    country?: string;
    postalCode?: string;
    coordinates?: { type?: string; coordinates?: [number, number] };
  };
  subscription?: {
    planId: string;
    trialEndsAt?: Date;
  };
  settings?: {
    currency?: string;
    timezone?: string;
    businessHours?: any;
  };
  servicesOffered?: Array<{
    name: string;
    category?: string;
    duration?: number;
    basePrice?: number;
    isActive?: boolean;
  }>;
  createdBy: string;
}

export interface UpdateServiceCenterInput {
  name?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    coordinates?: { type?: string; coordinates?: [number, number] };
  };
  settings?: {
    currency?: string;
    timezone?: string;
    businessHours?: any;
  };
  servicesOffered?: Array<{
    name: string;
    category?: string;
    duration?: number;
    basePrice?: number;
    isActive?: boolean;
  }>;
  subscription?: {
    status?: "trial" | "active" | "expired" | "suspended" | "cancelled";
    expiresAt?: Date;
  };
}

export interface ServiceCenterFilters {
  page?: number;
  limit?: number;
  tenantId?: string;
  city?: string;
  status?: string;
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

export class ServiceCenterService {
  async findAll(filters?: ServiceCenterFilters): Promise<PaginatedResult<any>> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const query: any = { isDeleted: false };
    if (filters?.tenantId) query.tenantId = filters.tenantId;
    if (filters?.city) query["address.city"] = filters.city;
    if (filters?.status) query["subscription.status"] = filters.status;

    const [centers, total] = await Promise.all([
      ServiceCenter.find(query)
        .populate("tenantId", "name slug")
        .populate("subscription.planId", "name price")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      ServiceCenter.countDocuments(query),
    ]);

    return {
      data: centers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string): Promise<any | null> {
    return ServiceCenter.findById(id)
      .populate("tenantId", "name slug")
      .populate("subscription.planId", "name price features");
  }

  async findBySlug(slug: string, tenantId?: string): Promise<any | null> {
    const query: any = { slug, isDeleted: false };
    if (tenantId) {
      query.tenantId = new mongoose.Types.ObjectId(tenantId);
    }
    return ServiceCenter.findOne(query);
  }

  async findByTenant(tenantId: string): Promise<any[]> {
    return ServiceCenter.find({ tenantId: tenantId, isDeleted: false })
      .select("name slug email phone address")
      .sort({ name: 1 });
  }

  async create(input: CreateServiceCenterInput): Promise<any> {
    const existing = await ServiceCenter.findOne({
      businessRegistrationNumber: input.businessRegistrationNumber,
      isDeleted: false,
    });

    if (existing) {
      throw new Error(
        "Service center with this registration number already exists",
      );
    }

    let planId: mongoose.Types.ObjectId | undefined;
    if (input.subscription?.planId) {
      const plan = await SubscriptionPlan.findOne({
        slug: input.subscription.planId,
      });
      if (!plan) {
        throw new Error("Subscription plan not found");
      }
      planId = plan._id;
    }

    const slug =
      input.slug || input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    const center = await ServiceCenter.create({
      tenantId: new mongoose.Types.ObjectId(input.tenantId),
      name: input.name,
      slug,
      businessRegistrationNumber: input.businessRegistrationNumber,
      email: input.email.toLowerCase(),
      phone: input.phone,
      website: input.website,
      address: {
        ...input.address,
        city: input.address?.city || "",
      },
      subscription: {
        planId,
        status: "trial",
        startedAt: new Date(),
        trialEndsAt:
          input.subscription?.trialEndsAt ||
          new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
      settings: {
        currency: input.settings?.currency || "USD",
        timezone: input.settings?.timezone || "America/New_York",
        businessHours: input.settings?.businessHours || {
          monday: { open: "09:00", close: "18:00", closed: false },
          tuesday: { open: "09:00", close: "18:00", closed: false },
          wednesday: { open: "09:00", close: "18:00", closed: false },
          thursday: { open: "09:00", close: "18:00", closed: false },
          friday: { open: "09:00", close: "18:00", closed: false },
          saturday: { open: "09:00", close: "14:00", closed: true },
          sunday: { closed: true },
        },
      },
      servicesOffered: input.servicesOffered || [],
      createdBy: new mongoose.Types.ObjectId(input.createdBy),
      stats: {
        totalVehiclesServed: 0,
        activeVehicles: 0,
        totalServiceRecords: 0,
        averageRating: 0,
        totalRevenue: 0,
      },
      isDeleted: false,
    });

    return center;
  }

  async update(
    id: string,
    updates: UpdateServiceCenterInput,
  ): Promise<any | null> {
    const updateObj: any = { ...updates };

    if (updates.address?.coordinates) {
      updateObj.address = {
        ...updates.address,
        coordinates: updates.address.coordinates,
      };
    }

    const center = await ServiceCenter.findByIdAndUpdate(id, updateObj, {
      new: true,
      runValidators: true,
    })
      .populate("tenantId", "name slug")
      .populate("subscription.planId", "name price");

    return center;
  }

  async delete(id: string): Promise<any | null> {
    const center = await ServiceCenter.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true },
    );

    return center;
  }

  async getStaff(serviceCenterId: string): Promise<any[]> {
    return StaffProfile.findByServiceCenter(serviceCenterId)
      .populate("accountId", "email phone status")
      .populate("roleId", "name slug level");
  }

  async getVehicles(serviceCenterId: string): Promise<any[]> {
    return Vehicle.find({
      "authorizedServiceCenters.serviceCenterId": serviceCenterId,
      "authorizedServiceCenters.status": "active",
      isDeleted: false,
    })
      .populate("currentOwnerId", "firstName lastName")
      .sort({ "authorizedServiceCenters.authorizedAt": -1 });
  }

  async getServiceRecords(
    serviceCenterId: string,
    filters?: {
      page?: number;
      limit?: number;
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<PaginatedResult<any>> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const query: any = { serviceCenterId: serviceCenterId, isDeleted: false };

    if (filters?.startDate || filters?.endDate) {
      query.serviceDate = {};
      if (filters?.startDate) query.serviceDate.$gte = filters.startDate;
      if (filters?.endDate) query.serviceDate.$lte = filters.endDate;
    }

    const [records, total] = await Promise.all([
      ServiceRecord.find(query)
        .populate("vehicleId", "registrationNumber make model year")
        .populate("ownerId", "firstName lastName")
        .populate("technicianId", "accountId")
        .skip(skip)
        .limit(limit)
        .sort({ serviceDate: -1 }),
      ServiceRecord.countDocuments(query),
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

  async updateStats(serviceCenterId: string): Promise<any> {
    const center = await ServiceCenter.findById(serviceCenterId);
    if (!center) {
      throw new Error("Service center not found");
    }

    const [vehicleCount, recordCount, revenueResult] = await Promise.all([
      Vehicle.countDocuments({
        "authorizedServiceCenters.serviceCenterId": serviceCenterId,
        "authorizedServiceCenters.status": "active",
        isDeleted: false,
      }),
      ServiceRecord.countDocuments({
        serviceCenterId: serviceCenterId,
        isDeleted: false,
      }),
      ServiceRecord.aggregate([
        {
          $match: {
            serviceCenterId: new mongoose.Types.ObjectId(serviceCenterId),
            isDeleted: false,
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$cost.total" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    center.stats.activeVehicles = vehicleCount;
    center.stats.totalServiceRecords = recordCount;
    center.stats.totalRevenue = revenueResult[0]?.total || 0;

    await center.save();
    return center;
  }

  async addService(
    serviceCenterId: string,
    service: {
      name: string;
      category?: string;
      duration?: number;
      basePrice?: number;
    },
  ): Promise<any> {
    const center = await ServiceCenter.findById(serviceCenterId);
    if (!center) {
      throw new Error("Service center not found");
    }

    center.servicesOffered.push({
      name: service.name,
      category: service.category,
      duration: service.duration,
      basePrice: service.basePrice,
      isActive: true,
    });

    await center.save();
    return center;
  }

  async removeService(
    serviceCenterId: string,
    serviceName: string,
  ): Promise<any> {
    const center = await ServiceCenter.findById(serviceCenterId);
    if (!center) {
      throw new Error("Service center not found");
    }

    center.servicesOffered = center.servicesOffered.filter(
      (s) => s.name !== serviceName,
    );

    await center.save();
    return center;
  }

  async updateSubscription(
    serviceCenterId: string,
    status: "trial" | "active" | "expired" | "suspended" | "cancelled",
    expiresAt?: Date,
  ): Promise<any> {
    const center = await ServiceCenter.findOneAndUpdate(
      { _id: serviceCenterId, isDeleted: false },
      {
        $set: {
          "subscription.status": status,
          ...(expiresAt && { "subscription.expiresAt": expiresAt }),
        },
      },
      { new: true },
    );

    if (!center) {
      throw new Error("Service center not found");
    }

    return center;
  }
}

export const serviceCenterService = new ServiceCenterService();
