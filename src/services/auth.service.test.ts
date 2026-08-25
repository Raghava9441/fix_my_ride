import { connectTestDb, disconnectTestDb, clearTestDb } from "../test-utils/db";
import { Account } from "../models/Account";
import { Tenant } from "../models/Tenant";
import { hashPassword } from "../utils/password";
import { authService } from "./auth.service";

const PASSWORD = "Str0ngPassw0rd!";

async function makeTenant(onboardingStatus: "pending_review" | "approved" | "rejected") {
  return Tenant.create({
    name: "Acme Garage",
    slug: `acme-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    contactEmail: "billing@acme.com",
    onboarding: { status: onboardingStatus, submittedAt: new Date(), rejectionReason: "Test reason" },
  });
}

async function makeVerifiedAccount(tenantId: string, emailSuffix: string) {
  return Account.create({
    email: `owner-${emailSuffix}@acme.com`,
    passwordHash: await hashPassword(PASSWORD),
    primaryRole: "owner",
    tenantId,
    status: "active",
    emailVerified: true,
  });
}

describe("authService.login — tenant approval gate", () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  afterEach(async () => {
    await clearTestDb();
  });

  it("blocks login while the tenant is pending_review", async () => {
    const tenant = await makeTenant("pending_review");
    const account = await makeVerifiedAccount(String(tenant._id), "pending");

    await expect(authService.login({ email: account.email, password: PASSWORD })).rejects.toMatchObject({
      code: "AUTH_014",
    });
  });

  it("blocks login when the tenant was rejected, surfacing the reason", async () => {
    const tenant = await makeTenant("rejected");
    const account = await makeVerifiedAccount(String(tenant._id), "rejected");

    await expect(authService.login({ email: account.email, password: PASSWORD })).rejects.toMatchObject({
      code: "AUTH_015",
    });
  });

  it("allows login once the tenant is approved and the account is verified", async () => {
    const tenant = await makeTenant("approved");
    const account = await makeVerifiedAccount(String(tenant._id), "approved");

    const result = await authService.login({ email: account.email, password: PASSWORD });
    expect(result.tokens.accessToken).toBeTruthy();
  });

  it("still enforces the pre-existing email-verification gate independently of tenant approval", async () => {
    const tenant = await makeTenant("approved");
    const account = await Account.create({
      email: "unverified@acme.com",
      passwordHash: await hashPassword(PASSWORD),
      primaryRole: "owner",
      tenantId: tenant._id,
      status: "pending_verification",
      emailVerified: false,
    });

    await expect(authService.login({ email: account.email, password: PASSWORD })).rejects.toMatchObject({
      code: "AUTH_009",
    });
  });
});
