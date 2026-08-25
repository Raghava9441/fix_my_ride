import { Request, Response, NextFunction } from "express";
import { cacheGet, cacheSet } from "../config/redis";
import { logger } from "../config/logger";

export interface CacheOptions {
  /** Default 60s. Keep short — see the file-level comment on why TTL expiry
   * is the invalidation strategy here rather than write-triggered busting. */
  ttlSeconds?: number;
  /** Include the caller's tenant/role in the cache key (default true) — set
   * false only for genuinely public, identical-for-every-caller responses
   * (e.g. a public pricing page), where varying by tenant would just
   * fragment the cache for no benefit. */
  varyByAuth?: boolean;
  keyPrefix?: string;
}

const DEFAULT_TTL_SECONDS = 60;

function buildCacheKey(req: Request, options: CacheOptions): string {
  const prefix = options.keyPrefix ?? "cache";
  const scope =
    options.varyByAuth === false
      ? "public"
      : `${req.tenantId ?? "no-tenant"}:${req.user?.role ?? "anonymous"}`;

  const queryEntries = Object.entries(req.query as Record<string, unknown>);
  const query = queryEntries.length
    ? `?${queryEntries
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join("&")}`
    : "";

  return `${prefix}:${scope}:${req.path}${query}`;
}

/**
 * Caches successful (2xx) JSON GET responses in Redis (config/redis.ts's
 * cacheGet/cacheSet — already used elsewhere for token revocation/the job
 * queue, just never for HTTP responses until now). Nothing currently writes
 * cache entries anywhere in this codebase, so there's no existing
 * invalidation to hook into; rather than wire explicit cache-busting into
 * every mutating controller across the app (a much larger, more
 * error-prone change than this middleware calls for), staleness is bounded
 * by a short TTL instead. adminController.clearCache()'s cacheDelPattern()
 * (mounted at POST /api/v1/admin/maintenance/clear-cache) is the manual
 * escape hatch for "I need this gone right now" — pattern `cache:*` clears
 * everything this middleware wrote.
 *
 * Only apply this to read-heavy, non-sensitive, rarely-personalized GET
 * routes — it is not a general-purpose response cache for every endpoint.
 */
export function cacheResponse(options: CacheOptions = {}) {
  const ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.method !== "GET") {
      next();
      return;
    }

    const key = buildCacheKey(req, options);

    try {
      const cached = await cacheGet(key);
      if (cached) {
        res.setHeader("X-Cache", "HIT");
        res.type("application/json").send(cached);
        return;
      }
    } catch (err) {
      logger.warn({ type: "cache_read_failed", key, error: (err as Error).message });
    }

    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        void cacheSet(key, JSON.stringify(body), ttlSeconds).catch((err) =>
          logger.warn({ type: "cache_write_failed", key, error: (err as Error).message }),
        );
      }
      res.setHeader("X-Cache", "MISS");
      return originalJson(body);
    }) as Response["json"];

    next();
  };
}
