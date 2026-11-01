import fs from "fs/promises";
import os from "os";
import path from "path";
import { connectTestDb, disconnectTestDb, clearTestDb } from "../test-utils/db";
import { Tenant } from "../models/Tenant";
import { Account } from "../models/Account";
import "../models/SubscriptionPlan";
import { tenantService } from "./tenant.service";
import { accountService } from "./account.service";
import { readTail } from "./admin.service";

describe("readTail", () => {
  let dir: string;
  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "tail-"));
  });
  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("returns a small file whole", async () => {
    const file = path.join(dir, "small.log");
    await fs.writeFile(file, "one\ntwo\nthree\n");
    expect(await readTail(file, 1024)).toBe("one\ntwo\nthree\n");
  });

  it("returns only whole lines from the end of a large file", async () => {
    const file = path.join(dir, "big.log");
    const lines = Array.from({ length: 5000 }, (_, i) => `line-${i}`);
    await fs.writeFile(file, lines.join("\n") + "\n");

    const tail = await readTail(file, 200);
    const got = tail.split("\n").filter(Boolean);

    expect(got.length).toBeLessThan(40);
    expect(got[got.length - 1]).toBe("line-4999");
    // No line is cut in half: each one is a complete "line-N".
    expect(got.every((l) => /^line-\d+$/.test(l))).toBe(true);
  });

  it("rejects with ENOENT for a missing file, so the caller can explain it", async () => {
    await expect(readTail(path.join(dir, "nope.log"), 100)).rejects.toMatchObject({ code: "ENOENT" });
  });
});

describe("admin list filters", () => {
  beforeAll(async () => {
    await connectTestDb();
  });
  afterAll(async () => {
    await disconnectTestDb();
  });
  afterEach(async () => {
    await clearTestDb();
  });

  async function tenant(name: string, extra: Record<string, unknown> = {}) {
    return Tenant.create({
      name,
      slug: `${name.toLowerCase().replace(/\W+/g, "-")}-${Math.random().toString(36).slice(2, 6)}`,
      contactEmail: `${name.toLowerCase().replace(/\W+/g, "")}@x.com`,
      onboarding: { status: "approved", submittedAt: new Date() },
      ...extra,
    });
  }

  it("filters tenants by review state, activity and free text", async () => {
    await tenant("Acme Garage");
    await tenant("Beta Motors", { onboarding: { status: "pending_review", submittedAt: new Date() } });
    await tenant("Gamma Autos", { isActive: false });

    expect((await tenantService.findAll({ approval: "pending_review" })).data.map((t: any) => t.name)).toEqual(["Beta Motors"]);
    expect((await tenantService.findAll({ isActive: false })).data.map((t: any) => t.name)).toEqual(["Gamma Autos"]);
    expect((await tenantService.findAll({ q: "acme" })).data).toHaveLength(1);
    // Regex characters are literal, not a pattern that matches everything.
    expect((await tenantService.findAll({ q: ".*" })).data).toHaveLength(0);
  });

  it("caps the page size", async () => {
    await tenant("One");
    expect((await tenantService.findAll({ limit: 100000 })).pagination.limit).toBe(100);
  });

  it("filters accounts by role and by email text", async () => {
    await Account.create({ email: "alice@acme.com", passwordHash: "x", primaryRole: "staff", status: "active" });
    await Account.create({ email: "bob@acme.com", passwordHash: "x", primaryRole: "owner", status: "active" });

    expect((await accountService.findAll({ role: "staff" })).data.map((a: any) => a.email)).toEqual(["alice@acme.com"]);
    expect((await accountService.findAll({ q: "BOB" })).data.map((a: any) => a.email)).toEqual(["bob@acme.com"]);
  });
});
