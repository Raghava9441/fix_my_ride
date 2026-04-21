// models/SubscriptionPlan.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface ISubscriptionPlan extends Document {
  name: string;
  slug: string;
  description?: string;
  type: 'free' | 'basic' | 'professional' | 'enterprise' | 'custom';
  
  // Pricing
  price: number;
  currency: string;
  billingInterval: 'month' | 'year';
  trialDays: number;
  
  // Limits
  limits: {
    maxVehicles: number;
    maxStaff: number;
    maxServiceCenters: number;
    maxStorageGB: number;
    maxApiCallsPerMonth: number;
    includedRemindersPerMonth: number;
    customFeatures: string[];
  };
  
  // Features
  features: {
    name: string;
    description?: string;
    included: boolean;
    limit?: number;
  }[];
  
  // Permissions included
  includedPermissions: mongoose.Types.ObjectId[];
  
  // Stripe/Provider IDs
  providerPriceId?: string;
  providerProductId?: string;
  
  // Status
  isActive: boolean;
  isPublic: boolean;
  displayOrder: number;
  
  // Metadata
  metadata: Record<string, any>;
  
  isDeleted: boolean;
}

const subscriptionPlanSchema = new Schema<ISubscriptionPlan>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  description: String,
  
  type: {
    type: String,
    enum: ['free', 'basic', 'professional', 'enterprise', 'custom'],
    required: true
  },
  
  price: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  billingInterval: {
    type: String,
    enum: ['month', 'year'],
    default: 'month'
  },
  trialDays: {
    type: Number,
    default: 14,
    min: 0
  },
  
  limits: {
    maxVehicles: { type: Number, default: 3 },
    maxStaff: { type: Number, default: 1 },
    maxServiceCenters: { type: Number, default: 1 },
    maxStorageGB: { type: Number, default: 1 },
    maxApiCallsPerMonth: { type: Number, default: 1000 },
    includedRemindersPerMonth: { type: Number, default: 100 },
    customFeatures: [String]
  },
  
  features: [{
    name: { type: String, required: true },
    description: String,
    included: { type: Boolean, default: true },
    limit: Number
  }],
  
  includedPermissions: [{
    type: Schema.Types.ObjectId,
    ref: 'Permission'
  }],
  
  providerPriceId: String,
  providerProductId: String,
  
  isActive: {
    type: Boolean,
    default: true
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  
  metadata: {
    type: Map,
    of: Schema.Types.Mixed
  },
  
  isDeleted: {
    type: Boolean,
    default: false
  }

}, {
  timestamps: true
});

// Indexes
subscriptionPlanSchema.index({ slug: 1 }, { unique: true });
subscriptionPlanSchema.index({ type: 1, isActive: 1 });
subscriptionPlanSchema.index({ isPublic: 1, displayOrder: 1 });

// Static: Seed default plans
subscriptionPlanSchema.statics.seedDefaults = async function() {
  const plans = [
    {
      name: 'Free',
      slug: 'free',
      type: 'free',
      price: 0,
      limits: {
        maxVehicles: 3,
        maxStaff: 1,
        maxServiceCenters: 1,
        maxStorageGB: 0.5,
        maxApiCallsPerMonth: 100,
        includedRemindersPerMonth: 10,
        customFeatures: []
      },
      features: [
        { name: 'Basic vehicle tracking', included: true },
        { name: 'Service history', included: true },
        { name: 'Email reminders', included: true },
        { name: 'Mobile app access', included: false },
        { name: 'Multiple service centers', included: false },
        { name: 'Staff management', included: false },
        { name: 'Advanced reports', included: false },
        { name: 'API access', included: false }
      ]
    },
    {
      name: 'Basic',
      slug: 'basic',
      type: 'basic',
      price: 29,
      trialDays: 14,
      limits: {
        maxVehicles: 10,
        maxStaff: 3,
        maxServiceCenters: 1,
        maxStorageGB: 5,
        maxApiCallsPerMonth: 1000,
        includedRemindersPerMonth: 100,
        customFeatures: []
      },
      features: [
        { name: 'Unlimited vehicle tracking', included: true },
        { name: 'Service history', included: true },
        { name: 'Email & SMS reminders', included: true },
        { name: 'Mobile app access', included: true },
        { name: 'Basic reports', included: true },
        { name: 'Multiple service centers', included: false },
        { name: 'Staff management', included: true },
        { name: 'API access', included: false }
      ]
    },
    {
      name: 'Professional',
      slug: 'professional',
      type: 'professional',
      price: 99,
      billingInterval: 'month',
      trialDays: 14,
      limits: {
        maxVehicles: 50,
        maxStaff: 10,
        maxServiceCenters: 3,
        maxStorageGB: 25,
        maxApiCallsPerMonth: 10000,
        includedRemindersPerMonth: 1000,
        customFeatures: ['priority_support', 'custom_branding']
      },
      features: [
        { name: 'Unlimited vehicle tracking', included: true },
        { name: 'Advanced service history', included: true },
        { name: 'All reminder channels', included: true },
        { name: 'Mobile app access', included: true },
        { name: 'Advanced reports & analytics', included: true },
        { name: 'Multiple service centers', included: true },
        { name: 'Staff management', included: true },
        { name: 'API access', included: true, limit: 10000 }
      ]
    },
    {
      name: 'Enterprise',
      slug: 'enterprise',
      type: 'enterprise',
      price: 299,
      billingInterval: 'month',
      trialDays: 30,
      limits: {
        maxVehicles: 999999,
        maxStaff: 999999,
        maxServiceCenters: 999999,
        maxStorageGB: 100,
        maxApiCallsPerMonth: 100000,
        includedRemindersPerMonth: 10000,
        customFeatures: ['dedicated_support', 'sla', 'custom_integration', 'white_label']
      },
      features: [
        { name: 'Unlimited everything', included: true },
        { name: 'Custom integrations', included: true },
        { name: 'Dedicated account manager', included: true },
        { name: 'SLA guarantee', included: true },
        { name: 'White-label options', included: true },
        { name: 'On-premise deployment', included: true }
      ]
    }
  ];
  
  for (const plan of plans) {
    await this.findOneAndUpdate(
      { slug: plan.slug },
      plan,
      { upsert: true, new: true }
    );
  }
};

export const SubscriptionPlan = mongoose.model<ISubscriptionPlan>('SubscriptionPlan', subscriptionPlanSchema);