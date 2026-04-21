// seeds/index.ts
import mongoose from "mongoose";
import { seedPermissions } from "./permissions.seed";
import { seedRoles } from "./roles.seed";
import { seedSubscriptionPlans } from "./subscription.seed";
import { seedAdmin } from "./admin.seed";
import { seedServiceCenter } from "./service-center.seed";
import { seedSampleData } from "./sample-data.seed";

interface SeedContext {
  tenantId?: mongoose.Types.ObjectId;
  adminCreated: boolean;
}

/**
 * Main seed orchestrator
 * Runs all seeds in proper dependency order
 */
export const seedAll = async (): Promise<void> => {
  console.log("\n🌱 Starting database seeding...\n");
  console.log("=".repeat(50));

  const ctx: SeedContext = {
    adminCreated: false,
  };

  const startTime = Date.now();

  try {
    // Step 1: Seed core RBAC (no dependencies)
    await seedPermissions();
    await seedRoles();
    await seedSubscriptionPlans();

    // Step 2: Seed admin/tenant (requires roles and subscription plans)
    await seedAdmin();
    ctx.adminCreated = true;

    // Get tenant ID for subsequent seeds
    let tenantId: mongoose.Types.ObjectId | undefined;
    if (ctx.adminCreated) {
      const Account = mongoose.model("Account");
      const adminAccount = await Account.findOne({
        email: (
          process.env.SEED_ADMIN_EMAIL || "admin@example.com"
        ).toLowerCase(),
        isDeleted: false,
      });
      tenantId = adminAccount?.tenantId;
    }

    if (!tenantId) {
      throw new Error("Failed to get tenant ID. Admin seed may have failed.");
    }

    ctx.tenantId = tenantId;

    // Step 3: Seed service center (requires tenant)
    await seedServiceCenter(tenantId);

    // Step 4: Seed sample data (optional)
    await seedSampleData(tenantId);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log("\n" + "=".repeat(50));
    console.log(`✅ Seeding completed successfully in ${duration}s`);
    console.log("=".repeat(50) + "\n");
  } catch (error) {
    console.error("\n❌ Seeding failed:", error);
    throw error;
  }
};

/**
 * Seed production essentials only
 * Use for production deployments where sample data is unwanted
 */
export const seedProduction = async (): Promise<void> => {
  console.log("\n🌱 Seeding production essentials...\n");

  try {
    // Only seed core data
    await seedPermissions();
    await seedRoles();
    await seedSubscriptionPlans();
    await seedAdmin();

    console.log("\n✅ Production seeding completed\n");
  } catch (error) {
    console.error("\n❌ Production seeding failed:", error);
    throw error;
  }
};

/**
 * Seed development data (includes sample data)
 */
export const seedDevelopment = async (): Promise<void> => {
  console.log("\n🌱 Seeding development environment...\n");

  try {
    await seedPermissions();
    await seedRoles();
    await seedSubscriptionPlans();
    await seedAdmin();

    // Get tenant ID
    const Account = mongoose.model("Account");
    const adminAccount = await Account.findOne({
      email: (
        process.env.SEED_ADMIN_EMAIL || "admin@example.com"
      ).toLowerCase(),
      isDeleted: false,
    });

    if (adminAccount?.tenantId) {
      await seedServiceCenter(adminAccount.tenantId);
      await seedSampleData(adminAccount.tenantId);
    }

    console.log("\n✅ Development seeding completed\n");
  } catch (error) {
    console.error("\n❌ Development seeding failed:", error);
    throw error;
  }
};

/**
 * Seed test data (fast, minimal)
 */
export const seedTest = async (): Promise<void> => {
  console.log("\n🌱 Seeding test environment...\n");

  try {
    await seedPermissions();
    await seedRoles();
    await seedSubscriptionPlans();
    await seedAdmin();

    console.log("\n✅ Test seeding completed\n");
  } catch (error) {
    console.error("\n❌ Test seeding failed:", error);
    throw error;
  }
};
