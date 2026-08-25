import { SubscriptionPlan } from "../models/SubscriptionPlan";
import { getRazorpayClient } from "../config/razorpay";
import { logger } from "../config/logger";

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
  /**
   * Razorpay plans are immutable once created (the SDK has no edit/delete
   * for plans.create) — so "updating" a plan's price/interval/name means
   * registering a brand-new Razorpay plan and swapping providerPriceId,
   * not editing the old one in place. The old Razorpay plan is simply left
   * unused; Razorpay doesn't require cleanup of plans with no subscriptions.
   * Returns undefined (skips registration) when Razorpay isn't configured
   * or the plan is free, so local dev without real keys still works.
   */
  private async registerRazorpayPlan(
    name: string,
    price: number,
    currency: string,
    billingInterval: "month" | "year",
  ): Promise<string | undefined> {
    if (price <= 0) return undefined;

    const client = getRazorpayClient();
    if (!client) {
      logger.warn({
        type: "razorpay_plan_registration_skipped",
        message: "Razorpay not configured — plan created without a providerPriceId",
        name,
      });
      return undefined;
    }

    const result = await client.plans.create({
      period: billingInterval === "year" ? "yearly" : "monthly",
      interval: 1,
      item: {
        name,
        amount: Math.round(price * 100),
        currency,
      },
    });

    return result.id;
  }

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

    const currency = input.currency || "USD";
    const billingInterval = input.billingInterval || "month";
    const providerPriceId =
      input.providerPriceId ??
      (await this.registerRazorpayPlan(input.name, input.price, currency, billingInterval));

    const plan = await SubscriptionPlan.create({
      name: input.name,
      slug: input.slug,
      description: input.description,
      type: input.type,
      price: input.price,
      currency,
      billingInterval,
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
      providerPriceId,
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
    const existing = await SubscriptionPlan.findOne({ _id: id, isDeleted: false });
    if (!existing) return null;

    const patch: UpdateSubscriptionPlanInput & { providerPriceId?: string } = { ...updates };

    const priceChanged = updates.price !== undefined && updates.price !== existing.price;
    const intervalChanged =
      updates.billingInterval !== undefined && updates.billingInterval !== existing.billingInterval;
    const nameChanged = updates.name !== undefined && updates.name !== existing.name;

    if (priceChanged || intervalChanged || nameChanged) {
      patch.providerPriceId = await this.registerRazorpayPlan(
        updates.name ?? existing.name,
        updates.price ?? existing.price,
        existing.currency,
        updates.billingInterval ?? existing.billingInterval,
      );
    }

    const plan = await SubscriptionPlan.findByIdAndUpdate(id, patch, {
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
