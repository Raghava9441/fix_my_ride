import { connectTestReplSetDb, disconnectTestDb, clearTestDb } from "../test-utils/db";
import { Account } from "../models/Account";
import { Tenant } from "../models/Tenant";
import { OwnerProfile } from "../models/OwnerProfile";
import { StaffProfile } from "../models/StaffProfile";
import { ServiceCenter } from "../models/ServiceCenter";
import { SubscriptionPlan } from "../models/SubscriptionPlan";
import { Role } from "../models/Role";
import { Permission } from "../models/Permission";
import { onboardingService, OnboardingSignupInput } from "./onboarding.service";

async function seedPrerequisites() {
  await Permission.seedDefaults();
  await Role.seedSystemRoles();
  await SubscriptionPlan.create({
    name: "Free",
    slug: "free",
    type: "free",
    price: 0,
    trialDays: 14,
    isActive: true,
    isPublic: true,
  });
}

function baseInput(overrides: Partial<OnboardingSignupInput> = {}): OnboardingSignupInput {
  return {
    ownerFirstName: "Jane",
    ownerLastName: "Doe",
    email: "jane@acme-garage.com",
    password: "Str0ngPassw0rd!",
    organizationName: "Acme Garage",
    contactPhone: "+15551234567",
    businessRegistrationNumber: `BRN-${Date.now()}`,
    city: "Springfield",
    ...overrides,
  };
}

describe("onboardingService.signup", () => {
  beforeAll(async () => {
    await connectTestReplSetDb();
  }, 60000);

  afterAll(async () => {
    await disconnectTestDb();
  }, 30000);

  beforeEach(async () => {
    await clearTestDb();
    await seedPrerequisites();
  });

  it("atomically creates Tenant + Account + OwnerProfile + StaffProfile + ServiceCenter, correctly cross-referenced", async () => {
    const result = await onboardingService.signup(baseInput());

    expect(result.tokens.accessToken).toBeTruthy();
    expect(result.tenant.onboarding.status).toBe("pending_review");
    expect(result.tenant.slug).toBe("acme-garage");

    const account = await Account.findById(result.account._id);
    expect(account).not.toBeNull();
    expect(account!.primaryRole).toBe("owner");
    expect(String(account!.tenantId)).toBe(String(result.tenant._id));
    expect(account!.ownerProfileId).toBeDefined();
    expect(account!.staffProfileId).toBeDefined();

    const tenant = await Tenant.findById(result.tenant._id);
    expect(String(tenant!.ownerId)).toBe(String(account!._id));
    expect(tenant!.subscription.status).toBe("trial");
    expect(tenant!.limits.maxVehicles).toBeGreaterThanOrEqual(0);

    const ownerProfile = await OwnerProfile.findOne({ accountId: account!._id });
    expect(ownerProfile).not.toBeNull();

    const serviceCenter = await ServiceCenter.findById(result.serviceCenter._id);
    expect(String(serviceCenter!.tenantId)).toBe(String(tenant!._id));

    const staffProfile = await StaffProfile.findOne({ accountId: account!._id });
    expect(staffProfile).not.toBeNull();
    expect(String(staffProfile!.serviceCenterId)).toBe(String(serviceCenter!._id));
    expect(String(serviceCenter!.createdBy)).toBe(String(staffProfile!._id));

    const ownerRole = await Role.findById(staffProfile!.roleId);
    expect(ownerRole!.slug).toBe("tenant_admin");
  });

  it("rejects a duplicate email", async () => {
    await onboardingService.signup(baseInput());
    await expect(
      onboardingService.signup(baseInput({ businessRegistrationNumber: `BRN-${Date.now()}-2` })),
    ).rejects.toThrow(/already exists/i);
  });

  it("rejects a duplicate business registration number", async () => {
    const brn = `BRN-DUPLICATE-${Date.now()}`;
    await onboardingService.signup(baseInput({ businessRegistrationNumber: brn }));
    await expect(
      onboardingService.signup(
        baseInput({ email: "second@acme-garage.com", businessRegistrationNumber: brn }),
      ),
    ).rejects.toThrow(/business registration number/i);
  });

  it("auto-generates a unique slug when the organization name collides", async () => {
    const first = await onboardingService.signup(baseInput());
    const second = await onboardingService.signup(
      baseInput({ email: "second@acme-garage.com", businessRegistrationNumber: `BRN-${Date.now()}-2` }),
    );

    expect(first.tenant.slug).toBe("acme-garage");
    expect(second.tenant.slug).toBe("acme-garage-2");
  });

  it("rolls back the entire transaction if a later step fails — nothing partial is persisted", async () => {
    const spy = jest
      .spyOn(StaffProfile.prototype, "save")
      .mockImplementationOnce(() => Promise.reject(new Error("simulated failure")));

    const input = baseInput({ email: "rollback@acme-garage.com" });
    await expect(onboardingService.signup(input)).rejects.toThrow("simulated failure");

    expect(await Account.findOne({ email: input.email })).toBeNull();
    expect(await Tenant.findOne({ slug: "acme-garage" })).toBeNull();
    expect(await ServiceCenter.findOne({ businessRegistrationNumber: input.businessRegistrationNumber })).toBeNull();

    spy.mockRestore();
  });
});
