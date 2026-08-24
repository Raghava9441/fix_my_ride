// models/Subscription.ts
import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { tenantPlugin } from "../middleware/tenant/tenantPlugin";

/**
 * A purchased subscription instance/billing period — distinct from
 * SubscriptionPlan (the catalog of what can be bought). Tenant.subscription
 * and ServiceCenter.subscription cache the *current* state inline for quick
 * reads; this collection is the queryable history/record of each billing
 * period behind that cached state (renewals, provider ids, cancellations).
 */
export interface ISubscription extends Document {
  tenantId?: Types.ObjectId;
  serviceCenterId?: Types.ObjectId;
  planId: Types.ObjectId;

  status: "trialing" | "active" | "past_due" | "paused" | "cancelled" | "expired";
  billingInterval: "month" | "year";

  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEndsAt?: Date;

  cancelAtPeriodEnd: boolean;
  cancelledAt?: Date;
  cancelReason?: string;

  provider: "stripe" | "paypal" | "razorpay" | "manual";
  providerSubscriptionId?: string;
  providerCustomerId?: string;

  quantity: number;
  autoRenew: boolean;
  paymentIds: Types.ObjectId[];

  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;

  isActive(): boolean;
  cancel(reason?: string, immediate?: boolean): Promise<ISubscription>;
  renew(periodEnd: Date): Promise<ISubscription>;
}

export interface ISubscriptionModel extends Model<ISubscription> {
  findActiveForTenant(
    tenantId: string | Types.ObjectId,
  ): mongoose.Query<ISubscription | null, ISubscription>;
  findExpiring(days?: number): mongoose.Query<ISubscription[], ISubscription>;
}

const subscriptionSchema = new Schema<ISubscription, ISubscriptionModel>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", index: true },
    serviceCenterId: { type: Schema.Types.ObjectId, ref: "ServiceCenter", index: true },
    planId: { type: Schema.Types.ObjectId, ref: "SubscriptionPlan", required: true },

    status: {
      type: String,
      enum: ["trialing", "active", "past_due", "paused", "cancelled", "expired"],
      default: "trialing",
      index: true,
    },
    billingInterval: { type: String, enum: ["month", "year"], default: "month" },

    currentPeriodStart: { type: Date, default: Date.now },
    currentPeriodEnd: { type: Date, required: true },
    trialEndsAt: Date,

    cancelAtPeriodEnd: { type: Boolean, default: false },
    cancelledAt: Date,
    cancelReason: String,

    provider: {
      type: String,
      enum: ["stripe", "paypal", "razorpay", "manual"],
      default: "manual",
    },
    providerSubscriptionId: String,
    providerCustomerId: String,

    quantity: { type: Number, default: 1, min: 1 },
    autoRenew: { type: Boolean, default: true },
    paymentIds: [{ type: Schema.Types.ObjectId, ref: "Payment" }],

    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

// Indexes
subscriptionSchema.index({ tenantId: 1, status: 1 });
subscriptionSchema.index({ serviceCenterId: 1, status: 1 });
subscriptionSchema.index({ providerSubscriptionId: 1 }, { sparse: true });
subscriptionSchema.index({ currentPeriodEnd: 1, status: 1 });

// Methods
subscriptionSchema.methods.isActive = function (this: ISubscription): boolean {
  return (
    ["trialing", "active"].includes(this.status) && this.currentPeriodEnd > new Date()
  );
};

subscriptionSchema.methods.cancel = async function (
  this: ISubscription,
  reason?: string,
  immediate = false,
): Promise<ISubscription> {
  this.cancelReason = reason;
  this.cancelledAt = new Date();
  if (immediate) {
    this.status = "cancelled";
  } else {
    this.cancelAtPeriodEnd = true;
  }
  return this.save();
};

subscriptionSchema.methods.renew = async function (
  this: ISubscription,
  periodEnd: Date,
): Promise<ISubscription> {
  this.currentPeriodStart = this.currentPeriodEnd;
  this.currentPeriodEnd = periodEnd;
  this.status = "active";
  return this.save();
};

// Static methods
subscriptionSchema.statics.findActiveForTenant = function (
  this: ISubscriptionModel,
  tenantId: string | Types.ObjectId,
) {
  return this.findOne({
    tenantId,
    status: { $in: ["trialing", "active"] },
    isDeleted: false,
  }).sort({ currentPeriodEnd: -1 });
};

subscriptionSchema.statics.findExpiring = function (
  this: ISubscriptionModel,
  days = 7,
) {
  const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return this.find({
    status: { $in: ["trialing", "active"] },
    currentPeriodEnd: { $gte: new Date(), $lte: cutoff },
    isDeleted: false,
  }).sort({ currentPeriodEnd: 1 });
};

subscriptionSchema.plugin(tenantPlugin);

export const Subscription = mongoose.model<ISubscription, ISubscriptionModel>(
  "Subscription",
  subscriptionSchema,
);
