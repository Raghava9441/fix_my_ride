// src/config/environment.ts
/**
 * Structured, typed application configuration.
 *
 * This module is the single, validated source of truth consumed across the
 * app (import `{ config }` here). It is derived from the Zod-validated raw
 * environment (see ./load.ts + ./schema.ts), so every value is guaranteed to
 * exist and be correctly typed by the time the app boots.
 */
import { loadEnv } from "./load";

const env = loadEnv();

/**
 * Structured configuration object.
 * Shape is preserved for backwards compatibility with existing importers.
 */
export const config = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === "production",
  isStaging: env.NODE_ENV === "staging",
  isTest: env.NODE_ENV === "test",
  isDevelopment: env.NODE_ENV === "development",

  // Catalyst AppSail assigns the listen port at runtime via this var, which
  // isn't declared in schema.ts since it's platform-injected, not configured.
  port: process.env.X_ZOHO_CATALYST_LISTEN_PORT
    ? Number(process.env.X_ZOHO_CATALYST_LISTEN_PORT)
    : env.PORT,
  host: env.HOST,
  appUrl: env.APP_URL ?? `http://localhost:${env.PORT}`,

  db: {
    uri: env.MONGODB_URI,
    name: env.MONGODB_NAME,
    maxPoolSize: env.MONGODB_MAX_POOL_SIZE,
    minPoolSize: env.MONGODB_MIN_POOL_SIZE,
    socketTimeoutMS: env.MONGODB_SOCKET_TIMEOUT_MS,
    connectTimeoutMS: env.MONGODB_CONNECT_TIMEOUT_MS,
    ssl: env.MONGODB_SSL,
  },

  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    refreshSecret: env.JWT_REFRESH_SECRET,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },

  redis: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    db: env.REDIS_DB,
    url: env.REDIS_URL,
  },

  email: {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    user: env.SMTP_USER,
    password: env.SMTP_PASSWORD,
    from: env.EMAIL_FROM,
  },

  sms: {
    accountSid: env.TWILIO_ACCOUNT_SID,
    authToken: env.TWILIO_AUTH_TOKEN,
    phoneNumber: env.TWILIO_PHONE_NUMBER,
  },

  storage: {
    provider: env.STORAGE_PROVIDER,
    uploadDir: env.UPLOAD_DIR,
    maxFileSize: env.MAX_FILE_SIZE,
    s3: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      bucket: env.AWS_S3_BUCKET,
      region: env.AWS_REGION,
    },
    cloudinary: {
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      apiKey: env.CLOUDINARY_API_KEY,
      apiSecret: env.CLOUDINARY_API_SECRET,
    },
  },

  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX_REQUESTS,
  },

  cors: {
    allowedOrigins: env.CORS_ALLOWED_ORIGINS,
  },

  logging: {
    level: env.LOG_LEVEL,
    prettyPrint: env.LOG_PRETTY,
  },

  razorpay: {
    keyId: env.RAZORPAY_KEY_ID,
    keySecret: env.RAZORPAY_KEY_SECRET,
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
  },

  google: {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    callbackUrl: env.GOOGLE_CALLBACK_URL,
  },

  facebook: {
    clientId: env.FACEBOOK_CLIENT_ID,
    clientSecret: env.FACEBOOK_CLIENT_SECRET,
    callbackUrl: env.FACEBOOK_CALLBACK_URL,
  },

  maintenance: {
    enabled: env.MAINTENANCE_MODE,
    message: env.MAINTENANCE_MESSAGE,
  },

  monitoring: {
    sentryDsn: env.SENTRY_DSN || undefined,
    newRelicKey: env.NEW_RELIC_LICENSE_KEY,
  },

  security: {
    bcryptRounds: env.BCRYPT_ROUNDS,
    sessionTimeoutMinutes: env.SESSION_TIMEOUT_MINUTES,
    cookieSecret: env.COOKIE_SECRET,
  },

  featureFlags: {
    enableSignup: env.ENABLE_SIGNUP,
    enableMfa: env.ENABLE_MFA,
  },

  seed: {
    db: env.SEED_DB,
    sampleData: env.SEED_SAMPLE_DATA,
    adminEmail: env.SEED_ADMIN_EMAIL,
    adminPassword: env.SEED_ADMIN_PASSWORD,
    adminFirstname: env.SEED_ADMIN_FIRSTNAME,
    adminLastname: env.SEED_ADMIN_LASTNAME,
    adminPhone: env.SEED_ADMIN_PHONE,
    tenantName: env.SEED_TENANT_NAME,
    tenantSlug: env.SEED_TENANT_SLUG,
  },

  trustedProxies: env.TRUSTED_PROXIES,
};

/** Raw validated environment (typed). Use for variables not in `config`. */
export { env };

export default config;
