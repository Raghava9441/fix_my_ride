// seeds/subscription.seed.ts
import { subscriptionPlanService, CreateSubscriptionPlanInput } from "../services/subscriptionPlan.service";
import { SubscriptionPlan } from "../models/SubscriptionPlan";

// Canonical plan definitions for a fresh dev/staging environment. Routed
// through subscriptionPlanService.create()/update() (not the model's
// SubscriptionPlan.seedDefaults() static) so seeded plans also get
// registered with Razorpay when RAZORPAY_KEY_ID/SECRET are configured —
// the whole point of going through the service instead of writing directly.
const DEFAULT_PLANS: CreateSubscriptionPlanInput[] = [
  {
    name: "Free",
    slug: "free",
    type: "free",
    price: 0,
    limits: {
      maxVehicles: 3,
      maxStaff: 1,
      maxServiceCenters: 1,
      maxStorageGB: 0.5,
      maxApiCallsPerMonth: 100,
      includedRemindersPerMonth: 10,
      customFeatures: [],
    },
    features: [
      { name: "Basic vehicle tracking", included: true },
      { name: "Service history", included: true },
      { name: "Email reminders", included: true },
      { name: "Mobile app access", included: false },
      { name: "Multiple service centers", included: false },
      { name: "Staff management", included: false },
      { name: "Advanced reports", included: false },
      { name: "API access", included: false },
    ],
  },
  {
    name: "Basic",
    slug: "basic",
    type: "basic",
    price: 29,
    trialDays: 14,
    limits: {
      maxVehicles: 10,
      maxStaff: 3,
      maxServiceCenters: 1,
      maxStorageGB: 5,
      maxApiCallsPerMonth: 1000,
      includedRemindersPerMonth: 100,
      customFeatures: [],
    },
    features: [
      { name: "Unlimited vehicle tracking", included: true },
      { name: "Service history", included: true },
      { name: "Email & SMS reminders", included: true },
      { name: "Mobile app access", included: true },
      { name: "Basic reports", included: true },
      { name: "Multiple service centers", included: false },
      { name: "Staff management", included: true },
      { name: "API access", included: false },
    ],
  },
  {
    name: "Professional",
    slug: "professional",
    type: "professional",
    price: 99,
    billingInterval: "month",
    trialDays: 14,
    limits: {
      maxVehicles: 50,
      maxStaff: 10,
      maxServiceCenters: 3,
      maxStorageGB: 25,
      maxApiCallsPerMonth: 10000,
      includedRemindersPerMonth: 1000,
      customFeatures: ["priority_support", "custom_branding"],
    },
    features: [
      { name: "Unlimited vehicle tracking", included: true },
      { name: "Advanced service history", included: true },
      { name: "All reminder channels", included: true },
      { name: "Mobile app access", included: true },
      { name: "Advanced reports & analytics", included: true },
      { name: "Multiple service centers", included: true },
      { name: "Staff management", included: true },
      { name: "API access", included: true, limit: 10000 },
    ],
  },
  {
    name: "Enterprise",
    slug: "enterprise",
    type: "enterprise",
    price: 299,
    billingInterval: "month",
    trialDays: 30,
    limits: {
      maxVehicles: 999999,
      maxStaff: 999999,
      maxServiceCenters: 999999,
      maxStorageGB: 100,
      maxApiCallsPerMonth: 100000,
      includedRemindersPerMonth: 10000,
      customFeatures: ["dedicated_support", "sla", "custom_integration", "white_label"],
    },
    features: [
      { name: "Unlimited everything", included: true },
      { name: "Custom integrations", included: true },
      { name: "Dedicated account manager", included: true },
      { name: "SLA guarantee", included: true },
      { name: "White-label options", included: true },
      { name: "On-premise deployment", included: true },
    ],
  },
];

/**
 * Seed subscription plans. Idempotent - safe to run multiple times: existing
 * plans (by slug) get updated rather than duplicated, and
 * subscriptionPlanService.update() only re-registers with Razorpay when
 * price/interval/name actually changed.
 */
export const seedSubscriptionPlans = async (): Promise<void> => {
  try {
    console.log("  💳 Seeding subscription plans...");

    for (const planDef of DEFAULT_PLANS) {
      const existing = await subscriptionPlanService.findBySlug(planDef.slug);
      if (existing) {
        await subscriptionPlanService.update(existing._id.toString(), planDef);
      } else {
        await subscriptionPlanService.create(planDef);
      }
    }

    const count = await SubscriptionPlan.countDocuments({ isDeleted: false });
    console.log(`  ✅ Subscription plans seeded (${count} active plans)`);
  } catch (error) {
    console.error("  ❌ Error seeding subscription plans:", error);
    throw error;
  }
};
