import { ReportController } from "./report.controller";

const CENTER_A = "a".repeat(24);
const CENTER_B = "b".repeat(24);
const OWNER_A = "c".repeat(24);
const OWNER_B = "d".repeat(24);

function makeController(opts: { staffCenter?: string | null; ownerId?: string | null }) {
  const reportService = {
    getCenterRevenue: jest.fn().mockResolvedValue({ daily: [], total: 0 }),
    getCenterDashboard: jest.fn().mockResolvedValue({}),
    getOwnerExpenses: jest.fn().mockResolvedValue({ total: 0 }),
    getTenantsReport: jest.fn().mockResolvedValue({ total: 1 }),
    toCsv: jest.fn().mockReturnValue("csv"),
  };
  const staffService = {
    findByAccountId: jest
      .fn()
      .mockResolvedValue(opts.staffCenter ? { serviceCenterId: opts.staffCenter } : null),
  };
  const ownerService = {
    findByAccountId: jest.fn().mockResolvedValue(opts.ownerId ? { _id: opts.ownerId } : null),
  };
  const controller = new ReportController(reportService as any, staffService as any, ownerService as any);
  return { controller, reportService };
}

function call(user: { id: string; role: string; roles?: string[] }, query: Record<string, string> = {}, body?: unknown) {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
    send(payload: any) {
      this.body = payload;
      return this;
    },
    setHeader(k: string, v: string) {
      this.headers[k] = v;
    },
  };
  const req: any = { user: { roles: [user.role], ...user }, query, validated: body };
  return { req, res };
}

describe("ReportController authorization", () => {
  describe("service-center reports", () => {
    it("pins a staff member to their own center", async () => {
      const { controller, reportService } = makeController({ staffCenter: CENTER_A });
      const { req, res } = call({ id: "u1", role: "staff" });
      await controller.getCenterRevenue(req, res);
      expect(res.statusCode).toBe(200);
      expect(reportService.getCenterRevenue).toHaveBeenCalledWith(CENTER_A, undefined, undefined);
    });

    it("refuses a staff member who names another center", async () => {
      const { controller, reportService } = makeController({ staffCenter: CENTER_A });
      const { req, res } = call({ id: "u1", role: "staff" }, { serviceCenterId: CENTER_B });
      await controller.getCenterRevenue(req, res);
      expect(res.statusCode).toBe(403);
      expect(reportService.getCenterRevenue).not.toHaveBeenCalled();
    });

    it("refuses a customer account (no staff profile), even when it names a center", async () => {
      const { controller, reportService } = makeController({ staffCenter: null, ownerId: OWNER_A });
      const { req, res } = call({ id: "u2", role: "owner" }, { serviceCenterId: CENTER_A });
      await controller.getCenterRevenue(req, res);
      expect(res.statusCode).toBe(403);
      expect(reportService.getCenterRevenue).not.toHaveBeenCalled();
    });

    it("lets a workspace owner (account role 'owner' with a staff profile) read their center", async () => {
      const { controller, reportService } = makeController({ staffCenter: CENTER_A, ownerId: OWNER_A });
      const { req, res } = call({ id: "u3", role: "owner" });
      await controller.getCenterRevenue(req, res);
      expect(res.statusCode).toBe(200);
      expect(reportService.getCenterRevenue).toHaveBeenCalledWith(CENTER_A, undefined, undefined);
    });

    it("lets an admin read any center", async () => {
      const { controller, reportService } = makeController({ staffCenter: null });
      const { req, res } = call({ id: "root", role: "admin" }, { serviceCenterId: CENTER_B });
      await controller.getCenterRevenue(req, res);
      expect(reportService.getCenterRevenue).toHaveBeenCalledWith(CENTER_B, undefined, undefined);
    });

    it("answers 400 rather than 500 for an unparseable date", async () => {
      const { controller, reportService } = makeController({ staffCenter: CENTER_A });
      const { req, res } = call({ id: "u1", role: "staff" }, { startDate: "not-a-date" });
      await controller.getCenterRevenue(req, res);
      expect(res.statusCode).toBe(400);
      expect(reportService.getCenterRevenue).not.toHaveBeenCalled();
    });
  });

  describe("owner reports", () => {
    it("shows a customer their own figures", async () => {
      const { controller, reportService } = makeController({ ownerId: OWNER_A });
      const { req, res } = call({ id: "u2", role: "owner" });
      await controller.getOwnerExpenses(req, res);
      expect(reportService.getOwnerExpenses).toHaveBeenCalledWith(OWNER_A);
    });

    it("refuses a customer who asks for someone else's", async () => {
      const { controller, reportService } = makeController({ ownerId: OWNER_A });
      const { req, res } = call({ id: "u2", role: "owner" }, { ownerId: OWNER_B });
      await controller.getOwnerExpenses(req, res);
      expect(res.statusCode).toBe(403);
      expect(reportService.getOwnerExpenses).not.toHaveBeenCalled();
    });

    it("lets staff look at a customer", async () => {
      const { controller, reportService } = makeController({ staffCenter: CENTER_A });
      const { req, res } = call({ id: "u1", role: "staff" }, { ownerId: OWNER_B });
      await controller.getOwnerExpenses(req, res);
      expect(reportService.getOwnerExpenses).toHaveBeenCalledWith(OWNER_B);
    });
  });

  describe("export", () => {
    it("refuses platform reports to non-admins", async () => {
      const { controller, reportService } = makeController({ staffCenter: CENTER_A });
      const { req, res } = call({ id: "u1", role: "staff" }, {}, { type: "tenant", format: "csv" });
      await controller.exportReport(req, res);
      expect(res.statusCode).toBe(403);
      expect(reportService.getTenantsReport).not.toHaveBeenCalled();
    });

    it("refuses a center export for another center", async () => {
      const { controller, reportService } = makeController({ staffCenter: CENTER_A });
      const { req, res } = call({ id: "u1", role: "staff" }, { serviceCenterId: CENTER_B }, { type: "revenue", format: "csv" });
      await controller.exportReport(req, res);
      expect(res.statusCode).toBe(403);
      expect(reportService.getCenterRevenue).not.toHaveBeenCalled();
    });

    it("exports a platform report for an admin", async () => {
      const { controller } = makeController({ staffCenter: null });
      const { req, res } = call({ id: "root", role: "admin" }, {}, { type: "tenant", format: "csv" });
      await controller.exportReport(req, res);
      expect(res.statusCode).toBe(200);
      expect(res.headers["Content-Type"]).toBe("text/csv");
    });
  });
});
