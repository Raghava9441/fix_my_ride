import { SubscriptionPlan } from "../models/SubscriptionPlan";
import { Permission } from "../models/Permission";
import mongoose from "mongoose";

export interface CreateSubscriptionPlanInput {
  name: string;
  slug: string;
  description?: string;
  type: "free" | "basic" | "professional" | "enterprise" | "custom";
  price: number;
  currency?: string;
  billingInterval?: "month" | "year";
  trialDays?: number;
  limits?: {
    maxVehicles?: number;
    maxStaff?: number;
    maxServiceCenters?: number;
    maxStorageGB?: number;
    maxApiCallsPerMonth?: number;
    includedRemindersPerMonth?: number;
    customFeatures?: string[];
  };
  features?: Array<{
    name: string;
    description?: string;
    included: boolean;
    limit?: number;
  }>;
  providerPriceId?: string;
  providerProductId?: string;
  metadata?: Record<string, any>;
}

export interface UpdateSubscriptionPlanInput {
  name?: string;
  description?: string;
  price?: number;
  billingInterval?: "month" | "year";
  trialDays?: number;
  limits?: {
    maxVehicles?: number;
    maxStaff?: number;
    maxServiceCenters?: number;
    maxStorageGB?: number;
    maxApiCallsPerMonth?: number;
    includedRemindersPerMonth?: number;
    customFeatures?: string[];
  };
  features?: Array<{
    name: string;
    description?: string;
    included: boolean;
    limit?: number;
  }>;
  isActive?: boolean;
  displayOrder?: number;
  metadata?: Record<string, any>;
}

export interface SubscriptionPlanFilters {
  page?: number;
  limit?: number;
  type?: string;
  isActive?: boolean;
  isPublic?: boolean;
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

export class SubscriptionPlanService {
  async findAll(
    filters?: SubscriptionPlanFilters,
  ): Promise<PaginatedResult<any>> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const query: any = { isDeleted: false };
    if (filters?.type) query.type = filters.type;
    if (filters?.isActive !== undefined) query.isActive = filters.isActive;
    if (filters?.isPublic !== undefined) query.isPublic = filters.isPublic;

    const [plans, total] = await Promise.all([
      SubscriptionPlan.find(query)
        .populate("includedPermissions", "key name")
        .skip(skip)
        .limit(limit)
        .sort({ displayOrder: 1, price: 1 }),
      SubscriptionPlan.countDocuments(query),
    ]);

    return {
      data: plans,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string): Promise<any | null> {
    return SubscriptionPlan.findById(id).populate(
      "includedPermissions",
      "key name description",
    );
  }

  async findBySlug(slug: string): Promise<any | null> {
    return SubscriptionPlan.findOne({ slug, isDeleted: false });
  }

  async findPublic(): Promise<any[]> {
    return SubscriptionPlan.find({
      isDeleted: false,
      isPublic: true,
      isActive: true,
    })
      .select("name slug description price currency billingInterval features")
      .sort({ displayOrder: 1, price: 1 });
  }

  async create(input: CreateSubscriptionPlanInput): Promise<any> {
    const existing = await SubscriptionPlan.findOne({
      slug: input.slug,
      isDeleted: false,
    });

    if (existing) {
      throw new Error("Plan with this slug already exists");
    }

    const plan = await SubscriptionPlan.create({
      name: input.name,
      slug: input.slug,
      description: input.description,
      type: input.type,
      price: input.price,
      currency: input.currency || "USD",
      billingInterval: input.billingInterval || "month",
      trialDays: input.trialDays || 14,
      limits: input.limits || {
        maxVehicles: 3,
        maxStaff: 1,
        maxServiceCenters: 1,
        maxStorageGB: 1,
        maxApiCallsPerMonth: 1000,
        includedRemindersPerMonth: 100,
        customFeatures: [],
      },
      features: input.features || [],
      includedPermissions: [],
      providerPriceId: input.providerPriceId,
      providerProductId: input.providerProductId,
      isActive: true,
      isPublic: true,
      displayOrder: 0,
      metadata: input.metadata || {},
      isDeleted: false,
    });

    return plan;
  }

  async update(
    id: string,
    updates: UpdateSubscriptionPlanInput,
  ): Promise<any | null> {
    const plan = await SubscriptionPlan.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    return plan;
  }

  async delete(id: string): Promise<any | null> {
    const plan = await SubscriptionPlan.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true },
    );

    return plan;
  }

  async seedDefaults(): Promise<void> {
    await SubscriptionPlan.seedDefaults();
  }

  async comparePlans(planIds: string[]): Promise<any[]> {
    const plans = await SubscriptionPlan.find({
      _id: { $in: planIds },
      isDeleted: false,
    }).sort({ price: 1 });

    return plans.map((plan) => ({
      name: plan.name,
      slug: plan.slug,
      price: plan.price,
      currency: plan.currency,
      billingInterval: plan.billingInterval,
      limits: plan.limits,
      features: plan.features,
    }));
  }

  async checkLimit(
    planId: string,
    resourceType: string,
    currentCount: number,
  ): Promise<{ allowed: boolean; remaining?: number }> {
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      return { allowed: false };
    }

    let limit = 0;
    switch (resourceType) {
      case "vehicles":
        limit = plan.limits.maxVehicles;
        break;
      case "staff":
        limit = plan.limits.maxStaff;
        break;
      case "serviceCenters":
        limit = plan.limits.maxServiceCenters;
        break;
      case "storage":
        limit = plan.limits.maxStorageGB;
        break;
      case "apiCalls":
        limit = plan.limits.maxApiCallsPerMonth;
        break;
    }

    if (limit === 0) {
      return { allowed: true, remaining: Infinity };
    }

    const remaining = limit - currentCount;
    return {
      allowed: remaining > 0,
      remaining,
    };
  }
}

export const subscriptionPlanService = new SubscriptionPlanService();
