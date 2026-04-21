// models/index.ts
import mongoose from "mongoose";

// Import all models
import { Account } from "./Account";
import { OwnerProfile } from "./OwnerProfile";
import { StaffProfile } from "./StaffProfile";
import { ServiceCenter } from "./ServiceCenter";
import { Vehicle } from "./Vehicle";
import { ServiceRecord } from "./ServiceRecord";
import { Invitation } from "./Invitation";
import { AuditLog } from "./AuditLog";
import { Permission } from "./Permission";
import { Role } from "./Role";
import { OdometerReading } from "./OdometerReading";
import { SubscriptionPlan } from "./SubscriptionPlan";
import { Payment } from "./Payment";
import { Document } from "./Document";
import { Tenant } from "./Tenant";
import { Notification } from "./Notification";

// Export all models
export {
  Account,
  OwnerProfile,
  StaffProfile,
  ServiceCenter,
  Vehicle,
  ServiceRecord,
  Invitation,
  AuditLog,
  Permission,
  Role,
  OdometerReading,
  SubscriptionPlan,
  Payment,
  Document,
  Tenant,
  Notification,
};

// Database connection
export const connectDatabase = async (): Promise<void> => {
  const uri =
    process.env.MONGODB_URI || "mongodb://localhost:27017/vehicle_service_saas";

  try {
    await mongoose.connect(uri, {
      maxPoolSize: parseInt(process.env.MONGODB_POOL_SIZE || "10"),
      minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE || "2"),
      maxIdleTimeMS: parseInt(process.env.MONGODB_MAX_IDLE_TIME_MS || "30000"),
      connectTimeoutMS: parseInt(
        process.env.MONGODB_CONNECTION_TIMEOUT_MS || "10000",
      ),
      socketTimeoutMS: parseInt(
        process.env.MONGODB_SOCKET_TIMEOUT_MS || "45000",
      ),
      serverSelectionTimeoutMS: parseInt(
        process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || "30000",
      ),
      heartbeatFrequencyMS: parseInt(
        process.env.MONGODB_HEARTBEAT_FREQUENCY_MS || "10000",
      ),
      w: process.env.MONGODB_WRITE_CONCERN || "majority",
      wtimeoutMS: parseInt(process.env.MONGODB_W_TIMEOUT_MS || "10000"),
      readPreference: process.env.MONGODB_READ_PREFERENCE || "primaryPreferred",
      retryWrites: true,
      retryReads: true,
      compressors: ["zstd", "snappy", "zlib"] as const,
      ...(process.env.NODE_ENV === "production" && {
        ssl: true,
        tls: true,
        tlsAllowInvalidCertificates: false,
        tlsAllowInvalidHostnames: false,
      }),
    });

    console.log(`✅ MongoDB connected: ${mongoose.connection.name}`);

    // Sync indexes in production
    if (process.env.NODE_ENV === "production") {
      await mongoose.syncIndexes({ background: true });
      console.log("✅ Database indexes synced");
    }
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log("👋 Database disconnected");
  }
};

export const checkDatabaseHealth = async (): Promise<{
  status: string;
  message?: string;
  host?: string;
  name?: string;
  poolSize?: number;
}> => {
  if (mongoose.connection.readyState !== 1) {
    return { status: "unhealthy", message: "Database not connected" };
  }

  try {
    const db = mongoose.connection.db;
    if (!db) {
      return { status: "unhealthy", message: "Database not initialized" };
    }

    const ping = await db.admin().ping();
    return {
      status: ping?.ok === 1 ? "healthy" : "unhealthy",
      message: "Connection is healthy",
      host: mongoose.connection.host,
      name: mongoose.connection.name,
      poolSize: parseInt(process.env.MONGODB_POOL_SIZE || "10"),
    };
  } catch (error: any) {
    return { status: "unhealthy", message: error.message };
  }
};
