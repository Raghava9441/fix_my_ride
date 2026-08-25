import { connectTestDb, disconnectTestDb, clearTestDb } from "../test-utils/db";
import { Tenant } from "../models/Tenant";
import { Account } from "../models/Account";
import { tenantService } from "./tenant.service";

async function makePendingTenant() {
  return Tenant.create({
    name: "Acme Garage",
    slug: `acme-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    contactEmail: "billing@acme.com",
    onboarding: { status: "pending_review", submittedAt: new Date() },
  });
}

describe("tenantService approve/reject", () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  afterEach(async () => {
    await clearTestDb();
  });

  it("findPendingReview lists only pending_review tenants", async () => {
    await makePendingTenant();
    await Tenant.create({
      name: "Already Approved Co",
      slug: `approved-${Date.now()}`,
      contactEmail: "billing@approved.com",
      onboarding: { status: "approved", submittedAt: new Date() },
    });

    const result = await tenantService.findPendingReview();
    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe("Acme Garage");
  });

  it("approveTenant flips status to approved and records the reviewer", async () => {
    const tenant = await makePendingTenant();
    const reviewer = await Account.create({ email: "admin@platform.com", primaryRole: "admin" });

    const approved = await tenantService.approveTenant(String(tenant._id), String(reviewer._id));

    expect(approved!.onboarding.status).toBe("approved");
    expect(String(approved!.onboarding.reviewedBy)).toBe(String(reviewer._id));
    expect(approved!.onboarding.reviewedAt).toBeDefined();
  });

  it("rejectTenant flips status to rejected and stores the reason", async () => {
    const tenant = await makePendingTenant();
    const reviewer = await Account.create({ email: "admin2@platform.com", primaryRole: "admin" });

    const rejected = await tenantService.rejectTenant(
      String(tenant._id),
      String(reviewer._id),
      "Incomplete business registration",
    );

    expect(rejected!.onboarding.status).toBe("rejected");
    expect(rejected!.onboarding.rejectionReason).toBe("Incomplete business registration");
  });

  it("returns null when approving a tenant that isn't pending_review (idempotency guard)", async () => {
    const tenant = await makePendingTenant();
    const reviewer = await Account.create({ email: "admin3@platform.com", primaryRole: "admin" });

    await tenantService.approveTenant(String(tenant._id), String(reviewer._id));
    const secondAttempt = await tenantService.approveTenant(String(tenant._id), String(reviewer._id));

    expect(secondAttempt).toBeNull();
  });
});
