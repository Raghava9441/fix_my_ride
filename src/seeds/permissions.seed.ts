// seeds/permissions.seed.ts
import { Permission } from "../models/Permission";
import mongoose from "mongoose";

/**
 * Seed default permissions
 * This is idempotent - safe to run multiple times
 */
export const seedPermissions = async (): Promise<void> => {
  try {
    console.log("  📋 Seeding permissions...");
    await Permission.seedDefaults();
    const count = await Permission.countDocuments();
    console.log(`  ✅ Permissions seeded (${count} total)`);
  } catch (error) {
    console.error("  ❌ Error seeding permissions:", error);
    throw error;
  }
};
