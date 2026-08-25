// src/services/auth.service.ts
import mongoose from "mongoose";
import crypto from "crypto";
import { Account } from "../models/Account";
import { OwnerProfile } from "../models/OwnerProfile";
import { Tenant } from "../models/Tenant";
import { config } from "../config/environment";
import { getRedisClient } from "../config/redis";
import { AppError } from "../utils/appError";
import { ERROR_CODES } from "../constants/errors";
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
} from "../utils/password";
import {
  generateToken,
  generateRefreshToken,
  invalidateToken,
} from "../utils/token";
import { logger } from "../config/logger";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface NotifyFn {
  (type: string, payload: Record<string, any>): void | Promise<void>;
}

const ACCESS_TOKEN_TTL = config.jwt.expiresIn || "15m";
const REFRESH_TOKEN_TTL = config.jwt.refreshExpiresIn || "7d";
const REVOKED_PREFIX = "auth:revoked:";

/**
 * Generate a short-lived access token + long-lived refresh token.
 * Both carry a `jti` so they can be individually revoked.
 */
export function issueTokens(account: any): TokenPair {
  const jtiAccess = crypto.randomBytes(16).toString("hex");
  const jtiRefresh = crypto.randomBytes(16).toString("hex");

  const base = {
    userId: account._id.toString(),
    email: account.email,
    role: account.primaryRole,
    roles: account.roles,
    tenantId: account.tenantId?.toString(),
    sessionVersion: (account as any).sessionVersion ?? 0,
    mfaVerified: account.mfaEnabled ? true : false,
  };

  const accessToken = generateToken(
    { ...base, jti: jtiAccess },
    config.jwt.secret,
    { expiresIn: ACCESS_TOKEN_TTL, issuer: "fix-my-ride", audience: "fix-my-ride-clients" },
  );

  const refreshToken = generateToken(
    { ...base, jti: jtiRefresh },
    config.jwt.refreshSecret,
    { expiresIn: REFRESH_TOKEN_TTL, issuer: "fix-my-ride", audience: "fix-my-ride-clients" },
  );

  return { accessToken, refreshToken, expiresIn: 15 * 60 };
}

