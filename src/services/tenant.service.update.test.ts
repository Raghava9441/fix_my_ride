import { connectTestDb, disconnectTestDb, clearTestDb } from "../test-utils/db";
import { Tenant } from "../models/Tenant";
import { tenantService } from "./tenant.service";

async function makeTenant() {
  return Tenant.create({
    name: "Acme Garage",
    slug: `acme-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    contactEmail: "billing@acme.com",
    address: { street: "1 Main St", city: "Pune", country: "IN", timezone: "Asia/Kolkata", currency: "INR" },
    settings: { enableMfa: false, requireEmailVerification: false, allowSignups: true, sessionTimeoutMinutes: 15 },
    onboarding: { status: "approved", submittedAt: new Date() },
  });
}

describe("tenantService.update - partial nested updates", () => {
  beforeAll(async () => {
    await connectTestDb();
  });
  afterAll(async () => {
    await disconnectTestDb();
  });
  afterEach(async () => {
    await clearTestDb();
  });

  it("changing one address field keeps the rest of the address", async () => {
    const tenant = await makeTenant();

    const updated = await tenantService.update(String(tenant._id), { address: { city: "Mumbai" } } as any);

    expect(updated.address.city).toBe("Mumbai");
    expect(updated.address.street).toBe("1 Main St");
    expect(updated.address.country).toBe("IN");
    expect(updated.address.timezone).toBe("Asia/Kolkata");
    expect(updated.address.currency).toBe("INR");
  });

  it("changing one setting keeps the other settings and the password policy", async () => {
    const tenant = await makeTenant();

    const updated = await tenantService.update(String(tenant._id), { settings: { allowSignups: false } } as any);

    expect(updated.settings.allowSignups).toBe(false);
    // Non-default values: a wipe back to the schema defaults would show here.
    expect(updated.settings.enableMfa).toBe(false);
    expect(updated.settings.requireEmailVerification).toBe(false);
    expect(updated.settings.sessionTimeoutMinutes).toBe(15);
    expect(updated.settings.passwordPolicy?.minLength).toBeDefined();
  });
});
