// jest.setup.ts — runs before the test framework loads (jest.config.js's
// setupFiles). Provides the minimum env vars config/schema.ts requires with
// no default (MONGODB_URI, JWT_SECRET, JWT_REFRESH_SECRET), so importing
// anything that transitively pulls in config/environment.ts doesn't throw.
// The actual test database connection is handled separately per test file
// via src/test-utils/db.ts (mongodb-memory-server) — this MONGODB_URI value
// is never actually connected to, it just needs to satisfy schema validation.
process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/fix_my_ride_test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-only-jwt-secret-do-not-use-outside-tests-0000000000";
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "test-only-jwt-refresh-secret-do-not-use-outside-tests-0000";
process.env.RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "test_webhook_secret";
