# Folder Structure

```
src/
├── app.ts                 Express app assembly: middleware order + route mounting (see architecture.md)
├── server.ts              Process entry point: connect DB/Redis, start workers, HTTP server, graceful shutdown
├── config/                Env schema/loading, DB, Redis, logger, CORS, rate-limit, queue, email, SMS, storage config
├── constants/              ERROR_CODES catalog (errors.ts) and other fixed enums/lookup tables
├── controllers/            Thin HTTP layer: parse req, call a service, shape the response. No business logic.
├── dto/                    Zod request/response schemas, one file per resource + index.ts barrel. See validation.md.
├── middleware/             Express middleware: auth, tenant isolation, validation, error handling, audit, sanitizer
│   └── tenant/             tenantPlugin.ts — the Mongoose plugin that enforces tenant scoping (see multi-tenancy.md)
├── models/                 Mongoose schemas + typed statics/methods interfaces. See mongoose.md.
├── routes/                 Express routers — relative paths only, mounted with a prefix in app.ts
├── seeds/                  DB seeding scripts (npm run seed:dev / seed:prod), see database.md
├── services/               Business logic; the only layer that talks to Mongoose models directly
├── types/                  Shared ambient/module type declarations
├── utils/                  Stateless helpers: apiResponse, appError, token, encryption, pagination, validators, etc.
├── validators/             Unused — superseded by utils/validators.ts + the Zod DTOs in dto/. See below.
├── scripts/                One-off CLI scripts (migrate, backup, monitor) run via ts-node, not part of the server process
├── workers/                Background worker bootstrap — only wires up the `emails` queue today
├── jobs/                   Job handlers; only email.job.ts is actually registered by workers/index.ts (see queue.md)
├── events/, subscribers/   Event emitter/handler/subscriber scaffolding — NOT wired into anything, dead code today
├── repositories/           Repository classes — NOT used by any service today, dead code
├── interfaces/             Repository/service interfaces — NOT implemented/used today, dead code
├── docs/                   DTO usage/reference markdown (kept from an earlier pass, see validation.md)
└── templates/              Email/SMS template assets (check whether the sending code actually reads these before assuming they're live — email.ts currently builds templates inline)
```

Top-level (repo root):

```
Dockerfile, .dockerignore, docker-compose.yml   Container build/run — see deployment.md
.github/workflows/ci-cd.yml                     CI/CD pipeline — see deployment.md
.env.example                                    Reference for all environment variables (real .env.* files are git-ignored)
tsconfig.json, .eslintrc.json                   See typescript.md, coding-standards.md
```

## Dead / unwired code — read before extending

Several directories exist in the tree but nothing imports them at runtime. Don't assume they're "the pattern" just because they're present:

| Path | Status |
|---|---|
| `src/repositories/`, `src/interfaces/repositories/` | Unused — services call Mongoose models directly, no repository layer in practice |
| `src/interfaces/services/` | Unused |
| `src/events/emitters/`, `src/events/handlers/`, `src/subscribers/` | Unused — no event bus is wired up |
| `src/jobs/cleanup.job.ts`, `invoice.job.ts`, `notification.job.ts`, `reminder.job.ts`, `report.job.ts` | Unused — only `email.job.ts` is registered by `workers/index.ts` |
| `src/middleware/cache.middleware.ts`, `src/middleware/rateLimit.middleware.ts` | Empty stub files (0 bytes) |
| `src/validators/` | Unused — request validation actually happens via the Zod schemas in `src/dto/` |
| `src/middleware/authorization.middleware.ts` (`requireRole`/`requirePermission`/`requireTenant`) | Fully implemented but not mounted on any route — see [rbac.md](rbac.md) |

If a task calls for wiring one of these up for real, that's a legitimate thing to do — just don't assume it's already load-bearing.
