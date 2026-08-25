import mongoose from "mongoose";
import crypto from "crypto";
import { Account } from "../models/Account";
import { Tenant } from "../models/Tenant";
import { OwnerProfile } from "../models/OwnerProfile";
import { StaffProfile } from "../models/StaffProfile";
import { ServiceCenter } from "../models/ServiceCenter";
import { SubscriptionPlan } from "../models/SubscriptionPlan";
import { Role } from "../models/Role";
import { hashPassword, validatePasswordStrength } from "../utils/password";
import { slugify } from "../utils/string";
import { issueTokens, TokenPair, NotifyFn } from "./auth.service";
import { AppError } from "../utils/appError";

export interface OnboardingSignupInput {
  ownerFirstName: string;
  ownerLastName: string;
  email: string;
  password: string;
  organizationName: string;
  contactPhone: string;
  contactEmail?: string;
  serviceCenterName?: string;
  businessRegistrationNumber: string;
  city: string;
  ip?: string;
  userAgent?: string;
  notify?: NotifyFn;
}

export interface OnboardingSignupResult {
  account: any;
  tenant: any;
  serviceCenter: any;
  tokens: TokenPair;
}

const TRIAL_RENOTIFY_DAYS_DEFAULT = 14;

async function generateUniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || "organization";
  let candidate = base;
  let suffix = 2;
  // Small, bounded retry loop — collisions on a freshly-slugified org name
  // are rare; this isn't meant to handle adversarial input.
  while (await Tenant.findOne({ slug: candidate, isDeleted: false })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
    if (suffix > 50) {
      candidate = `${base}-${crypto.randomBytes(3).toString("hex")}`;
      break;
    }
  }
  return candidate;
}

/**
 * Orchestrates a brand-new organization's signup: Tenant + Account +
 * OwnerProfile + StaffProfile + ServiceCenter, created atomically.
 *
 * Two real circular dependencies get broken the same way admin.seed.ts
 * already does it (placeholder id, patched once the real document exists),
 * inside one transaction so nothing is left half-created on failure:
 *   - Tenant.ownerId needs an Account that doesn't exist until after the
 *     Tenant is created.
 *   - ServiceCenter.createdBy needs a StaffProfile, but StaffProfile needs
 *     an existing ServiceCenter (serviceCenterId is required).
 */
export class OnboardingService {
  async signup(input: OnboardingSignupInput): Promise<OnboardingSignupResult> {
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

    const normalizedEmail = input.email.toLowerCase().trim();
    const existingAccount = await Account.findOne({ email: normalizedEmail, isDeleted: false });
    if (existingAccount) {
      throw AppError.fromCode("ALREADY_EXISTS", {
        message: "An account with this email already exists",
        details: { field: "email" },
      });
    }

    const existingCenter = await ServiceCenter.findOne({
      businessRegistrationNumber: input.businessRegistrationNumber,
    });
    if (existingCenter) {
      throw AppError.fromCode("ALREADY_EXISTS", {
        message: "A service center with this business registration number already exists",
        details: { field: "businessRegistrationNumber" },
      });
    }

    const freePlan = await SubscriptionPlan.findOne({ slug: "free", isDeleted: false });
    if (!freePlan) {
      throw new Error("Default 'free' subscription plan not found — seed subscription plans first");
    }

    const ownerRole = await Role.findOne({ slug: "tenant_admin", type: "system" });
    if (!ownerRole) {
      throw new Error("'tenant_admin' system role not found — seed roles first");
    }

    const slug = await generateUniqueSlug(input.organizationName);
    const now = new Date();
    const trialDays = freePlan.trialDays || TRIAL_RENOTIFY_DAYS_DEFAULT;
    const trialEndsAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Tenant, with a placeholder ownerId (patched once the Account exists).
      const tenant = new Tenant({
        name: input.organizationName,
        slug,
        contactEmail: (input.contactEmail ?? input.email).toLowerCase(),
        contactPhone: input.contactPhone,
        ownerId: new mongoose.Types.ObjectId(),
        subscription: {
          planId: freePlan._id,
          status: "trial",
          startedAt: now,
          trialEndsAt,
        },
        onboarding: {
          status: "pending_review",
          submittedAt: now,
        },
      });
      await tenant.save({ session });

      // 2. Account + OwnerProfile, then patch the Tenant/Account back-refs.
      const verificationToken = crypto.randomBytes(32).toString("hex");
      const account = new Account({
        email: normalizedEmail,
        passwordHash: await hashPassword(input.password),
        primaryRole: "owner",
        roles: ["owner"],
        tenantId: tenant._id,
        status: "pending_verification",
        emailVerificationToken: crypto.createHash("sha256").update(verificationToken).digest("hex"),
        emailVerificationExpires: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      });
      await account.save({ session });

      const ownerProfile = new OwnerProfile({
        accountId: account._id,
        firstName: input.ownerFirstName,
        lastName: input.ownerLastName,
      });
      await ownerProfile.save({ session });

      tenant.ownerId = account._id;
      await tenant.save({ session });

      account.ownerProfileId = ownerProfile._id;
      await account.save({ session });

      // 3. ServiceCenter, with a placeholder createdBy (patched once the
      // StaffProfile exists) — breaks the ServiceCenter<->StaffProfile cycle.
      const serviceCenter = new ServiceCenter({
        tenantId: tenant._id,
        name: input.serviceCenterName ?? input.organizationName,
        businessRegistrationNumber: input.businessRegistrationNumber,
        email: (input.contactEmail ?? input.email).toLowerCase(),
        phone: input.contactPhone,
        address: { city: input.city },
        subscription: {
          planId: freePlan._id,
          status: "trial",
          startedAt: now,
          trialEndsAt,
        },
        createdBy: new mongoose.Types.ObjectId(),
      });
      await serviceCenter.save({ session });

      // 4. StaffProfile for the owner (tenant_admin role), then patch
      // ServiceCenter.createdBy and Account.staffProfileId.
      const staffProfile = new StaffProfile({
        accountId: account._id,
        serviceCenterId: serviceCenter._id,
        roleId: ownerRole._id,
      });
      await staffProfile.save({ session });

      serviceCenter.createdBy = staffProfile._id;
      await serviceCenter.save({ session });

      account.staffProfileId = staffProfile._id;
      await account.save({ session });

      await session.commitTransaction();

      const tokens = issueTokens(account);

      if (input.notify) {
        await input.notify("email_verification", { email: account.email, token: verificationToken });
        await input.notify("org_submitted_for_review", {
          email: account.email,
          organizationName: tenant.name,
        });
      }

      return { account, tenant, serviceCenter, tokens };
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }
}

export const onboardingService = new OnboardingService();
