// models/Tenant.ts
import mongoose, { Schema } from "mongoose";

const tenantSchema = new Schema(
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
  featureName: string,
): boolean {
  if (this.features.includes("all")) return true;
  return this.features.includes(featureName);
};

// Static methods
tenantSchema.statics.findBySlug = function (slug: string) {
  return this.findOne({ slug, isDeleted: false, isActive: true });
};

tenantSchema.statics.findActive = function () {
  return this.find({ isDeleted: false, isActive: true });
};

// Pre-save: Sync limits from subscription plan
tenantSchema.pre("save", async function (next) {
  if (this.subscription?.planId && !this.isDeleted) {
    const SubscriptionPlan = mongoose.model("SubscriptionPlan");
    const plan = await SubscriptionPlan.findById(this.subscription.planId);
    if (plan) {
      this.limits.maxVehicles = plan.limits.maxVehicles ?? 0;
      this.limits.maxStaff = plan.limits.maxStaff ?? 0;
      this.limits.maxServiceCenters = plan.limits.maxServiceCenters ?? 0;
      this.limits.maxStorageGB = plan.limits.maxStorageGB ?? 0;
      this.limits.maxApiCallsPerMonth = plan.limits.maxApiCallsPerMonth ?? 0;
      this.features = (plan.features || [])
        .filter((f) => f.included)
        .map((f) => f.name);
    }
  }
  next();
});

export const Tenant = mongoose.model("Tenant", tenantSchema);
