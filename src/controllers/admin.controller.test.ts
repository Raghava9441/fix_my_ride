import { AdminController } from "./admin.controller";
import { durationToSeconds, isUserSuspended, markUserSuspended, clearUserSuspended } from "../utils/token";

const redis = {
  store: new Map<string, string>(),
  set: jest.fn(async (key: string, value: string) => void redis.store.set(key, value)),
  get: jest.fn(async (key: string) => redis.store.get(key) ?? null),
  del: jest.fn(async (key: string) => void redis.store.delete(key)),
};

jest.mock("../config/redis", () => ({
  getRedisClient: () => redis,
  cacheDelPattern: jest.fn().mockResolvedValue(undefined),
}));

import { cacheDelPattern } from "../config/redis";

const ADMIN_ID = "a".repeat(24);
const USER_ID = "b".repeat(24);
const OTHER_ADMIN_ID = "c".repeat(24);

function makeController(accounts: Record<string, any>) {
  const accountService = {
    findById: jest.fn(async (id: string) => accounts[id] ?? null),
    updateStatus: jest.fn(async (id: string, status: string) => ({ _id: id, status })),
  };
  const controller = new AdminController({} as any, {} as any, accountService as any, {} as any, jest.fn());
  return { controller, accountService };
}

function call(params: Record<string, string>, body: Record<string, unknown> = {}) {
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
  return { req: { params, body, query: {}, user: { id: ADMIN_ID } } as any, res };
}

beforeEach(() => {
  redis.store.clear();
  jest.clearAllMocks();
});

describe("AdminController.suspendUser", () => {
  it("suspends an ordinary user and marks them so live tokens stop working", async () => {
    const { controller, accountService } = makeController({ [USER_ID]: { _id: USER_ID, primaryRole: "staff", roles: ["staff"], status: "active" } });
    const { req, res } = call({ id: USER_ID }, { reason: "abuse" });
    await controller.suspendUser(req, res);

    expect(res.statusCode).toBe(200);
    expect(accountService.updateStatus).toHaveBeenCalledWith(USER_ID, "suspended", "abuse");
    expect(await isUserSuspended(redis, USER_ID)).toBe(true);
  });

  it("refuses to suspend yourself", async () => {
    const { controller, accountService } = makeController({});
    const { req, res } = call({ id: ADMIN_ID });
    await controller.suspendUser(req, res);
    expect(res.statusCode).toBe(403);
    expect(accountService.updateStatus).not.toHaveBeenCalled();
  });

  it("refuses to suspend another platform admin", async () => {
    const { controller, accountService } = makeController({
      [OTHER_ADMIN_ID]: { _id: OTHER_ADMIN_ID, primaryRole: "admin", roles: ["admin"], status: "active" },
    });
    const { req, res } = call({ id: OTHER_ADMIN_ID });
    await controller.suspendUser(req, res);
    expect(res.statusCode).toBe(403);
    expect(accountService.updateStatus).not.toHaveBeenCalled();
  });

  it("404s for an unknown user", async () => {
    const { controller } = makeController({});
    const { req, res } = call({ id: USER_ID });
    await controller.suspendUser(req, res);
    expect(res.statusCode).toBe(404);
  });
});

describe("AdminController.activateUser", () => {
  it("reactivates a suspended account and clears the marker", async () => {
    await markUserSuspended(redis, USER_ID, 60);
    const { controller } = makeController({ [USER_ID]: { _id: USER_ID, status: "suspended" } });
    const { req, res } = call({ id: USER_ID });
    await controller.activateUser(req, res);

    expect(res.statusCode).toBe(200);
    expect(await isUserSuspended(redis, USER_ID)).toBe(false);
  });

  it("will not activate an account that was never verified", async () => {
    const { controller, accountService } = makeController({ [USER_ID]: { _id: USER_ID, status: "pending_verification" } });
    const { req, res } = call({ id: USER_ID });
    await controller.activateUser(req, res);
    expect(res.statusCode).toBe(409);
    expect(accountService.updateStatus).not.toHaveBeenCalled();
  });

  it("will not resurrect a deleted account", async () => {
    const { controller } = makeController({ [USER_ID]: { _id: USER_ID, status: "deleted" } });
    const { req, res } = call({ id: USER_ID });
    await controller.activateUser(req, res);
    expect(res.statusCode).toBe(409);
  });
});

describe("AdminController.clearCache", () => {
  it("defaults to the response cache", async () => {
    const { controller } = makeController({});
    const { req, res } = call({});
    await controller.clearCache(req, res);
    expect(cacheDelPattern).toHaveBeenCalledWith("cache:*");
  });

  it("refuses a pattern outside the cache prefix, which would wipe revocation lists and queues", async () => {
    const { controller } = makeController({});
    const { req, res } = call({}, { pattern: "*" });
    await controller.clearCache(req, res);
    expect(res.statusCode).toBe(400);
    expect(cacheDelPattern).not.toHaveBeenCalled();
  });
});

describe("suspended-account marker", () => {
  it("clears", async () => {
    await markUserSuspended(redis, USER_ID, 60);
    await clearUserSuspended(redis, USER_ID);
    expect(await isUserSuspended(redis, USER_ID)).toBe(false);
  });

  it("parses token lifetimes", () => {
    expect(durationToSeconds("15m")).toBe(900);
    expect(durationToSeconds("24h")).toBe(86_400);
    expect(durationToSeconds("7d")).toBe(604_800);
    expect(durationToSeconds("3600")).toBe(3600);
    expect(durationToSeconds(120)).toBe(120);
    expect(durationToSeconds("soon")).toBe(86_400);
    expect(durationToSeconds(undefined)).toBe(86_400);
  });
});
