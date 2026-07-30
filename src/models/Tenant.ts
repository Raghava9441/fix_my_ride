// models/Tenant.ts
import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface ITenant extends Document {
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
    country: string;
    postalCode?: string;
    timezone: string;
    currency: "USD" | "EUR" | "GBP" | "INR" | "AED";
  };
  subscription: {
    planId?: Types.ObjectId;
    status: "trial" | "active" | "expired" | "suspended" | "cancelled";
    startedAt: Date;
    expiresAt?: Date;
    trialEndsAt?: Date;
    paymentMethodId?: string;
  };
  limits: {
    maxVehicles: number;
    maxStaff: number;
    maxServiceCenters: number;
    maxStorageGB: number;
    maxApiCallsPerMonth: number;
  };
  features: string[];
  settings: {
    enableMfa: boolean;
    requireEmailVerification: boolean;
    allowSignups: boolean;
    sessionTimeoutMinutes: number;
    passwordPolicy: {
      minLength: number;
      requireUppercase: boolean;
      requireLowercase: boolean;
      requireNumbers: boolean;
      requireSpecialChars: boolean;
    };
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
  stats: {
    totalUsers: number;
    totalVehicles: number;
    totalServiceRecords: number;
    totalRevenue: number;
  };
  ownerId?: Types.ObjectId;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;

  isWithinLimits(resourceType: string, currentCount: number): boolean;
  canAccessFeature(featureName: string): boolean;
}

export interface ITenantModel extends Model<ITenant> {
  findBySlug(slug: string): mongoose.Query<ITenant | null, ITenant>;
  findActive(): mongoose.Query<ITenant[], ITenant>;
}

const tenantSchema = new Schema<ITenant, ITenantModel>(
  {
    // Identity
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: String,
    logoUrl: String,
    website: String,

    // Contact
    contactEmail: { type: String, required: true, lowercase: true },
    contactPhone: String,
    address: {
      street: String,
      city: String,
      state: String,
      country: { type: String, default: "US" },
      postalCode: String,
      timezone: { type: String, default: "UTC" },
      currency: {
        type: String,
        default: "USD",
        enum: ["USD", "EUR", "GBP", "INR", "AED"],
      },
    },

    // Subscription
    subscription: {
      planId: { type: Schema.Types.ObjectId, ref: "SubscriptionPlan" },
      status: {
        type: String,
        enum: ["trial", "active", "expired", "suspended", "cancelled"],
        default: "trial",
      },
      startedAt: { type: Date, default: Date.now },
      expiresAt: Date,
      trialEndsAt: Date,
      paymentMethodId: String,
    },

    // Limits (cached from plan)
    limits: {
      maxVehicles: { type: Number, default: 0 },
      maxStaff: { type: Number, default: 0 },
      maxServiceCenters: { type: Number, default: 0 },
      maxStorageGB: { type: Number, default: 0 },
      maxApiCallsPerMonth: { type: Number, default: 0 },
    },

    // Features
    features: [String],

    // Settings
    settings: {
      enableMfa: { type: Boolean, default: true },
      requireEmailVerification: { type: Boolean, default: true },
      allowSignups: { type: Boolean, default: true },
      sessionTimeoutMinutes: { type: Number, default: 60 },
      passwordPolicy: {
        minLength: { type: Number, default: 8 },
        requireUppercase: { type: Boolean, default: true },
        requireLowercase: { type: Boolean, default: true },
        requireNumbers: { type: Boolean, default: true },
        requireSpecialChars: { type: Boolean, default: false },
      },
    },

    // Billing
    billing: {
      companyName: String,
      taxId: String,
      billingEmail: String,
      billingAddress: {
        street: String,
        city: String,
        state: String,
        country: String,
        postalCode: String,
      },
    },

    // Stats
    stats: {
      totalUsers: { type: Number, default: 0 },
      totalVehicles: { type: Number, default: 0 },
      totalServiceRecords: { type: Number, default: 0 },
      totalRevenue: { type: Number, default: 0 },
    },

    // Ownership
    ownerId: { type: Schema.Types.ObjectId, ref: "Account" },

    // Status
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

// Indexes
tenantSchema.index({ slug: 1 }, { unique: true });
tenantSchema.index({ contactEmail: 1 });
tenantSchema.index({ "subscription.status": 1 });
tenantSchema.index({ isActive: 1, createdAt: -1 });

// Virtuals
tenantSchema.virtual("users", {
  ref: "Account",
  localField: "_id",
  foreignField: "tenantId",
});

tenantSchema.virtual("vehicles", {
  ref: "Vehicle",
  localField: "_id",
  foreignField: "tenantId",
});

// Methods
tenantSchema.methods.isWithinLimits = function (
  this: ITenant,
  resourceType: string,
  currentCount: number,
): boolean {
  const limitsMap: Record<string, number> = {
    vehicles: this.limits.maxVehicles,
    staff: this.limits.maxStaff,
    serviceCenters: this.limits.maxServiceCenters,
  };
  const limit = limitsMap[resourceType];
  if (limit === 0) return true; // unlimited
  return currentCount < limit;
};

tenantSchema.methods.canAccessFeature = function (
  this: ITenant,
  featureName: string,
): boolean {
  if (this.features.includes("all")) return true;
  return this.features.includes(featureName);
};

// Static methods
tenantSchema.statics.findBySlug = function (this: ITenantModel, slug: string) {
  return this.findOne({ slug, isDeleted: false, isActive: true });
};

tenantSchema.statics.findActive = function (this: ITenantModel) {
  return this.find({ isDeleted: false, isActive: true });
};

// Pre-save: Sync limits from subscription plan
tenantSchema.pre("save", async function (this: ITenant, next) {
  if (this.subscription?.planId && !this.isDeleted) {
    const SubscriptionPlan = mongoose.model("SubscriptionPlan");
    const plan: any = await SubscriptionPlan.findById(this.subscription.planId);
    if (plan) {
      this.limits.maxVehicles = plan.limits.maxVehicles ?? 0;
      this.limits.maxStaff = plan.limits.maxStaff ?? 0;
      this.limits.maxServiceCenters = plan.limits.maxServiceCenters ?? 0;
      this.limits.maxStorageGB = plan.limits.maxStorageGB ?? 0;
      this.limits.maxApiCallsPerMonth = plan.limits.maxApiCallsPerMonth ?? 0;
      this.features = (plan.features || [])
        .filter((f: any) => f.included)
        .map((f: any) => f.name);
    }
  }
  next();
});

export const Tenant = mongoose.model<ITenant, ITenantModel>("Tenant", tenantSchema);
