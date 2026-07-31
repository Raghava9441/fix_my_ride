# Database

MongoDB via Mongoose 8. Connection lifecycle, pooling, and a handful of shared data-access helpers live in `src/config/database.ts` — read that file directly when in doubt, it's short and everything below is a summary of it.

## Connection

`connectDatabase()`:
- No-ops (reuses the existing connection) if already connected — safe to call more than once.
- Requires `config.db.uri` (from `MONGODB_URI`); throws immediately if missing rather than attempting a connection.
- Builds connect options from `buildConnectionOptions()`: pool size, timeouts, `retryWrites`/`retryReads`, `compressors: ['zstd','snappy','zlib']`, and — only when `config.isProduction` — `ssl`/`tls` with certificate validation on.
- Registers connection event listeners exactly once (`setupMongooseEvents`, guarded by `state.eventsRegistered`): logs connect/error/disconnect/reconnect, and on unexpected disconnect (outside `NODE_ENV=test`) schedules a reconnect via `scheduleReconnect()` (bounded retries: `MAX_RECONNECT_ATTEMPTS = 5`, `RECONNECT_INTERVAL_MS = 5000`).
- In production, runs `mongoose.syncIndexes({ background: true })` after connecting.
- Verbose query logging (`mongoose.set('debug', ...)`) is enabled automatically in development or when `DEBUG_MONGOOSE=true`.

`disconnectDatabase()` / `checkDatabaseHealth()` / `setupGracefulShutdown(server)` (hooks `SIGTERM`/`SIGINT`/`SIGUSR2`, closes the HTTP server then the DB connection) round out the lifecycle, called from `server.ts`. Note: `checkDatabaseHealth()` is currently imported in `server.ts` but never actually invoked — the live `/health`/`/ready` routes do their own inline `mongoose.connection.db?.admin().ping()` in `services/health.service.ts` instead. Prefer consolidating onto one or the other if you touch this area rather than adding a third health-check implementation.

## Transactions

```ts
import { withTransaction } from "../config/database";

await withTransaction(async (session) => {
  await SomeModel.create([data], { session });
  await OtherModel.findOneAndUpdate(filter, update, { session });
});
```

Every Mongoose call inside the callback **must** be passed `{ session }` explicitly — Mongoose doesn't propagate it implicitly.

## Pagination

`paginate(model, query, { page, limit, sort, populate, select, lean })` runs a `find` + `countDocuments` in parallel and returns `{ data, pagination: { page, limit, total, totalPages, hasNext, hasPrevious } }`. This is the low-level helper `config/database.ts` exposes; most services instead build the same shape by hand alongside `utils/pagination.ts`'s helpers — either is acceptable, don't introduce a third pagination shape.

## Shared schema plugins

- **`softDeletePlugin(schema, { deletedByRef })`** — adds `isDeleted`/`deletedAt`/`deletedBy`, auto-excludes soft-deleted docs from `find`/`findOne`/`findOneAndUpdate`/`countDocuments` (unless the query already filters on `isDeleted` itself), and adds `.softDelete(deletedBy?)`/`.restore()` instance methods.
- **`auditPlugin(schema)`** — adds `createdBy`/`updatedBy`, populated from `doc._createdBy`/`doc._updatedBy` (set via `.setCreatedBy(userId)`/`.setUpdatedBy(userId)` before `.save()`).
- **`tenantPlugin`** (`middleware/tenant/tenantPlugin.ts`) is the multi-tenancy plugin — documented separately in [multi-tenancy.md](multi-tenancy.md) since it's substantial enough to warrant its own doc.

Not every model applies all three — check the bottom of a given model file for its `schema.plugin(...)` calls before assuming a behavior (e.g. soft-delete) applies.

## Bulk writes

`bulkUpsert(model, data, matchFields = ['_id'])` builds an ordered-false `bulkWrite` of `updateOne` upserts, matching on whichever fields you pass (falls back to `_id`). Used by seed scripts; reach for it over a hand-rolled loop of individual `findOneAndUpdate` calls when upserting many documents at once.

## Model conventions

See [mongoose.md](mongoose.md) for the statics/methods TypeScript typing pattern every model follows, and [rbac.md](rbac.md)/[multi-tenancy.md](multi-tenancy.md) for the domain-specific plugins layered on top of the base ones described here.
