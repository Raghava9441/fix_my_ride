# Example Prompts for This Repo

This project has no AI/LLM feature of its own — this doc is guidance for *prompting Claude Code* effectively when working on it, given the conventions documented elsewhere in `docs/`. Good prompts here point at the right doc/pattern up front instead of leaving Claude to rediscover it.

## Adding a new resource end-to-end

> Add a `Reminder` API: DTO in `dto/reminder.dto.ts` (reuse `IdParamSchema`/`PaginationSchema` from `common.dto.ts`), a Mongoose model following the statics/methods interface pattern in `docs/mongoose.md`, apply `tenantPlugin` since reminders belong to a single tenant, a service, a thin controller, and a route file using relative paths only — then wire the route into `app.ts` with the `/api/v1/reminders` prefix.

Why this works: it names the exact files/patterns instead of "add CRUD for reminders," which is what actually keeps a fresh Claude session from re-deriving (or worse, silently diverging from) the DTO-reuse and Mongoose-typing conventions in `docs/validation.md`/`docs/mongoose.md`.

## Fixing a build/lint/type error

> `npm run build` is failing with [paste exact error]. Check `docs/typescript.md` for known TS-version constraints before changing `tsconfig.json` — don't bump `typescript` past 5.9.x as a fix.

Why: this repo already hit a real incident where bumping TypeScript to 7.x broke the build in a way that looked like isolated config errors but was actually a toolchain-wide incompatibility (`ts-jest`, `@typescript-eslint`). Pointing at that history up front avoids re-treading it.

## Adding/enforcing a permission check

> Add a check to `[endpoint]` so only the owning staff member's service center can access it. Use the model-level `.can()`/`.canAccessResource()` pattern from `docs/rbac.md`, not `requireRole`/`requirePermission` from `authorization.middleware.ts` — that middleware exists but isn't wired into any route today, so don't assume it's already gating this endpoint.

## Wiring up currently-dead scaffolding

> I want `invoice.job.ts` actually running. Check `docs/queue.md` for how `workers/index.ts` bootstraps the `emails` queue today and mirror that for a new `invoices` queue, then call `addJob("invoices", ...)` from `payment.service.ts` where a payment completes.

Being explicit that this is "make dead code live" (rather than "fix the existing wiring") matters — Claude shouldn't go looking for existing invoice-queue plumbing that doesn't exist, per `docs/folder-structure.md`'s dead-code list.

## Investigating a data-isolation bug

> Tenant A is seeing Tenant B's [resource]. Walk the multi-tenancy chain in `docs/multi-tenancy.md` — check whether the model applies `tenantPlugin`, whether it's in the shared-collections list by mistake, and whether the request actually resolved a `tenantId` in `tenantIsolation` before the query ran.

## General shape that works well here

1. Name the relevant `docs/*.md` file(s) if you know which apply — it's faster than Claude inferring which convention doc is relevant from scratch.
2. State whether the task is "extend an existing live pattern" vs. "build/wire up something new" — this codebase has enough half-wired scaffolding (see `docs/folder-structure.md`) that the distinction changes the right approach.
3. If the task touches models, mention whether tenant-scoping/RBAC apply — those aren't visually obvious from a schema alone.
