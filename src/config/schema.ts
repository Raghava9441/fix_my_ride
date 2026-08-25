// src/config/schema.ts
/**
 * Single source of truth for environment-variable shape and validation.
 *
 * Every variable the application reads is declared here with its type,
 * default (when safe), and environment-specific constraints. The schema is
 * parsed once at boot (see ./load.ts); an invalid configuration fails fast
 * with a precise message instead of crashing later at runtime.
 */
import { z } from "zod";

/** Environments this application is deployed across. */
export const NODE_ENV_VALUES = ["development", "test", "staging", "production"] as const;
export type NodeEnv = (typeof NODE_ENV_VALUES)[number];

/** Helper: coerce "true"/"false"/"1"/"0" strings to boolean. */
const boolFromStr = (defaultValue: boolean) =>
  z
    .enum(["true", "false", "1", "0"])
    .default(defaultValue ? "true" : "false")
    .transform((v) => v === "true" || v === "1");

/** Helper: non-empty string that fails clearly when missing. */
const requiredString = (msg: string) => z.string({ required_error: msg }).min(1, msg);

export const envSchema = z
  .object({
    // ─── Runtime / process ───────────────────────────────────────────────
    NODE_ENV: z.enum(NODE_ENV_VALUES).default("development"),
    PORT: z.coerce.number().int().positive().default(5000),
    HOST: z.string().default("0.0.0.0"),
    APP_URL: z.string().url().optional(),

    // ─── Database (MongoDB) ─────────────────────────────────────────────
    MONGODB_URI: requiredString("MONGODB_URI is required"),
    MONGODB_NAME: z.string().default("fix_my_ride"),
    MONGODB_MAX_POOL_SIZE: z.coerce.number().int().positive().default(10),
    MONGODB_MIN_POOL_SIZE: z.coerce.number().int().nonnegative().default(2),
    MONGODB_SOCKET_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
    MONGODB_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
    MONGODB_SSL: boolFromStr(false),

    // ─── Cache / Queue (Redis) ───────────────────────────────────────────
    REDIS_HOST: z.string().default("localhost"),
    REDIS_PORT: z.coerce.number().int().positive().default(6379),
    REDIS_PASSWORD: z.string().optional(),
    REDIS_DB: z.coerce.number().int().nonnegative().default(0),
    REDIS_URL: z.string().url().optional(), // optional full URL override

    // ─── Security / Auth ────────────────────────────────────────────────
    JWT_SECRET: requiredString("JWT_SECRET is required (min 32 chars)").min(32),
    JWT_EXPIRES_IN: z.string().default("15m"),
    JWT_REFRESH_SECRET: requiredString("JWT_REFRESH_SECRET is required (min 32 chars)").min(32),
    JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
    BCRYPT_ROUNDS: z.coerce.number().int().min(8).max(15).default(12),
    SESSION_TIMEOUT_MINUTES: z.coerce.number().int().positive().default(60),
    COOKIE_SECRET: z.string().optional(),

    // ─── CORS ────────────────────────────────────────────────────────────
    CORS_ALLOWED_ORIGINS: z
      .string()
      .default("http://localhost:3000")
      .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean)),

    // ─── Rate limiting ──────────────────────────────────────────────────
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),

    // ─── Logging / Observability ─────────────────────────────────────────
    LOG_LEVEL: z.enum(["error", "warn", "info", "debug", "silent"]).default("info"),
    LOG_PRETTY: boolFromStr(true),
    SENTRY_DSN: z.string().url().optional().or(z.literal("")),
    NEW_RELIC_LICENSE_KEY: z.string().optional(),

    // ─── Email (SMTP) ───────────────────────────────────────────────────
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_SECURE: boolFromStr(false),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    EMAIL_FROM: z.string().default("noreply@fixmyride.app"),

    // ─── SMS (Twilio) ───────────────────────────────────────────────────
    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    TWILIO_PHONE_NUMBER: z.string().optional(),

    // ─── Storage ────────────────────────────────────────────────────────
    STORAGE_PROVIDER: z.enum(["local", "s3", "cloudinary"]).default("local"),
    UPLOAD_DIR: z.string().optional(),
    MAX_FILE_SIZE: z.coerce.number().int().positive().default(10 * 1024 * 1024),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    AWS_S3_BUCKET: z.string().optional(),
    AWS_REGION: z.string().optional(),
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),

    // ─── Payments (Razorpay) ────────────────────────────────────────────
    RAZORPAY_KEY_ID: z.string().optional(),
    RAZORPAY_KEY_SECRET: z.string().optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

    // ─── OAuth providers ────────────────────────────────────────────────
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_CALLBACK_URL: z.string().optional(),
    FACEBOOK_CLIENT_ID: z.string().optional(),
    FACEBOOK_CLIENT_SECRET: z.string().optional(),
    FACEBOOK_CALLBACK_URL: z.string().optional(),

    // ─── Feature flags ──────────────────────────────────────────────────
    ENABLE_SIGNUP: boolFromStr(true),
    ENABLE_MFA: boolFromStr(true),
    MAINTENANCE_MODE: boolFromStr(false),
    MAINTENANCE_MESSAGE: z
      .string()
      .default("System is under maintenance. Please check back later."),

    // ─── Seeding (dev/test convenience) ─────────────────────────────────
    SEED_DB: boolFromStr(false),
    SEED_SAMPLE_DATA: boolFromStr(false),
    SEED_ADMIN_EMAIL: z.string().email().default("admin@example.com"),
    SEED_ADMIN_PASSWORD: z.string().min(8).default("Admin123!"),
    SEED_ADMIN_FIRSTNAME: z.string().default("System"),
    SEED_ADMIN_LASTNAME: z.string().default("Administrator"),
    SEED_ADMIN_PHONE: z.string().optional(),
    SEED_TENANT_NAME: z.string().default("Fix My Ride"),
    SEED_TENANT_SLUG: z.string().default("fix-my-ride"),

    // ─── Trusted proxies (for correct client IP behind LB) ──────────────
    TRUSTED_PROXIES: z
      .string()
      .optional()
      .transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined)),
  })
  .superRefine((data, ctx) => {
    // Production/staging require real secrets & integrations.
    const sensitiveEnv = data.NODE_ENV === "production" || data.NODE_ENV === "staging";

    if (sensitiveEnv) {
      if (!data.REDIS_PASSWORD) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["REDIS_PASSWORD"],
          message: "REDIS_PASSWORD is required in production/staging",
        });
      }
      if (!data.COOKIE_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["COOKIE_SECRET"],
          message: "COOKIE_SECRET is required in production/staging",
        });
      }
      if (!data.SMTP_HOST) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["SMTP_HOST"],
          message: "SMTP_HOST is required in production/staging",
        });
      }
      if (!data.RAZORPAY_KEY_ID || !data.RAZORPAY_KEY_SECRET || !data.RAZORPAY_WEBHOOK_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["RAZORPAY_KEY_ID"],
          message:
            "RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET are all required in production/staging",
        });
      }
      if (data.LOG_PRETTY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["LOG_PRETTY"],
          message: "LOG_PRETTY must be false in production/staging",
        });
      }
    }

    // When S3 is selected, credentials must be present.
    if (data.STORAGE_PROVIDER === "s3" && (!data.AWS_ACCESS_KEY_ID || !data.AWS_S3_BUCKET)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["AWS_S3_BUCKET"],
        message: "AWS_ACCESS_KEY_ID and AWS_S3_BUCKET are required when STORAGE_PROVIDER=s3",
      });
    }

    // When Cloudinary is selected, credentials must be present.
    if (
      data.STORAGE_PROVIDER === "cloudinary" &&
      (!data.CLOUDINARY_CLOUD_NAME || !data.CLOUDINARY_API_SECRET)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["CLOUDINARY_CLOUD_NAME"],
        message: "Cloudinary credentials are required when STORAGE_PROVIDER=cloudinary",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;
