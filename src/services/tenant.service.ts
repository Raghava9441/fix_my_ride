import { Tenant } from "../models/Tenant";
import { SubscriptionPlan } from "../models/SubscriptionPlan";
import { Account } from "../models/Account";
import { Vehicle } from "../models/Vehicle";
import mongoose from "mongoose";

export interface CreateTenantInput {
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  website?: string;
  contactEmail: string;
  contactPhone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    timezone?: string;
    currency?: string;
  };
  ownerId: string;
}

export interface UpdateTenantInput {
  name?: string;
  description?: string;
  logoUrl?: string;
  website?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    timezone?: string;
    currency?: string;
  };
  billing?: {
    companyName?: string;
    taxId?: string;
    billingEmail?: string;
    billingAddress?: {
      street?: string;
      city?: string;
      state?: string;
      country?: string;
      postalCode?: string;
    };
  };
  settings?: {
    enableMfa?: boolean;
    requireEmailVerification?: boolean;
    allowSignups?: boolean;
    sessionTimeoutMinutes?: number;
    passwordPolicy?: {
      minLength?: number;
      requireUppercase?: boolean;
      requireLowercase?: boolean;
      requireNumbers?: boolean;
      requireSpecialChars?: boolean;
    };
  };
  features?: string[];
}

export interface TenantFilters {
  page?: number;
  limit?: number;
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

export class TenantService {
  async findAll(filters?: TenantFilters): Promise<PaginatedResult<any>> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const query: any = { isDeleted: false };
    if (filters?.status) query["subscription.status"] = filters.status;

    const [tenants, total] = await Promise.all([
      Tenant.find(query)
        .populate("subscription.planId", "name price type")
        .populate("ownerId", "email")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Tenant.countDocuments(query),
    ]);

    return {
      data: tenants,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string): Promise<any | null> {
    return Tenant.findById(id)
      .populate("subscription.planId", "name price type features")
      .populate("ownerId", "email");
  }

  async findBySlug(slug: string): Promise<any | null> {
    return Tenant.findBySlug(slug);
  }

  async findByEmail(email: string): Promise<any | null> {
    return Tenant.findOne({
      contactEmail: email.toLowerCase(),
      isDeleted: false,
    });
  }

  async create(input: CreateTenantInput): Promise<any> {
    const existing = await Tenant.findOne({
      slug: input.slug.toLowerCase(),
      isDeleted: false,
    });

    if (existing) {
      throw new Error("Tenant with this slug already exists");
    }

    const defaultPlan = await SubscriptionPlan.findOne({ slug: "free" });
    if (!defaultPlan) {
      throw new Error("Default subscription plan not found");
    }

    const tenant = await Tenant.create({
      name: input.name,
      slug: input.slug.toLowerCase(),
      description: input.description,
      logoUrl: input.logoUrl,
      website: input.website,
      contactEmail: input.contactEmail.toLowerCase(),
      contactPhone: input.contactPhone,
      address: input.address || {
        country: "US",
        timezone: "UTC",
        currency: "USD",
      },
      subscription: {
        planId: defaultPlan._id,
        status: "trial",
        startedAt: new Date(),
        trialEndsAt: new Date(
          Date.now() + defaultPlan.trialDays * 24 * 60 * 60 * 1000,
        ),
      },
      limits: {
        maxVehicles: defaultPlan.limits.maxVehicles,
        maxStaff: defaultPlan.limits.maxStaff,
        maxServiceCenters: defaultPlan.limits.maxServiceCenters,
        maxStorageGB: defaultPlan.limits.maxStorageGB,
        maxApiCallsPerMonth: defaultPlan.limits.maxApiCallsPerMonth,
      },
      features: defaultPlan.features
        .filter((f) => f.included)
        .map((f) => f.name),
      settings: {
        enableMfa: true,
        requireEmailVerification: true,
        allowSignups: true,
        sessionTimeoutMinutes: 60,
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: false,
        },
      },
      ownerId: new mongoose.Types.ObjectId(input.ownerId),
      isActive: true,
      isDeleted: false,
    });

    return tenant;
  }

  async update(id: string, updates: UpdateTenantInput): Promise<any | null> {
    const tenant = await Tenant.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    })
      .populate("subscription.planId", "name price")
      .populate("ownerId", "email");

    return tenant;
  }

  async delete(id: string): Promise<any | null> {
    const tenant = await Tenant.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date(), isActive: false } },
      { new: true },
    );

    return tenant;
  }

  async updateSubscription(
    id: string,
    planId: string,
    status: "trial" | "active" | "expired" | "suspended" | "cancelled",
    expiresAt?: Date,
  ): Promise<any> {
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      throw new Error("Subscription plan not found");
    }

    const tenant = await Tenant.findByIdAndUpdate(
      id,
      {
        $set: {
          "subscription.planId": planId,
          "subscription.status": status,
          "subscription.expiresAt": expiresAt,
          limits: {
            maxVehicles: plan.limits.maxVehicles,
            maxStaff: plan.limits.maxStaff,
            maxServiceCenters: plan.limits.maxServiceCenters,
            maxStorageGB: plan.limits.maxStorageGB,
            maxApiCallsPerMonth: plan.limits.maxApiCallsPerMonth,
          },
          features: plan.features.filter((f) => f.included).map((f) => f.name),
        },
      },
      { new: true },
    );

    return tenant;
  }

  async canAddResource(
    tenantId: string,
    resourceType: "vehicles" | "staff" | "serviceCenters",
  ): Promise<boolean> {
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return false;
    }

    let currentCount = 0;
    switch (resourceType) {
      case "vehicles":
        currentCount = await Vehicle.countDocuments({
          tenantId,
          isDeleted: false,
        });
        break;
    }

    return tenant.isWithinLimits(resourceType, currentCount);
  }

  async canAccessFeature(
    tenantId: string,
    featureName: string,
  ): Promise<boolean> {
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return false;
    }

    return tenant.canAccessFeature(featureName);
  }

  async getStats(tenantId: string): Promise<any> {
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    const [totalUsers, totalVehicles, totalServiceRecords] = await Promise.all([
      Account.countDocuments({ tenantId, isDeleted: false }),
      Vehicle.countDocuments({ tenantId, isDeleted: false }),
      mongoose.model("ServiceRecord").countDocuments({
        tenantId,
        isDeleted: false,
      }),
    ]);

    return {
      totalUsers,
      totalVehicles,
      totalServiceRecords,
      limits: tenant.limits,
    };
  }

  async updateStats(tenantId: string): Promise<any> {
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    const [totalUsers, totalVehicles, totalServiceRecords] = await Promise.all([
      Account.countDocuments({ tenantId, isDeleted: false }),
      Vehicle.countDocuments({ tenantId, isDeleted: false }),
      mongoose.model("ServiceRecord").countDocuments({
        tenantId,
        isDeleted: false,
      }),
    ]);

    tenant.stats = {
      totalUsers,
      totalVehicles,
      totalServiceRecords,
      totalRevenue: 0,
    };

    await tenant.save();
    return tenant;
  }
}

export const tenantService = new TenantService();
