# Multi-Tenancy

Tenant isolation is enforced at the **data access layer**, not in controllers — the goal is that a controller/service can just write a normal Mongoose query and get tenant-scoped results "for free," rather than every query author having to remember to add `{ tenantId }` by hand.

## The three pieces

1. **`middleware/requestContext.middleware.ts`** opens an `AsyncLocalStorage<Map<string, any>>` for the lifetime of the request (`asyncLocalStorage.run(req.context, () => next())`), and seeds that map with `tenantId`/`userRoles` up front (from `req.user`, set earlier by auth middleware, if present).
2. **`middleware/tenant.middleware.ts`** (`tenantIsolation`) runs next and does the actual tenant *resolution*, in priority order: (1) the authenticated user's `tenantId` from their JWT, (2) a trusted `x-tenant-id` header, (3) — development only — a `?tenantId=` query param. It writes the resolved value into the same context (`req.context.set("tenantId", ...)`) and mirrors it onto `req.tenantId` / an `X-Tenant-ID` response header. Requests under `PUBLIC_PREFIXES` (`/health`, `/ready`, `/live`, `/api/v1/public`, `/api/v1/webhooks`) skip resolution entirely. Admin users are marked (`userRoles = ["admin"]`) rather than tenant-scoped.
3. **`middleware/tenant/tenantPlugin.ts`** is a Mongoose schema plugin applied per-model (`schema.plugin(tenantPlugin)`) that reads the *same* AsyncLocalStorage context — via `getRequestContext()` from `requestContext.middleware.ts` — from inside Mongoose query/document hooks, completely decoupled from Express. This is what actually rewrites queries.

## What the plugin does, precisely

For a model with `tenantPlugin` applied:
- Adds a `tenantId` field to the schema automatically if the model doesn't already declare one.
- Hooks `pre()` on `find`, `findOne`, `findOneAndUpdate`, `findOneAndDelete`, `countDocuments`, `updateMany`, `deleteMany`, `distinct`: if the current context resolves a `tenantId` and the query doesn't already filter on it, injects `this.where({ tenantId: new ObjectId(tenantId) })`.
- Hooks `pre("aggregate")`: unshifts a `{ $match: { tenantId } }` stage onto the pipeline, unless one's already present.
- Hooks `pre("save")` and `pre("insertMany")`: stamps `tenantId` onto new documents from context if not already set.

**Bypass conditions** (query runs unscoped):
- The requester is an admin (`userRoles` includes `"admin"`).
- There's no AsyncLocalStorage context at all (`hasContext` false) — this is the expected case for background jobs/seed scripts/CLI scripts run outside an HTTP request, which is why seeds and workers don't need to fight the plugin.
- The model's collection name is in the shared set: `vehicles`, `owners`, `ownerprofiles`, `tenants` (hardcoded `DEFAULT_SHARED`) plus anything passed via `tenantPlugin(schema, { sharedCollections: [...] })`.

**Fail-closed behavior:** if there *is* a request context but no `tenantId` could be resolved for a scoped model, the plugin injects `{ tenantId: { $eq: null } }` — a filter that matches nothing — and logs a `tenant_isolation_blocked` warning, rather than falling through to an unscoped (cross-tenant) query.

## Practical implications

- **A model only gets this behavior if it explicitly applies `schema.plugin(tenantPlugin)` at the bottom of its file.** Check for that line before assuming a model is tenant-scoped — having a `tenantId` field in the schema is not sufficient by itself.
- Because scoping happens via AsyncLocalStorage, it works across `await` boundaries inside a request automatically — you don't need to thread `tenantId` through function parameters for Mongoose calls to stay scoped. You still need to thread it explicitly for anything that *isn't* a Mongoose query (e.g. constructing a response, calling an external API).
- Cross-tenant access checks that aren't a plain "does this belong to my tenant" (e.g. "is this vehicle authorized for my service center even though vehicles are a shared collection") are handled separately — see `validateCrossTenantAccess()` in `middleware/tenant.middleware.ts`, used explicitly where that specific check applies (vehicles are intentionally a shared collection since a vehicle can be authorized across multiple service centers/tenants).
- Seed scripts and one-off `src/scripts/*` CLI tools run with no request context, so they're implicitly unscoped — that's expected, not a bug, but means they must construct/filter by `tenantId` explicitly wherever tenant separation actually matters for that script's purpose.
