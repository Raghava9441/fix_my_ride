# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Multi-tenant vehicle service management SaaS API: Node.js + Express + TypeScript, MongoDB (Mongoose 8) for data, Redis for token revocation and a custom job queue. Strict TypeScript (`strict`, `noImplicitAny`, `strictNullChecks` all on).

This file is deliberately short and stays that way on purpose. Detailed, topic-specific guidance lives in `docs/` — read the relevant one(s) before working in that area rather than assuming this file has everything. The index below tells you which.

## Stack at a glance

- Node >= 18 (developed against Node 20), Express 4, TypeScript pinned to `^5.9.x` (see why below), Mongoose 8, `ioredis`, Zod for validation, Jest installed but not yet configured/used.
- Auth: JWT (access + refresh), `bcryptjs` for passwords, Redis-backed token revocation denylist.
- Logging: winston (not pino, despite `pino`/`pino-pretty` being listed dependencies — they're unused).
- No test suite exists yet. No response caching layer exists yet. See the relevant docs before assuming otherwise.

## Commands

```bash
npm run dev            # start with hot-reload (ts-node-dev)
npm run build           # tsc -> dist/
npm run typecheck       # tsc --noEmit (run this first when investigating errors)
npm run lint            # eslint src/**/*.ts (warnings don't fail CI, errors do)
npm run lint:fix
npm run format          # prettier --write
npm test                # jest — no config file and no test files exist yet, see docs/testing.md
npm run seed:dev        # seed dev DB with sample data (src/seeds/run.ts)
```

Docker/Compose usage and the GitHub Actions CI/CD pipeline: see [README.md](README.md) for quick-start commands, [docs/deployment.md](docs/deployment.md) for the full reference.

**Do not bump `typescript` past `^5.9.x`.** Full reasoning in [docs/typescript.md](docs/typescript.md) — short version: TS7 removes config this repo relies on (`moduleResolution: "node"`, `baseUrl`), and neither `ts-jest` nor the current `@typescript-eslint` major support TS7 yet, so `npm install` itself breaks on a peer-dependency conflict. This was tried and reverted once already.

## Request lifecycle, briefly

```
routes/*.routes.ts  →  controllers/*.controller.ts  →  services/*.service.ts  →  models/*.ts (Mongoose)
```

Route files use relative paths only (`/`, `/:id`) — the resource prefix (`/api/v1/owners`, etc.) is added exactly once, when `app.ts` mounts the router. There is no repository layer in practice, despite `src/repositories/`/`src/interfaces/` existing in the tree.

Two things happen transparently via request-scoped context (`AsyncLocalStorage`), without controllers/services passing anything explicitly: **multi-tenancy** (a Mongoose plugin auto-scopes every query to the resolved tenant) and part of **RBAC** (model methods like `staff.can()` read from the same context). Full detail: [docs/multi-tenancy.md](docs/multi-tenancy.md), [docs/rbac.md](docs/rbac.md). Neither is a route-level middleware gate — see those docs for exactly what is and isn't enforced automatically.

## Environment configuration

`src/config/schema.ts` (Zod) + `src/config/load.ts` validate all environment variables at startup and are the single source of truth — `loadEnv()` throws a descriptive error on anything missing/invalid rather than failing later at first use. Precedence: process env → `.env.<NODE_ENV>` → `.env` (local override). Real `.env.*` files are git-ignored; `.env.example` is the checked-in reference for what variables exist.

## Documentation index

| Doc | Read it for |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Layering, middleware order, what's live vs. scaffolding |
| [docs/folder-structure.md](docs/folder-structure.md) | Directory map, and the full list of dead/unwired code — **check this before assuming a folder is load-bearing** |
| [docs/coding-standards.md](docs/coding-standards.md) | Naming, structural conventions, accepted `any` usage, comment style |
| [docs/typescript.md](docs/typescript.md) | tsconfig, the TS-version constraint, strict-mode fallout patterns |
| [docs/mongoose.md](docs/mongoose.md) | **The statics/methods typing pattern every model must follow** — read before touching any model |
| [docs/data-model.html](docs/data-model.html) | Visual reference: every collection, its fields, and how they relate — open directly in a browser (self-contained, loads Mermaid from a CDN for the ER diagram) |
| `/api-docs` (running server) | Interactive OpenAPI 3.1 reference (Scalar UI) generated from `src/openapi/` — the spec is built directly from the same Zod DTOs in `src/dto/`, not hand-written, so it can't drift from what routes actually validate. Raw JSON at `/api-docs/openapi.json`. |
| [docs/database.md](docs/database.md) | Connection lifecycle, transactions, pagination, soft-delete/audit plugins |
| [docs/multi-tenancy.md](docs/multi-tenancy.md) | How tenant isolation is enforced — spans 3 files, not obvious from any one |
| [docs/rbac.md](docs/rbac.md) | Permission/Role/StaffProfile/OwnerProfile chain, and which parts are actually enforced vs. built-but-unused |
| [docs/validation.md](docs/validation.md) | Zod DTOs, `validate`/`validateQuery`/`validateParams`, `ValidatedRequest<T>` |
| [docs/api-standards.md](docs/api-standards.md) | Response envelope, versioning/mounting, status codes, pagination shape |
| [docs/error-handling.md](docs/error-handling.md) | `ERROR_CODES` catalog, `AppError.fromCode`, the global error handler |
| [docs/security.md](docs/security.md) | AuthN/AuthZ, sanitization, rate limiting, passwords, known gaps |
| [docs/queue.md](docs/queue.md) | The custom Redis job queue — what's actually wired up (just `emails`) vs. scaffolding |
| [docs/logging.md](docs/logging.md) | winston conventions, structured log fields |
| [docs/performance.md](docs/performance.md) | What's implemented vs. stubbed (`cache.middleware.ts` is an empty file) |
| [docs/testing.md](docs/testing.md) | Current state (none) and what to set up if you're adding the first tests |
| [docs/deployment.md](docs/deployment.md) | Dockerfile/Compose/CI-CD pipeline in depth |
| [docs/code-review.md](docs/code-review.md) | Project-specific review checklist, grounded in real bugs this codebase has shipped |
| [docs/prompts.md](docs/prompts.md) | Example prompts calibrated to this repo's conventions |

## The two things most worth internalizing before making changes

1. **This codebase has a meaningful amount of scaffolded-but-unwired code**: `src/repositories/`, `src/interfaces/`, `src/events/`, `src/subscribers/`, most of `src/jobs/`, `src/validators/`, empty `cache.middleware.ts`/`rateLimit.middleware.ts` stubs, and `middleware/authorization.middleware.ts`'s `requireRole`/`requirePermission` (fully implemented, mounted on zero routes). None of these are wrong to build on if a task explicitly calls for it — but don't assume any of them are already load-bearing just because the file exists. [docs/folder-structure.md](docs/folder-structure.md) has the complete list; the other docs flag it inline wherever it's relevant to that topic.

2. **Every Mongoose model with custom instance/static methods follows a typed-interface pattern** (`I<Model>` document interface + `I<Model>Model` statics interface, passed as `Schema<Doc, Model>`/`mongoose.model<Doc, Model>` generics) so TypeScript can see those methods from calling code. Skipping it doesn't error in the model file itself (an untyped schema's `this` is implicitly `any`), only at every call site elsewhere — this was the single largest source of TypeScript errors this codebase has accumulated historically, and reintroducing it silently breaks the build for someone else later. Full detail and a worked example: [docs/mongoose.md](docs/mongoose.md).
