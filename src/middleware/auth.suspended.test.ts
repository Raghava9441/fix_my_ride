import { authenticate } from "./auth.middleware";
import { generateToken } from "../utils/token";

const store = new Map<string, string>();
const redis = {
  get: jest.fn(async (key: string) => store.get(key) ?? null),
};

jest.mock("../config/redis", () => ({ getRedisClient: () => redis }));

function tokenFor(userId: string) {
  return generateToken({ userId, email: "u@x.com", role: "staff", roles: ["staff"], jti: `jti-${userId}` }, process.env.JWT_SECRET!);
}

async function run(userId: string) {
  const req: any = { headers: { authorization: `Bearer ${tokenFor(userId)}` }, id: "req-1" };
  const next = jest.fn();
  await authenticate(req, {} as any, next);
  return { req, next };
}

describe("authenticate - suspended accounts", () => {
  beforeEach(() => store.clear());

  it("lets a normal account through", async () => {
    const { req, next } = await run("u1");
    expect(next).toHaveBeenCalledWith();
    expect(req.user.id).toBe("u1");
  });

  it("refuses a valid, unexpired token once the account has been suspended", async () => {
    store.set("auth:suspended:u2", "1");
    const { next } = await run("u2");
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ httpStatus: 403 }));
  });

  it("only affects the suspended account", async () => {
    store.set("auth:suspended:u2", "1");
    const { next } = await run("u3");
    expect(next).toHaveBeenCalledWith();
  });
});
