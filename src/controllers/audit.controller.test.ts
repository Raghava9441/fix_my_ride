import mongoose from "mongoose";
import { connectTestDb, disconnectTestDb, clearTestDb } from "../test-utils/db";
import { AuditLogController } from "./audit.controller";
import "../models/Account"; // registers the model that `actorId` is populated from
import { auditLogService } from "../services/audit.service";

function call(query: Record<string, string> = {}, params: Record<string, string> = {}) {
  const res: any = {
    statusCode: 200,
    body: undefined as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
  return { req: { query, params } as any, res };
}

const oid = () => String(new mongoose.Types.ObjectId());

describe("AuditLogController", () => {
  beforeAll(async () => {
    await connectTestDb();
  });
  afterAll(async () => {
    await disconnectTestDb();
  });
  afterEach(async () => {
    await clearTestDb();
  });

  const controller = new AuditLogController(auditLogService);

  describe("query validation answers 400 rather than 500", () => {
    it("for an unparseable date", async () => {
      const { req, res } = call({ fromDate: "yesterday-ish" });
      await controller.getAll(req, res);
      expect(res.statusCode).toBe(400);
    });

    it("for an id that is not an ObjectId", async () => {
      const { req, res } = call({ actorId: "not-an-id" });
      await controller.getAll(req, res);
      expect(res.statusCode).toBe(400);
    });

    it("for a bad date on the summary", async () => {
      const { req, res } = call({ toDate: "nope" });
      await controller.getActivitySummary(req, res);
      expect(res.statusCode).toBe(400);
    });
  });

  describe("listing", () => {
    async function seed(n: number) {
      for (let i = 0; i < n; i += 1) {
        await auditLogService.create({
          actorId: oid(),
          actorRole: "admin",
          action: "UPDATE",
          entityType: "Tenant",
          entityId: oid(),
        });
      }
    }

    it("caps the page size", async () => {
      await seed(3);
      const { req, res } = call({ limit: "100000" });
      await controller.getAll(req, res);
      expect(res.statusCode).toBe(200);
      expect(res.body.meta.pagination.limit).toBe(100);
    });

    it("filters by date range", async () => {
      await seed(2);
      const future = new Date(Date.now() + 86_400_000).toISOString();
      const { req, res } = call({ fromDate: future });
      await controller.getAll(req, res);
      expect(res.body.data).toHaveLength(0);
    });
  });

  describe("what is recorded", () => {
    it("keeps the status and path, so a refused attempt is distinguishable from a success", async () => {
      const refused = await auditLogService.create({
        actorId: oid(),
        actorRole: "admin",
        action: "DELETE",
        entityType: "Tenant",
        entityId: oid(),
        statusCode: 403,
        path: "/api/v1/admin/tenants/abc",
      });
      expect(refused.statusCode).toBe(403);
      expect(refused.path).toBe("/api/v1/admin/tenants/abc");
    });

    it("accepts every account role as an actor, not just three of them", async () => {
      for (const role of ["fleet_manager", "service_advisor"] as const) {
        const log = await auditLogService.create({
          actorId: oid(),
          actorRole: role,
          action: "UPDATE",
          entityType: "Account",
          entityId: oid(),
        });
        expect(log.actorRole).toBe(role);
      }
    });
  });
});