export const authService = {
  /**
   * Register a new owner account (optionally within a tenant).
   */
  async register(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    tenantId?: string;
    tenantSlug?: string;
    ip?: string;
    userAgent?: string;
    notify?: NotifyFn;
  }): Promise<{ account: any; tokens: TokenPair }> {
    const { email, password, firstName, lastName, tenantId, tenantSlug, ip, userAgent, notify } = input;

    const strength = validatePasswordStrength(password, {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
    });
    if (!strength.isValid) {
      throw AppError.fromCode("INVALID_INPUT_FORMAT", {
        message: strength.errors.join(" "),
        details: { field: "password" },
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existing = await Account.findOne({ email: normalizedEmail, isDeleted: false });
    if (existing) {
      throw AppError.fromCode("ALREADY_EXISTS", {
        message: "An account with this email already exists",
        details: { field: "email" },
      });
    }

    // Resolve tenant if provided
    let resolvedTenantId: mongoose.Types.ObjectId | undefined;
    if (tenantId) {
      resolvedTenantId = new mongoose.Types.ObjectId(tenantId);
    } else if (tenantSlug) {
      const tenant = await Tenant.findOne({ slug: tenantSlug, isDeleted: false, isActive: true });
      if (tenant) resolvedTenantId = tenant._id;
    }

    const passwordHash = await hashPassword(password);
    const verificationToken = crypto.randomBytes(32).toString("hex");

    const account = await Account.create({
      email: normalizedEmail,
      passwordHash,
      primaryRole: "owner",
      roles: ["owner"],
      tenantId: resolvedTenantId,
      status: "pending_verification",
      emailVerificationToken: crypto.createHash("sha256").update(verificationToken).digest("hex"),
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    // Create owner profile
    await OwnerProfile.create({
      accountId: account._id,
      firstName,
      lastName,
    });

    await account.recordLogin(ip ?? "unknown", userAgent ?? "unknown", "signup", true);

    const tokens = issueTokens(account);

    if (notify) {
      await notify("email_verification", {
        email: account.email,
        token: verificationToken,
      });
    }

    return { account, tokens };
  },

  /**
   * Authenticate with email + password.
   */
  async login(input: {
    email: string;
    password: string;
    ip?: string;
    userAgent?: string;
    notify?: NotifyFn;
  }): Promise<{ account: any; tokens: TokenPair }> {
    const { email, password, ip, userAgent, notify } = input;
    const normalizedEmail = email.toLowerCase().trim();

    const account = await Account.findOne({ email: normalizedEmail, isDeleted: false }).select(
      "+passwordHash +failedLoginAttempts +lockedUntil +status",
    );

    // Generic error to avoid user enumeration
    const fail = () =>
      AppError.fromCode("INVALID_CREDENTIALS", { message: "Invalid email or password" });

    if (!account) {
      throw fail();
    }

    if (account.lockedUntil && account.lockedUntil > new Date()) {
      throw AppError.fromCode("ACCOUNT_LOCKED", {
        message: "Account is temporarily locked due to too many failed attempts",
        details: { lockedUntil: account.lockedUntil },
      });
    }

    if (account.status === "suspended") {
      throw AppError.fromCode("ACCOUNT_SUSPENDED", { message: "Account is suspended" });
    }

    const valid = await verifyPassword(password, account.passwordHash ?? "");
    if (!valid) {
      await account.recordLogin(ip ?? "unknown", userAgent ?? "unknown", "login", false);
      throw fail();
    }

    if (account.status === "pending_verification") {
      throw AppError.fromCode("EMAIL_NOT_VERIFIED", {
        message: "Please verify your email before logging in",
      });
    }

    if (account.tenantId) {
      const tenant = await Tenant.findById(account.tenantId).select("onboarding");
      if (tenant?.onboarding?.status === "pending_review") {
        throw AppError.fromCode("ORG_PENDING_APPROVAL");
      }
      if (tenant?.onboarding?.status === "rejected") {
        throw AppError.fromCode("ORG_REJECTED", {
          message: tenant.onboarding.rejectionReason
            ? `Your organization's application was not approved: ${tenant.onboarding.rejectionReason}`
            : undefined,
        });
      }
    }

    if (account.mfaEnabled) {
      // Issue a short-lived MFA challenge token instead of full tokens.
      const mfaToken = generateToken(
        { userId: account._id.toString(), mfaChallenge: true },
        config.jwt.secret,
        { expiresIn: "5m", issuer: "fix-my-ride", audience: "fix-my-ride-clients" },
      );
      throw AppError.fromCode("MFA_REQUIRED", {
        message: "Multi-factor authentication required",
        details: { mfaToken },
      });
    }

    await account.recordLogin(ip ?? "unknown", userAgent ?? "unknown", "login", true);

    const tokens = issueTokens(account);
    return { account, tokens };
  },

  /**
   * Complete MFA step and issue tokens.
   */
  async verifyMfa(input: {
    mfaToken: string;
    code: string;
    notify?: NotifyFn;
  }): Promise<{ account: any; tokens: TokenPair }> {
    const decoded = (await import("jsonwebtoken")).default.verify(
      input.mfaToken,
      config.jwt.secret,
      { issuer: "fix-my-ride", audience: "fix-my-ride-clients" },
    ) as any;

    if (!decoded?.mfaChallenge || !decoded.userId) {
      throw AppError.fromCode("TOKEN_INVALID", { message: "Invalid MFA challenge" });
    }

    const account = await Account.findById(decoded.userId).select("+mfaSecret +mfaEnabled");
    if (!account || !account.mfaEnabled) {
      throw AppError.fromCode("MFA_INVALID", { message: "MFA is not enabled" });
    }

    const mfaSecret = account.mfaSecret;
    if (!mfaSecret) {
      throw AppError.fromCode("MFA_INVALID", { message: "MFA secret is missing" });
    }

    const ok = verifyTotp(mfaSecret, input.code);
    if (!ok) {
      throw AppError.fromCode("MFA_INVALID", { message: "Invalid MFA code" });
    }

    const tokens = issueTokens(account);
    return { account, tokens };
  },

  /**
   * Refresh access token using a valid refresh token (rotation supported).
   */
  async refresh(input: { refreshToken: string }): Promise<TokenPair> {
    const { verifyToken } = await import("../utils/token");
    const decoded = verifyToken<{ userId: string; jti?: string }>(
      input.refreshToken,
      config.jwt.refreshSecret,
      { issuer: "fix-my-ride", audience: "fix-my-ride-clients" },
    );
    if (!decoded || !decoded.userId) {
      throw AppError.fromCode("REFRESH_TOKEN_INVALID", { message: "Refresh token is invalid or expired" });
    }

    // Revocation check
    const redis = getRedisClient();
    if (decoded.jti) {
      const revoked = await redis.get(`${REVOKED_PREFIX}${decoded.jti}`);
      if (revoked) {
        throw AppError.fromCode("TOKEN_REVOKED", { message: "Refresh token has been revoked" });
      }
    }

    const account = await Account.findById(decoded.userId).select("+status +isDeleted");
    if (!account || account.isDeleted || account.status === "suspended") {
      throw AppError.fromCode("REFRESH_TOKEN_INVALID", { message: "Account is no longer active" });
    }

    return issueTokens(account);
  },

  /**
   * Logout: revoke the current access + refresh tokens.
   */
  async logout(input: { accessToken: string; refreshToken?: string }): Promise<void> {
    try {
      if (input.accessToken) {
        await invalidateToken(input.accessToken, { getRedis: getRedisClient, prefix: REVOKED_PREFIX });
      }
      if (input.refreshToken) {
        await invalidateToken(input.refreshToken, { getRedis: getRedisClient, prefix: REVOKED_PREFIX });
      }
    } catch (err) {
      logger.error({ type: "logout_revoke_failed", error: (err as Error).message });
    }
  },

  /**
   * Initiate password reset (send email with token).
   */
  async forgotPassword(input: { email: string; notify?: NotifyFn }): Promise<void> {
    const account = await Account.findOne({
      email: input.email.toLowerCase().trim(),
      isDeleted: false,
    });
    // Always return success to avoid email enumeration
    if (!account) return;

    const token = account.generatePasswordResetToken();
    await account.save();

    if (input.notify) {
      await input.notify("password_reset", { email: account.email, token });
    }
  },

  /**
   * Complete password reset.
   */
  async resetPassword(input: { token: string; password: string }): Promise<void> {
    const hashedToken = crypto.createHash("sha256").update(input.token).digest("hex");
    const account = await Account.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
      isDeleted: false,
    });
    if (!account) {
      throw AppError.fromCode("TOKEN_INVALID", { message: "Password reset token is invalid or expired" });
    }

    const strength = validatePasswordStrength(input.password, {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
    });
    if (!strength.isValid) {
      throw AppError.fromCode("INVALID_INPUT_FORMAT", {
        message: strength.errors.join(" "),
        details: { field: "password" },
      });
    }

    account.passwordHash = await hashPassword(input.password);
    account.passwordResetToken = undefined;
    account.passwordResetExpires = undefined;
    account.failedLoginAttempts = 0;
    account.lockedUntil = undefined;
    if (account.status === "pending_verification") account.status = "active";
    await account.save();
  },

  /**
   * Change password for an authenticated user.
   */
  async changePassword(input: {
    userId: string;
    currentPassword: string;
    newPassword: string;
  }): Promise<void> {
    const account = await Account.findById(input.userId).select("+passwordHash");
    if (!account) {
      throw AppError.fromCode("NOT_FOUND", { message: "Account not found" });
    }

    const valid = await verifyPassword(input.currentPassword, account.passwordHash ?? "");
    if (!valid) {
      throw AppError.fromCode("INVALID_CREDENTIALS", { message: "Current password is incorrect" });
    }

    const strength = validatePasswordStrength(input.newPassword, {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
    });
    if (!strength.isValid) {
      throw AppError.fromCode("INVALID_INPUT_FORMAT", {
        message: strength.errors.join(" "),
        details: { field: "newPassword" },
      });
    }

    account.passwordHash = await hashPassword(input.newPassword);
    await account.save();
  },

  /**
   * Verify email using the verification token.
   */
  async verifyEmail(input: { token: string }): Promise<void> {
    const hashedToken = crypto.createHash("sha256").update(input.token).digest("hex");
    const account = await Account.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: new Date() },
      isDeleted: false,
    });
    if (!account) {
      throw AppError.fromCode("TOKEN_INVALID", { message: "Email verification token is invalid or expired" });
    }
    account.emailVerified = true;
    account.emailVerificationToken = undefined;
    account.emailVerificationExpires = undefined;
    if (account.status === "pending_verification") account.status = "active";
    await account.save();
  },

  /**
   * Resend email verification token.
   */
  async resendVerification(input: { email: string; notify?: NotifyFn }): Promise<void> {
    const account = await Account.findOne({
      email: input.email.toLowerCase().trim(),
      isDeleted: false,
    });
    if (!account || account.emailVerified) return;

    const token = account.generateEmailVerificationToken();
    await account.save();

    if (input.notify) {
      await input.notify("email_verification", { email: account.email, token });
    }
  },

  /**
   * Get the currently authenticated account (safe projection).
   */
  async getMe(userId: string): Promise<any> {
    // mfaBackupCodes.code already carries schema-level `select: false`; also
    // excluding the parent array here collides with that in Mongoose's
    // projection merging ("Path collision at mfaBackupCodes.code").
    const account = await Account.findById(userId).select("-passwordHash -mfaSecret -authProviderId");
    if (!account) {
      throw AppError.fromCode("NOT_FOUND", { message: "Account not found" });
    }
    return account;
  },

  /**
   * Update own profile (name, preferences). Does not touch credentials.
   */
  async updateMe(userId: string, updates: Record<string, any>): Promise<any> {
    const account = await Account.findById(userId);
    if (!account) {
      throw AppError.fromCode("NOT_FOUND", { message: "Account not found" });
    }

    const allowed = ["preferences"];
    for (const key of Object.keys(updates)) {
      if (!allowed.includes(key)) continue;
      (account as any)[key] = updates[key];
    }
    await account.save();
    return account;
  },

  // ─── MFA ──────────────────────────────────────────────────────────────────

  async setupMfa(userId: string): Promise<{ secret: string; backupCodes: string[] }> {
    const account = await Account.findById(userId);
    if (!account) throw AppError.fromCode("NOT_FOUND", { message: "Account not found" });
    const { secret, backupCodes } = account.generateMfaSecret();
    await account.save();
    return { secret, backupCodes };
  },

  async enableMfa(input: { userId: string; code: string }): Promise<void> {
    const account = await Account.findById(input.userId).select("+mfaSecret");
    if (!account) throw AppError.fromCode("NOT_FOUND", { message: "Account not found" });
    if (!account.mfaSecret) {
      throw AppError.fromCode("MFA_INVALID", { message: "MFA setup not initialized" });
    }
    const ok = verifyTotp(account.mfaSecret, input.code);
    if (!ok) {
      throw AppError.fromCode("MFA_INVALID", { message: "Invalid MFA code" });
    }
    account.mfaEnabled = true;
    await account.save();
  },

  async disableMfa(input: { userId: string; code: string }): Promise<void> {
    const account = await Account.findById(input.userId).select("+mfaSecret");
    if (!account) throw AppError.fromCode("NOT_FOUND", { message: "Account not found" });
    if (account.mfaEnabled && account.mfaSecret) {
    const secret = account.mfaSecret;
    if (!secret) {
      throw AppError.fromCode("MFA_INVALID", { message: "MFA secret is missing" });
    }

    const ok = verifyTotp(secret, input.code);
      if (!ok) {
        throw AppError.fromCode("MFA_INVALID", { message: "Invalid MFA code" });
      }
    }
    account.mfaEnabled = false;
    account.mfaSecret = undefined;
    account.mfaBackupCodes = [];
    await account.save();
  },

  async generateBackupCodes(userId: string): Promise<string[]> {
    const account = await Account.findById(userId);
    if (!account) throw AppError.fromCode("NOT_FOUND", { message: "Account not found" });
    const { backupCodes } = account.generateMfaSecret();
    await account.save();
    return backupCodes;
  },
};

/**
 * Minimal TOTP verification (RFC 6238) without external deps.
 * Uses a 30s time-step and a ±1 step drift window.
 */
function verifyTotp(secret: string, token: string, digits = 6, step = 30): boolean {
  const cleaned = token.replace(/\s/g, "");
  if (!/^\d+$/.test(cleaned) || cleaned.length !== digits) return false;
  const secretBytes = Buffer.from(secret, "hex");
  const now = Math.floor(Date.now() / 1000);
  for (const drift of [-1, 0, 1]) {
    const counter = Math.floor((now + drift * step) / step);
    const expected = totpToken(secretBytes, counter, digits);
    if (expected === cleaned) return true;
  }
  return false;
}

function totpToken(secret: Buffer, counter: number, digits: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter), 0);
  const hmac = crypto.createHmac("sha1", secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const otp = binary % 10 ** digits;
  return otp.toString().padStart(digits, "0");
}

export default authService;
