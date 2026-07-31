# Code Review Checklist

Project-specific things to check that a generic review wouldn't catch — grounded in real bugs found and fixed in this codebase's history. Use alongside (not instead of) normal correctness/security review.

## Structural

- [ ] **New route files use relative paths only** (`/`, `/:id`), no hardcoded resource prefix — the prefix belongs solely in the `app.use("/api/v1/x", xRoutes)` call in `app.ts`. Mounting a route file whose internal paths *also* repeat the prefix produces a silently-duplicated path (`/api/v1/owners/owners/:id`).
- [ ] **New route wiring is actually added to `app.ts`.** A route file that exists but isn't `app.use()`'d is dead on arrival — this has happened before (e.g. permission/role routes existing but not mounted).
- [ ] **Controllers don't import Mongoose models directly.** If you see `import { SomeModel } from "../models/..."` in a `*.controller.ts`, that logic belongs in a service.
- [ ] **No new repository/interface-layer code** unless the task is explicitly "add a repository layer" — `src/repositories/`/`src/interfaces/` are unused; adding to them without wiring them into services just grows dead code (see [folder-structure.md](folder-structure.md)).
- [ ] **No duplicate definitions.** Before adding a schema/DTO/constant/util, check whether an equivalent already exists (`dto/common.dto.ts`, `utils/`, `constants/errors.ts`). This codebase has shipped real bugs from parallel definitions of the same thing (two `IdParamSchema`s, two `verifyHmac`s, a stray copy of the DTO barrel, a `models/index.ts` re-implementing `connectDatabase`).

## Mongoose models

- [ ] **Every custom `schema.methods.x`/`schema.statics.x` has a corresponding entry in the model's `I<Model>`/`I<Model>Model` interfaces**, and the schema/model are constructed with those generics (`Schema<IDoc, IModel>`, `mongoose.model<IDoc, IModel>(...)`). See [mongoose.md](mongoose.md). Without this, the method compiles fine inside the model file but breaks every caller.
- [ ] **`this` is explicitly annotated** on method/static function expressions (`function (this: IDoc, ...) {}`) rather than left implicit.
- [ ] **New tenant-scoped models apply `tenantPlugin`** (`schema.plugin(tenantPlugin)`) unless there's a specific reason the collection should be shared across tenants (and if so, that reason should be a code comment, plus the collection added to `sharedCollections`/`DEFAULT_SHARED` rather than just skipping the plugin silently).
- [ ] **Async methods stay `async`.** A method that awaits something internally but is declared as a plain (non-async) function and `return`s the promise as if it were the resolved value is a real bug class here — a caller checking the return value in a boolean context gets a truthy `Promise` object regardless of what it resolves to. (This exact bug existed in `OwnerProfile.can()`.)

## Validation / errors

- [ ] **New failure modes get an `ERROR_CODES` entry** (`constants/errors.ts`) before being thrown, rather than an inline `throw new Error(...)` or ad hoc status code — see [error-handling.md](error-handling.md).
- [ ] **`validate()`/`validateQuery()`/`validateParams()` are passed a `ZodSchema`**, not a plain object of per-field schemas — wrap multi-field param validation in `z.object({...})`.
- [ ] **Controllers reading `req.validated` type the request as `ValidatedRequest<T>`**, not plain `Request`.

## Dependencies

- [ ] **Before adding a package, check whether it ships CommonJS** (its `package.json` `exports`/`main` should have a `require` path) — this repo is CJS (`module: CommonJS` in `tsconfig.json`, no `"type": "module"`), and a pure-ESM package will crash at runtime on `require()`, not just fail to type-check. (`uuid@13` did exactly this; replaced with `crypto.randomUUID()`.)
- [ ] **`package-lock.json` stays committed** — don't let it slip back into `.gitignore`.
- [ ] **Don't bump `typescript` past `^5.9.x`** without checking `ts-jest`/`@typescript-eslint` support first (see [typescript.md](typescript.md)).

## Multi-tenancy / RBAC

- [ ] **A query on a tenant-scoped model doesn't need manual `tenantId` filtering** — the plugin does it from request context. Adding one by hand isn't wrong, but check whether it's actually necessary (e.g. inside a seed script or CLI tool, which run with no request context, it usually *is* necessary).
- [ ] **Sensitive actions call a permission check explicitly** (`staff.can(...)` / `owner.can(...)`) — there's no route-level `requirePermission()` gate applied automatically today. Don't assume an endpoint is protected just because it looks like it should be — verify the call is actually there. See [rbac.md](rbac.md).
