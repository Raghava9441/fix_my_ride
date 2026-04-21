// seeds/roles.seed.ts
import { Role } from "../models/Role";
import { Permission } from "../models/Permission";
import mongoose from "mongoose";

/**
 * Seed system roles
 * This is idempotent - safe to run multiple times
 */
export const seedRoles = async (): Promise<void> => {
  try {
    console.log("  🔐 Seeding roles...");
    // Ensure permissions exist first
    const permCount = await Permission.countDocuments();
    if (permCount === 0) {
      console.log("    ⚠️  No permissions found, seeding permissions first...");
      await Permission.seedDefaults();
    }

    await Role.seedSystemRoles();
    const count = await Role.countDocuments({ type: "system" });
    console.log(`  ✅ Roles seeded (${count} system roles)`);
  } catch (error) {
    console.error("  ❌ Error seeding roles:", error);
    throw error;
  }
};
