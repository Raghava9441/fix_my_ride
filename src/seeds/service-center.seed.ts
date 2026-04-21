// seeds/service-center.seed.ts
import { ServiceCenter } from "../models/ServiceCenter";
import { Account } from "../models/Account";
import { Tenant } from "../models/Tenant";
import { SubscriptionPlan } from "../models/SubscriptionPlan";
import mongoose from "mongoose";

/**
 * Seed default service center
 * Creates a primary service center for the tenant
 */
export const seedServiceCenter = async (
  tenantId: mongoose.Types.ObjectId,
): Promise<void> => {
  try {
    console.log("  🏢 Seeding service center...");

    const existingCenter = await ServiceCenter.findOne({
      tenantId,
      isDeleted: false,
    });

    if (existingCenter) {
      console.log("  ℹ️  Service center already exists");
      return;
    }

    // Get admin account to mark as creator
    const adminAccount = await Account.findOne({
      tenantId,
      primaryRole: "admin",
      isDeleted: false,
    });

    if (!adminAccount) {
      console.log(
        "  ⚠️  No admin account found, skipping service center creation",
      );
      return;
    }

    const serviceCenter = new ServiceCenter({
      tenantId,
      name: "Main Service Center",
      slug: "main-center",
      businessRegistrationNumber: "REG-" + Date.now(),
      email: `service@${tenantId}.local`,
      phone: "+1-555-0100",
      address: {
        street: "123 Auto Lane",
        city: "San Francisco",
        state: "CA",
        country: "US",
        postalCode: "94102",
        coordinates: [-122.4194, 37.7749],
      },
      subscription: {
        planId: undefined, // Will be set from tenant
        status: "active",
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      },
      settings: {
        currency: "USD",
        timezone: "America/Los_Angeles",
        businessHours: {
          monday: { start: "08:00", end: "17:00", closed: false },
          tuesday: { start: "08:00", end: "17:00", closed: false },
          wednesday: { start: "08:00", end: "17:00", closed: false },
          thursday: { start: "08:00", end: "17:00", closed: false },
          friday: { start: "08:00", end: "17:00", closed: false },
          saturday: { start: "09:00", end: "14:00", closed: false },
          sunday: { start: "00:00", end: "00:00", closed: true },
        },
      },
      servicesOffered: [
        {
          name: "Oil Change",
          category: "maintenance",
          duration: 60,
          basePrice: 49.99,
          isActive: true,
        },
        {
          name: "Brake Service",
          category: "repair",
          duration: 120,
          basePrice: 199.99,
          isActive: true,
        },
        {
          name: "Tire Rotation",
          category: "maintenance",
          duration: 60,
          basePrice: 29.99,
          isActive: true,
        },
        {
          name: "General Inspection",
          category: "diagnostic",
          duration: 90,
          basePrice: 89.99,
          isActive: true,
        },
      ],
      stats: {
        totalVehiclesServed: 0,
        activeVehicles: 0,
        totalServiceRecords: 0,
        averageRating: 0,
        totalRevenue: 0,
      },
      createdBy: adminAccount._id,
    });

    await serviceCenter.save();
    console.log(`  ✅ Service center seeded: ${serviceCenter.name}`);

    // Update tenant subscription with service center reference
    const tenant = await Tenant.findById(tenantId);
    if (tenant && !tenant.subscription.planId) {
      const freePlan = await SubscriptionPlan.findOne({ slug: "free" });
      if (freePlan) {
        tenant.subscription.planId = freePlan._id;
        tenant.subscription.status = "trial";
        tenant.subscription.trialEndsAt = new Date(
          Date.now() + 14 * 24 * 60 * 60 * 1000,
        );
        await tenant.save();
      }
    }
  } catch (error) {
    console.error("  ❌ Error seeding service center:", error);
    throw error;
  }
};
