// seeds/sample-data.seed.ts
import { OwnerProfile } from "../models/OwnerProfile";
import { Vehicle } from "../models/Vehicle";
import { ServiceRecord } from "../models/ServiceRecord";
import { OdometerReading } from "../models/OdometerReading";
import { Account } from "../models/Account";
import { StaffProfile } from "../models/StaffProfile";
import { ServiceCenter } from "../models/ServiceCenter";
import { Role } from "../models/Role";
import mongoose from "mongoose";

/**
 * Seed sample data for development/demo
 * Only runs if SEED_SAMPLE_DATA=true
 */
export const seedSampleData = async (
  tenantId: mongoose.Types.ObjectId,
): Promise<void> => {
  const shouldSeed = process.env.SEED_SAMPLE_DATA === "true";
  if (!shouldSeed) {
    console.log("  ℹ️  SEED_SAMPLE_DATA not enabled, skipping sample data");
    return;
  }

  try {
    console.log("  🚗 Seeding sample data...");

    // Check if sample data already exists (more than 5 vehicles)
    const existingVehicles = await Vehicle.countDocuments({
      tenantId,
      isDeleted: false,
    });
    if (existingVehicles > 5) {
      console.log(
        `  ℹ️  ${existingVehicles} vehicles already exist, skipping sample data`,
      );
      return;
    }

    // Get required references
    const serviceCenter = await ServiceCenter.findOne({
      tenantId,
      isDeleted: false,
    });
    if (!serviceCenter) {
      console.log("  ⚠️  No service center found, skipping sample data");
      return;
    }

    // Find or create a sample owner account
    let ownerAccount = await Account.findOne({
      email: "owner@example.com",
      tenantId,
      isDeleted: false,
    });

    if (!ownerAccount) {
      const bcrypt = await import("bcryptjs");
      const hashedPassword = await bcrypt.hash("Owner123!", 12);
      ownerAccount = new Account({
        email: "owner@example.com",
        passwordHash: hashedPassword,
        primaryRole: "owner",
        roles: ["owner"],
        tenantId,
        authProvider: "email",
        emailVerified: true,
        status: "active",
        mfaEnabled: false,
      });
      await ownerAccount.save();
      console.log("    Created sample owner account");
    }

    // Create owner profile if not exists
    let ownerProfile = await OwnerProfile.findOne({
      accountId: ownerAccount._id,
    });
    if (!ownerProfile) {
      ownerProfile = new OwnerProfile({
        accountId: ownerAccount._id,
        firstName: "John",
        lastName: "Doe",
        alternateEmail: "owner@example.com",
        alternatePhone: "+1-555-0101",
        address: {
          street: "456 Owner Ave",
          city: "San Francisco",
          state: "CA",
          country: "US",
          postalCode: "94103",
        },
        stats: {
          totalVehicles: 0,
          totalServices: 0,
          totalSpent: 0,
          memberSince: new Date(),
        },
      });
      await ownerProfile.save();
      ownerAccount.ownerProfileId = ownerProfile._id;
      await ownerAccount.save();
      console.log("    Created sample owner profile");
    }

    // Sample vehicles
    const sampleVehicles = [
      {
        registrationNumber: "ABC1234",
        make: "Toyota",
        model: "Camry",
        year: 2020,
        fuelType: "petrol",
        transmission: "automatic",
        color: "Silver",
        currentOdometer: {
          value: 45000,
          unit: "km",
          recordedAt: new Date(),
          recordedBy: ownerAccount._id,
        },
        serviceSchedule: {
          lastServiceDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          lastServiceOdometer: 42000,
          nextServiceDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          nextServiceDueOdometer: 50000,
        },
      },
      {
        registrationNumber: "XYZ5678",
        make: "Honda",
        model: "Civic",
        year: 2019,
        fuelType: "petrol",
        transmission: "manual",
        color: "Blue",
        currentOdometer: {
          value: 62000,
          unit: "km",
          recordedAt: new Date(),
          recordedBy: ownerAccount._id,
        },
        serviceSchedule: {
          lastServiceDate: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
          lastServiceOdometer: 58000,
          nextServiceDueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          nextServiceDueOdometer: 70000,
        },
      },
      {
        registrationNumber: "DEF9012",
        make: "Tesla",
        model: "Model 3",
        year: 2022,
        fuelType: "electric",
        transmission: "automatic",
        color: "White",
        currentOdometer: {
          value: 15000,
          unit: "km",
          recordedAt: new Date(),
          recordedBy: ownerAccount._id,
        },
        serviceSchedule: {
          lastServiceDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
          lastServiceOdometer: 10000,
          nextServiceDueDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
          nextServiceDueOdometer: 30000,
        },
      },
    ];

    const createdVehicles: mongoose.Types.ObjectId[] = [];

    for (const vehicleData of sampleVehicles) {
      const existing = await Vehicle.findOne({
        registrationNumber: vehicleData.registrationNumber,
        tenantId,
      });

      if (!existing) {
        const vehicle = new Vehicle({
          ...vehicleData,
          tenantId,
          currentOwnerId: ownerProfile._id,
          authorizedServiceCenters: [
            {
              serviceCenterId: serviceCenter._id,
              authorizedBy: ownerProfile._id,
              accessLevel: "full",
              status: "active",
              isPrimary: true,
              authorizedAt: new Date(),
            },
          ],
          ownershipHistory: [
            {
              ownerId: ownerProfile._id,
              fromDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
            },
          ],
        });
        await vehicle.save();
        createdVehicles.push(vehicle._id);
        console.log(
          `    Created vehicle: ${vehicleData.registrationNumber} (${vehicleData.make} ${vehicleData.model})`,
        );

        // Create initial odometer reading
        const odometer = new OdometerReading({
          vehicleId: vehicle._id,
          value: vehicleData.currentOdometer.value,
          unit: vehicleData.currentOdometer.unit,
          recordedAt: vehicleData.currentOdometer.recordedAt,
          recordedBy: ownerAccount._id,
          recordedByModel: "Account",
          source: "manual_entry",
          isVerified: true,
          verifiedBy: ownerAccount._id,
          verifiedAt: new Date(),
        });
        await odometer.save();
      }
    }

    // Get a staff member for technician
    const staffAccount = await Account.findOne({
      tenantId,
      primaryRole: "staff",
      isDeleted: false,
    });

    if (!staffAccount) {
      // Create a sample technician account
      const bcrypt = await import("bcryptjs");
      const techPassword = await bcrypt.hash("Technician123!", 12);
      staffAccount = new Account({
        email: "technician@example.com",
        passwordHash: techPassword,
        primaryRole: "staff",
        roles: ["staff"],
        tenantId,
        authProvider: "email",
        emailVerified: true,
        status: "active",
        mfaEnabled: false,
      });
      await staffAccount.save();

      // Find technician role
      const technicianRole = await Role.findOne({
        slug: "technician",
        type: "system",
      });
      if (technicianRole) {
        const techProfile = new StaffProfile({
          accountId: staffAccount._id,
          serviceCenterId: serviceCenter._id,
          roleId: technicianRole._id,
          employmentStatus: "active",
          employmentType: "full_time",
          joinedAt: new Date(),
          specializations: ["General Mechanics", "Electrical"],
          averageRating: 4.5,
          totalReviews: 12,
          skills: [
            {
              name: "Engine Repair",
              level: "expert",
              certified: true,
              yearsOfExperience: 8,
            },
            {
              name: "Brake Systems",
              level: "expert",
              certified: true,
              yearsOfExperience: 7,
            },
            {
              name: "Electrical",
              level: "intermediate",
              certified: false,
              yearsOfExperience: 5,
            },
          ],
        });
        await techProfile.save();
        staffAccount.staffProfileId = techProfile._id;
        await staffAccount.save();
        console.log("    Created sample technician account");
      }
    }

    // Create sample service records for each vehicle
    for (const vehicleId of createdVehicles) {
      const vehicle = await Vehicle.findById(vehicleId);
      if (!vehicle) continue;

      // Create a past service record
      const serviceRecord = new ServiceRecord({
        tenantId,
        vehicleId,
        serviceCenterId: serviceCenter._id,
        technicianId: staffAccount?.staffProfileId || undefined,
        ownerId: ownerProfile._id,
        serviceDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        serviceType: "maintenance",
        odometerReading: {
          value: vehicle.currentOdometer.value - 3000,
          unit: vehicle.currentOdometer.unit,
        },
        description:
          "Regular maintenance service - oil change, filter replacement, and general inspection",
        cost: {
          partsTotal: 50,
          laborTotal: 100,
          subtotal: 150,
          tax: 12,
          discount: 0,
          total: 162,
          currency: "USD",
          paymentStatus: "paid",
          invoiceNumber: `INV-${Date.now()}`,
        },
        partsReplaced: [
          {
            partName: "Oil Filter",
            partNumber: "OF-1234",
            quantity: 1,
            unitCost: 15,
            totalCost: 15,
            warrantyMonths: 6,
          },
          {
            partName: "Engine Oil",
            partNumber: "EO-5678",
            quantity: 5,
            unitCost: 7,
            totalCost: 35,
            warrantyMonths: 6,
          },
        ],
        nextService: {
          recommendedDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          recommendedOdometer: vehicle.currentOdometer.value + 5000,
          serviceType: "maintenance",
        },
        status: "completed",
        createdBy: {
          accountId: staffAccount?._id || ownerAccount._id,
          role: staffAccount ? "staff" : "owner",
        },
      });
      await serviceRecord.save();
      console.log(
        `    Created service record for ${vehicle.registrationNumber}`,
      );
    }

    console.log("  ✅ Sample data seeded successfully");
  } catch (error) {
    console.error("  ❌ Error seeding sample data:", error);
    throw error;
  }
};
