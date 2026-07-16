// src/config/load.ts
/**
 * Loads and validates environment configuration.
 *
 * Resolution order (last wins):
 *   1. Process environment (already set, e.g. by the platform/container).
 *   2. `.env`                     (always loaded as a local override)
 *   3. `.env.<NODE_ENV>`          (environment-specific file, e.g. .env.production)
 *
 * Real secrets come from the environment or a secret manager in production;
 * the `.env.*` files are only for local development and are git-ignored.
 */
import { config as loadDotenv } from "dotenv";
import { resolve } from "path";
import { envSchema, NODE_ENV_VALUES, type Env, type NodeEnv } from "./schema";

function resolveEnvFileName(nodeEnv: string | undefined): string {
  const env = (nodeEnv ?? "development") as NodeEnv;
  if (!(NODE_ENV_VALUES as readonly string[]).includes(env)) {
    throw new Error(
      `Invalid NODE_ENV "${nodeEnv}". Must be one of: ${NODE_ENV_VALUES.join(", ")}`,
    );
  }
  if (env === "test") return ".env.test";
  if (env === "staging") return ".env.staging";
  if (env === "production") return ".env.production";
  return ".env.development";
}

function loadDotenvFiles(): void {
  const envFile = resolveEnvFileName(process.env.NODE_ENV);

  // Load environment-specific file first, then local overrides.
  loadDotenv({ path: resolve(process.cwd(), envFile) });
  loadDotenv({ path: resolve(process.cwd(), ".env") }); // optional local override
}

let cached: Env | null = null;

/**
 * Parse and validate the environment. Returns a cached, typed config object.
 * Throws a descriptive error on the first validation failure.
 */
export function loadEnv(): Env {
  if (cached) return cached;

  loadDotenvFiles();

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration:\n${issues}\n\n` +
        `Fix the variables above in your .env.${process.env.NODE_ENV ?? "development"} file ` +
        `(see .env.example) or supply them via the environment.`,
    );
  }

  cached = result.data;
  return cached;
}

/** True when running outside tests. */
export function isTest(): boolean {
  return loadEnv().NODE_ENV === "test";
}

/** True when running in production/staging (strict mode). */
export function isProductionLike(): boolean {
  const env = loadEnv().NODE_ENV;
  return env === "production" || env === "staging";
}
