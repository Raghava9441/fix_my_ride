// seeds/run.ts
/**
 * Database Seeding CLI
 * Usage: npm run seed -- [options]
 * Options:
 *   --env=production  Seed production essentials only
 *   --env=test        Seed test data
 *   --env=development Seed development data (includes sample data)
 *   --force           Force reseed (drops existing data first - DANGEROUS)
 *   --skip-sample     Skip sample data in development
 */

import { seedAll, seedProduction, seedDevelopment, seedTest } from "./index";
import mongoose from "mongoose";

const main = async () => {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const skipSample = args.includes("--skip-sample");

  // Parse --env flag
  const envArg = args.find((arg) => arg.startsWith("--env="));
  const envFromArg = envArg?.split("=")[1] as
    | "development"
    | "production"
    | "test"
    | undefined;

  const env = process.env.NODE_ENV || envFromArg || "development";

  console.log("\n🚀 Fix My Ride - Database Seeding\n");
  console.log(`   Environment: ${env}`);
  console.log(
    `   Force mode: ${force ? "YES (will drop existing data)" : "NO"}`,
  );
  console.log(`   Skip sample: ${skipSample ? "YES" : "NO"}`);
  console.log("");

  // Set environment for seeds
  process.env.SEED_SAMPLE_DATA = skipSample ? "false" : "true";

  try {
    // Connect to database
    const mongoUri =
      process.env.MONGODB_URI ||
      (env === "test"
        ? process.env.TEST_MONGODB_URI ||
          "mongodb://localhost:27017/vehicle_service_saas_test"
        : "mongodb://localhost:27017/vehicle_service_saas");

    console.log(`📡 Connecting to MongoDB...`);
    await mongoose.connect(mongoUri, {
      maxPoolSize: 10,
      minPoolSize: 2,
    });
    console.log(`✅ Connected to ${mongoose.connection.name}\n`);

    if (force) {
      console.log("⚠️  FORCE MODE: Dropping all collections...");
      const collections = await mongoose.connection.db.collections();
      for (const coll of collections) {
        await coll.drop();
        console.log(`   Dropped: ${coll.collectionName}`);
      }
      console.log("");
    }

    // Run appropriate seeder
    switch (env) {
      case "production":
        await seedProduction();
        break;
      case "test":
        await seedTest();
        break;
      case "development":
      default:
        await seedDevelopment();
        break;
    }

    // Close connection
    await mongoose.disconnect();
    console.log("👋 Done.\n");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Seeding failed:", error);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
};

main();
