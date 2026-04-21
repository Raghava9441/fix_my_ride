// seeds/admin.seed.ts
import { Account } from "../models/Account";
import { Tenant } from "../models/Tenant";
import { OwnerProfile } from "../models/OwnerProfile";
import { Role } from "../models/Role";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

interface SeedAdminData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

/**
 * Seed admin account with tenant
 * Creates a system admin user and associated tenant
 */
export const seedAdmin = async (): Promise<void> => {
  const env = process.env;
  const email = env.SEED_ADMIN_EMAIL || "admin@example.com";
  const password = env.SEED_ADMIN_PASSWORD || "Admin123!";
  const firstName = env.SEED_ADMIN_FIRSTNAME || "System";
  const lastName = env.SEED_ADMIN_LASTNAME || "Administrator";
  const phone = env.SEED_ADMIN_PHONE || "+1234567890";

  try {
    console.log("  👑 Seeding admin user and tenant...");

    // Check if admin already exists
    const existingAdmin = await Account.findOne({
      email: email.toLowerCase(),
      isDeleted: false,
    });

    if (existingAdmin) {
      console.log(`  ℹ️  Admin user already exists (${email})`);
      return;
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Create Tenant
      const tenant = new Tenant({
        name: env.SEED_TENANT_NAME || "Fix My Ride",
        slug: env.SEED_TENANT_SLUG || "fix-my-ride",
        description: "Default tenant for Fix My Ride SaaS",
        contactEmail: email,
        contactPhone: phone,
        address: {
          city: "San Francisco",
          state: "CA",
          country: "US",
          timezone: "America/Los_Angeles",
          currency: "USD",
        },
        ownerId: new mongoose.Types.ObjectId(), // placeholders, will be updated after profile creation
      });
      await tenant.save({ session });
      console.log(`    Created tenant: ${tenant.name}`);

      // Get system admin role
      const systemAdminRole = await Role.findOne({
        slug: "system_admin",
        type: "system",
      });
      if (!systemAdminRole) {
        throw new Error("System admin role not found. Seed roles first.");
      }

      // Create Admin Account
      const hashedPassword = await bcrypt.hash(
        password,
        parseInt(env.BCRYPT_ROUNDS || "12"),
      );
      const adminAccount = new Account({
        email: email.toLowerCase(),
        passwordHash: hashedPassword,
        primaryRole: "admin",
        roles: ["admin"],
        tenantId: tenant._id,
        authProvider: "email",
        emailVerified: true,
        phoneVerified: true,
        status: "active",
        mfaEnabled: false,
        failedLoginAttempts: 0,
        preferences: {
          language: "en",
          timezone: "UTC",
          currency: "USD",
          notificationPreferences: {
            email: { marketing: true, transactional: true, security: true },
            sms: { enabled: false, marketing: false },
            push: { enabled: false, deviceTokens: [] },
          },
        },
      });
      await adminAccount.save({ session });
      console.log(`    Created admin account: ${email}`);

      // Create Owner Profile for admin (owner of the tenant)
      const ownerProfile = new OwnerProfile({
        accountId: adminAccount._id,
        firstName,
        lastName,
        alternateEmail: email,
        alternatePhone: phone,
        address: {
          street: "123 Main St",
          city: "San Francisco",
          state: "CA",
          country: "US",
          postalCode: "94102",
        },
        stats: {
          totalVehicles: 0,
          totalServices: 0,
          totalSpent: 0,
          memberSince: new Date(),
        },
      });
      await ownerProfile.save({ session });
      console.log(`    Created owner profile: ${firstName} ${lastName}`);

      // Link tenant owner
      tenant.ownerId = ownerProfile._id;
      await tenant.save({ session });

      // Link account to owner profile
      adminAccount.ownerProfileId = ownerProfile._id;
      await adminAccount.save({ session });

      // Update subscription plan reference
      const freePlan = await SubscriptionPlan.findOne({ slug: "free" });
      if (freePlan) {
        tenant.subscription.planId = freePlan._id;
        tenant.subscription.status = "trial";
        tenant.subscription.trialEndsAt = new Date(
          Date.now() + 14 * 24 * 60 * 60 * 1000,
        ); // 14 days
        tenant.subscription.startedAt = new Date();
        await tenant.save({ session });
      }

      await session.commitTransaction();
      session.endSession();

      console.log(`  ✅ Admin seeded successfully`);
      console.log(`     📧 Email: ${email}`);
      console.log(`     🔑 Password: ${password}`);
      console.log(`     🏢 Tenant: ${tenant.name}`);
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    console.error("  ❌ Error seeding admin:", error);
    throw error;
  }
};
