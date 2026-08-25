import express, { Request, Response, NextFunction } from "express";
import request from "supertest";
import { cacheResponse } from "./cache.middleware";

let handlerCalls = 0;

function buildTestApp(tenantId: string | undefined, role: string | undefined) {
  handlerCalls = 0;
  const app = express();

  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.tenantId = tenantId;
    (req as any).user = role ? { role } : undefined;
    next();
  });

  app.get("/items", cacheResponse({ ttlSeconds: 60 }), (req: Request, res: Response) => {
    handlerCalls += 1;
    res.json({ handlerCalls, query: req.query });
  });

  app.get("/public-items", cacheResponse({ ttlSeconds: 60, varyByAuth: false }), (req, res) => {
    handlerCalls += 1;
    res.json({ handlerCalls });
  });

  app.post("/items", cacheResponse({ ttlSeconds: 60 }), (req: Request, res: Response) => {
    handlerCalls += 1;
    res.json({ handlerCalls });
  });

  return app;
}

describe("cacheResponse middleware", () => {
  it("MISSes on the first request and HITs on an identical second request", async () => {
    const app = buildTestApp("tenant-a", "owner");

    const first = await request(app).get("/items");
    expect(first.headers["x-cache"]).toBe("MISS");
    expect(first.body.handlerCalls).toBe(1);

    const second = await request(app).get("/items");
    expect(second.headers["x-cache"]).toBe("HIT");
    expect(second.body).toEqual(first.body); // cached body, not re-computed
    expect(handlerCalls).toBe(1); // handler wasn't invoked again
  });

  it("treats different query params as different cache entries", async () => {
    const app = buildTestApp("tenant-a", "owner");

    await request(app).get("/items?page=1");
    const res = await request(app).get("/items?page=2");

    expect(res.headers["x-cache"]).toBe("MISS");
    expect(handlerCalls).toBe(2);
  });

  it("sorts query params so key order doesn't fragment the cache", async () => {
    const app = buildTestApp("tenant-a", "owner");

    await request(app).get("/items?a=1&b=2");
    const res = await request(app).get("/items?b=2&a=1");

    expect(res.headers["x-cache"]).toBe("HIT");
    expect(handlerCalls).toBe(1);
  });

  it("isolates cache entries by tenant", async () => {
    const appA = buildTestApp("tenant-a", "owner");
    await request(appA).get("/items");

    const appB = buildTestApp("tenant-b", "owner");
    const res = await request(appB).get("/items");

    // Different Express apps share the same process-level in-memory Redis
    // fallback (config/redis.ts's module-level singleton) — this exercises
    // real tenant-scoped key isolation, not per-app state.
    expect(res.headers["x-cache"]).toBe("MISS");
  });

  it("varyByAuth:false serves the same cache entry regardless of tenant/role", async () => {
    const appA = buildTestApp("tenant-a", "owner");
    const first = await request(appA).get("/public-items");
    expect(first.headers["x-cache"]).toBe("MISS");

    const appB = buildTestApp("tenant-b", "staff");
    const second = await request(appB).get("/public-items");
    expect(second.headers["x-cache"]).toBe("HIT");
  });

  it("never caches non-GET requests", async () => {
    const app = buildTestApp("tenant-a", "owner");

    await request(app).post("/items");
    const res = await request(app).post("/items");

    expect(res.headers["x-cache"]).toBeUndefined();
    expect(handlerCalls).toBe(2);
  });
});
