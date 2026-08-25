import express, { Request, Response } from "express";
import request from "supertest";
import { connectTestDb, disconnectTestDb, clearTestDb } from "../test-utils/db";
import { Account } from "../models/Account";
import { Tenant } from "../models/Tenant";
import { StaffProfile } from "../models/StaffProfile";
import { Role } from "../models/Role";
import { Permission } from "../models/Permission";
import { issueTokens } from "../services/auth.service";
import { authenticateOptional } from "./auth.middleware";
import { requestContext } from "./requestContext.middleware";
import { tenantIsolation } from "./tenant.middleware";

// Mirrors the real app.ts middleware order (authenticateOptional ->
// requestContext -> tenantIsolation) rather than importing the full app,
// which pulls in an ESM-only package Jest can't parse (see
// webhook.controller.test.ts for the same reasoning).
function buildTestApp() {
  const app = express();
  app.use(authenticateOptional);
  app.use(requestContext);
  app.use(tenantIsolation);

  app.get("/test/staff", async (_req: Request, res: Response) => {
    const staff = await StaffProfile.find({});
    res.json({ count: staff.length, ids: staff.map((s) => String(s._id)) });
  });

  return app;
}

async function makeTenantWithStaff(name: string) {
  const tenant = await Tenant.create({
    name,
    slug: `${name.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    contactEmail: `owner@${name.toLowerCase()}.com`,
  });
  const account = await Account.create({
    email: `owner@${name.toLowerCase()}-${Date.now()}.com`,
    primaryRole: "owner",
    roles: ["owner"],
    tenantId: tenant._id,
    status: "active",
    emailVerified: true,
  });
  const role = await Role.findOne({ slug: "tenant_admin", type: "system" });
  const staffProfile = await StaffProfile.create({
    accountId: account._id,
    // serviceCenterId isn't required for this test's purpose (isolation on
    // StaffProfile.tenantId, auto-stamped by tenantPlugin on save when
    // AsyncLocalStorage context has hasContext=false, i.e. this seed-time
    // create runs with no request context — so we stamp tenantId directly).
    serviceCenterId: tenant._id,
    roleId: role!._id,
    tenantId: tenant._id,
  });

  const { accessToken } = issueTokens(account);
  return { tenant, account, staffProfile, accessToken };
}

describe("tenant isolation — JWT-authenticated request (regression for the authenticateOptional/tenantIsolation ordering fix)", () => {
  beforeAll(async () => {
    await connectTestDb();
    await Permission.seedDefaults();
    await Role.seedSystemRoles();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  afterEach(async () => {
    await clearTestDb();
    // Re-seed roles each time since clearTestDb() wipes every collection.
    await Permission.seedDefaults();
    await Role.seedSystemRoles();
  });

  it("only returns the caller's own tenant's data, not another tenant's", async () => {
    const app = buildTestApp();
    const tenantA = await makeTenantWithStaff("AcmeGarage");
    const tenantB = await makeTenantWithStaff("BetaGarage");

    const resA = await request(app)
      .get("/test/staff")
      .set("Authorization", `Bearer ${tenantA.accessToken}`);

    expect(resA.status).toBe(200);
    expect(resA.body.count).toBe(1);
    expect(resA.body.ids).toEqual([String(tenantA.staffProfile._id)]);
    expect(resA.body.ids).not.toContain(String(tenantB.staffProfile._id));

    const resB = await request(app)
      .get("/test/staff")
      .set("Authorization", `Bearer ${tenantB.accessToken}`);

    expect(resB.status).toBe(200);
    expect(resB.body.count).toBe(1);
    expect(resB.body.ids).toEqual([String(tenantB.staffProfile._id)]);
  });

  it("returns nothing for an unauthenticated request to a tenant-scoped collection (fails closed, not open)", async () => {
    const app = buildTestApp();
    await makeTenantWithStaff("AcmeGarage");

    const res = await request(app).get("/test/staff");

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
  });
});
