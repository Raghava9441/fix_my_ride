# Architecture

## Stack

Node.js + Express + TypeScript (strict mode), MongoDB via Mongoose 8, Redis via `ioredis` (token revocation + a custom job queue, not a session store). See [folder-structure.md](folder-structure.md) for the directory map.

## Layering

```
routes/*.routes.ts  →  controllers/*.controller.ts  →  services/*.service.ts  →  models/*.ts (Mongoose)
```

- **Routes** wire an HTTP method + path to `validate()`/`validateParams()`/`validateQuery()` middleware (see [validation.md](validation.md)) and a controller method. Paths are relative (`/`, `/:id`) — the resource prefix (`/api/v1/owners`, etc.) is added exactly once, in `app.ts`, when the router is mounted. A route file should never hardcode its own prefix.
- **Controllers** are thin: pull data off `req` (params/query/`req.validated`), call one service method, shape an `ApiResponse` (see [api-standards.md](api-standards.md)), send it. No business logic, no direct model access.
- **Services** hold business logic and are the only layer allowed to import and call Mongoose models directly.
- **Models** are Mongoose schemas. There is no repository/data-access-object layer in practice — `src/repositories/` and `src/interfaces/` exist but are unused; don't route new code through them.

## Cross-cutting middleware (order matters)

`app.ts` assembles, in order: request ID → morgan/structured request logging → helmet/CORS/rate-limit → body parsing → compression → `express-mongo-sanitize`/`hpp`/XSS sanitizer → `requestContext` (opens the AsyncLocalStorage store) → `tenantIsolation` (resolves + stores the tenant) → `auditLogger` (mounted only on `/api/v1/admin`, `/api/v1/auth/change-password`, `/api/v1/accounts/*/status`) → versioned API routes → static `/uploads` → 404 handler → global error handler.

Two subsystems read from that per-request context transparently, without controllers/services having to pass anything explicitly:
- **Multi-tenancy** — see [multi-tenancy.md](multi-tenancy.md). Enforced at the Mongoose layer via a schema plugin, not in controllers.
- **RBAC** — see [rbac.md](rbac.md). Enforced via `can()`/`hasPermission()` methods on the profile/role models, called explicitly from services/controllers (not a middleware gate today — check individual routes for how they invoke it).

## Cross-cutting concerns with their own doc

- [error-handling.md](error-handling.md) — the `ERROR_CODES` catalog + `AppError`
- [database.md](database.md) — connection setup, transactions, pagination, soft-delete/audit plugins
- [mongoose.md](mongoose.md) — the statics/methods typing pattern every model follows
- [queue.md](queue.md) — the custom Redis-backed job queue and what's actually wired up
- [logging.md](logging.md), [security.md](security.md), [performance.md](performance.md)

## Known gaps (don't assume otherwise)

- No tests exist yet and there's no Jest config — see [testing.md](testing.md).
- Several folders (`events/`, `subscribers/`, most of `jobs/`, `repositories/`, `interfaces/`, `validators/`) are scaffolding that nothing imports — see [folder-structure.md](folder-structure.md) for the full list.
- **`middleware/authorization.middleware.ts` (`requireRole`, `requirePermission`, `requireTenant`) is fully implemented but not mounted on a single route.** The only live permission enforcement today is the ad hoc `staff.can()` / `owner.can()` model-method calls made explicitly inside individual services/controllers (see [rbac.md](rbac.md)). Don't assume a route is permission-gated just because it looks sensitive — check whether the controller/service actually calls `.can()`, and consider whether wiring `requirePermission()` in would be the more correct fix.
