import mongoose from "mongoose";
import { connectTestDb, disconnectTestDb, clearTestDb } from "../test-utils/db";
import { Account } from "../models/Account";
import { Role } from "../models/Role";
import { StaffProfile } from "../models/StaffProfile";
import { authService } from "./auth.service";

describe("authService.getMe - rbacRole", () => {
  beforeAll(async () => {
    await connectTestDb();
  });
  afterAll(async () => {
    await disconnectTestDb();
  });
  afterEach(async () => {
    await clearTestDb();
  });

  it("reports the staff profile's role slug, so a workspace owner is distinguishable from a customer", async () => {
    const roleId = new mongoose.Types.ObjectId();
    const staffId = new mongoose.Types.ObjectId();
    // Raw inserts: a full Role / StaffProfile has many required fields that
    // are irrelevant here.
    await Role.collection.insertOne({ _id: roleId, slug: "tenant_admin", name: "Tenant admin" });

    const account = await Account.create({
      email: "owner@acme.com",
      passwordHash: "x",
      primaryRole: "owner",
      status: "active",
      emailVerified: true,
      staffProfileId: staffId,
    });
    await StaffProfile.collection.insertOne({ _id: staffId, accountId: account._id, roleId, isDeleted: false });

    const me = await authService.getMe(String(account._id));

    expect(me.rbacRole).toBe("tenant_admin");
    expect(me.email).toBe("owner@acme.com");
    // Still the same document shape, and still free of secrets.
    expect(me.passwordHash).toBeUndefined();
  });

  it("omits rbacRole for a customer with no staff profile", async () => {
    const account = await Account.create({
      email: "customer@acme.com",
      passwordHash: "x",
      primaryRole: "owner",
      status: "active",
      emailVerified: true,
    });

    const me = await authService.getMe(String(account._id));

    expect(me.rbacRole).toBeUndefined();
    expect(me.email).toBe("customer@acme.com");
  });
});
