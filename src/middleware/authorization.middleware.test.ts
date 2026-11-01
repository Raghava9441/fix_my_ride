import { requireStaffSide, requireWorkspaceAdmin } from "./authorization.middleware";
import { StaffProfile } from "../models/StaffProfile";

jest.mock("../models/StaffProfile", () => ({
  StaffProfile: { findByAccount: jest.fn() },
}));

const findByAccount = StaffProfile.findByAccount as unknown as jest.Mock;

async function run(user: { id: string; role: string; roles?: string[] } | undefined) {
  const next = jest.fn();
  await requireWorkspaceAdmin({ user, id: "req-1" } as any, {} as any, next);
  return next;
}

describe("requireWorkspaceAdmin", () => {
  afterEach(() => findByAccount.mockReset());

  it("lets a platform admin through without looking up a profile", async () => {
    const next = await run({ id: "a1", role: "admin", roles: ["admin"] });
    expect(next).toHaveBeenCalledWith();
    expect(findByAccount).not.toHaveBeenCalled();
  });

  it("lets the workspace owner through: account role 'owner' plus a tenant_admin staff profile", async () => {
    findByAccount.mockResolvedValue({ roleId: { slug: "tenant_admin" } });
    const next = await run({ id: "u1", role: "owner", roles: ["owner"] });
    expect(next).toHaveBeenCalledWith();
  });

  it("refuses a customer: also account role 'owner', but no staff profile", async () => {
    findByAccount.mockResolvedValue(null);
    const next = await run({ id: "u2", role: "owner", roles: ["owner"] });
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ httpStatus: 403 }));
  });

  it("refuses ordinary staff whose role is not tenant_admin", async () => {
    findByAccount.mockResolvedValue({ roleId: { slug: "technician" } });
    const next = await run({ id: "u3", role: "staff", roles: ["staff"] });
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ httpStatus: 403 }));
  });

  it("is unauthenticated without a user", async () => {
    const next = await run(undefined);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ httpStatus: 401 }));
  });

  it("passes a lookup failure on rather than hanging the request", async () => {
    findByAccount.mockRejectedValue(new Error("db down"));
    const next = await run({ id: "u4", role: "owner", roles: ["owner"] });
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe("requireStaffSide", () => {
  async function runStaff(user: { id: string; role: string; roles?: string[] } | undefined) {
    const next = jest.fn();
    await requireStaffSide({ user, id: "req-1" } as any, {} as any, next);
    return next;
  }

  afterEach(() => findByAccount.mockReset());

  it("admits staff-type roles without a profile lookup, including service_advisor", async () => {
    for (const role of ["admin", "staff", "service_advisor"]) {
      expect(await runStaff({ id: "u", role, roles: [role] })).toHaveBeenCalledWith();
    }
    expect(findByAccount).not.toHaveBeenCalled();
  });

  it("admits the workspace owner: account role 'owner' but holding a staff profile", async () => {
    findByAccount.mockResolvedValue({ roleId: { slug: "tenant_admin" } });
    expect(await runStaff({ id: "u1", role: "owner", roles: ["owner"] })).toHaveBeenCalledWith();
  });

  it("refuses a customer with no staff profile", async () => {
    findByAccount.mockResolvedValue(null);
    const next = await runStaff({ id: "u2", role: "owner", roles: ["owner"] });
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ httpStatus: 403 }));
  });
});
