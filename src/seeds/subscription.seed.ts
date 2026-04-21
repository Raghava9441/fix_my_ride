// seeds/subscription.seed.ts
import { SubscriptionPlan } from "../models/SubscriptionPlan";
import mongoose from "mongoose";

/**
 * Seed subscription plans
 * This is idempotent - safe to run multiple times
 */
export const seedSubscriptionPlans = async (): Promise<void> => {
  try {
    console.log("  💳 Seeding subscription plans...");
    await SubscriptionPlan.seedDefaults();
    const count = await SubscriptionPlan.countDocuments({ isDeleted: false });
    console.log(`  ✅ Subscription plans seeded (${count} active plans)`);
  } catch (error) {
    console.error("  ❌ Error seeding subscription plans:", error);
    throw error;
  }
};
