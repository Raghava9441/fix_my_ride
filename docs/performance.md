# Performance

## What's actually in place

- **Compression** — `compression` middleware in `app.ts`, level 6, only kicks in above a 100KB response threshold, skippable per-request via an `x-no-compression` header (useful for debugging raw payloads).
- **Connection pooling** — Mongo pool size configured via `MONGODB_MAX_POOL_SIZE`/`MONGODB_MIN_POOL_SIZE` (default 10/2), see [database.md](database.md). Redis is a single `ioredis` client (`config/redis.ts`), not pooled.
- **Pagination everywhere list endpoints exist** — services return paginated results (`{ data, pagination }`) rather than unbounded arrays; see [api-standards.md](api-standards.md)/[database.md](database.md). When adding a new list endpoint, paginate it from the start rather than retrofitting later.
- **Indexes** — defined per-model, generally covering the tenant-scoping field plus whatever the model is most commonly queried/sorted by (e.g. `Notification`'s compound indexes on `recipientId + status + createdAt`, TTL indexes on `expiresAt` for auto-expiring documents like `Invitation`/`Notification`/`Document`). If you add a new frequent query shape to a model, add a matching index in the same change rather than as a follow-up.

## What's *not* in place (don't assume otherwise)

- **`middleware/cache.middleware.ts` is an empty file (0 bytes).** There is no response/query caching layer today. Redis is used for token revocation and the job queue only (see [queue.md](queue.md), [security.md](security.md)) — not as a cache.
- **`middleware/rateLimit.middleware.ts` is also an empty stub.** Rate limiting is real, but lives entirely in `config/rate-limit.ts` + a direct `express-rate-limit(...)` call in `app.ts` — see [security.md](security.md).
- No background pre-warming, CDN, or read-replica routing exists. `readPreference: "primaryPreferred"` is set on the Mongo connection (`config/database.ts`), which is as close as it gets today.

If a task calls for adding caching, it needs to be built from scratch (Redis is already connected and available via `config/redis.ts`'s `getRedisClient()`) — there's no partial implementation to extend.

## Aggregate/bulk operations

Prefer `bulkUpsert()` (`config/database.ts`) over a loop of individual `findOneAndUpdate` calls when writing many documents at once (seed scripts do this). For read-heavy aggregations, remember the multi-tenancy plugin auto-injects a `$match` at the start of `aggregate()` pipelines when a tenant is in context — see [multi-tenancy.md](multi-tenancy.md) — so you generally don't need to add tenant filtering to your own pipeline by hand.
