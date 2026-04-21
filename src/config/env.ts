import { config } from "dotenv";
import { z } from "zod";
import * as path from "path";

// Load appropriate .env file
const envFile =
  process.env.NODE_ENV === "production"
    ? ".env.production"
    : process.env.NODE_ENV === "test"
      ? ".env.test"
      : ".env.development";

config({ path: path.resolve(process.cwd(), envFile) });

// Validation schema
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  PORT: z.string().default("5000").transform(Number),

  // Database
  MONGODB_URI: z.string(),
  REDIS_URL: z.string(),

  // Security
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  BCRYPT_ROUNDS: z.string().default("12").transform(Number),

  // Optional with defaults
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
  API_RATE_LIMIT_MAX_REQUESTS: z.string().default("100").transform(Number),

  // Feature flags
  ENABLE_SIGNUP: z
    .string()
    .default("true")
    .transform((v) => v === "true"),
  ENABLE_MFA: z
    .string()
    .default("true")
    .transform((v) => v === "true"),

  // Seeding configuration
  SEED_DB: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  SEED_ADMIN_EMAIL: z.string().email().optional().default("admin@example.com"),
  SEED_ADMIN_PASSWORD: z.string().min(8).default("Admin123!"),
  SEED_ADMIN_FIRSTNAME: z.string().default("System"),
  SEED_ADMIN_LASTNAME: z.string().default("Administrator"),
  SEED_ADMIN_PHONE: z.string().optional(),
  SEED_TENANT_NAME: z.string().default("Fix My Ride"),
  SEED_TENANT_SLUG: z.string().default("fix-my-ride"),
  SEED_SAMPLE_DATA: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
});

export const env = envSchema.parse(process.env);
