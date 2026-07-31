# Coding Standards

## Naming

- Models: PascalCase file + export (`models/StaffProfile.ts` exports `StaffProfile`), interfaces prefixed `I` (`IStaffProfile`, `IStaffProfileModel` — see [mongoose.md](mongoose.md)).
- Services/controllers: camelCase file with a `.service.ts`/`.controller.ts` suffix, class-based (`export class VehicleService { ... }`), with a lowercase singleton instance exported alongside it (`export const vehicleService = new VehicleService();`) — services are consumed as that singleton, not re-instantiated per request.
- DTOs: `PascalCaseSchema` for the Zod schema, `PascalCaseDTO` for the inferred type (`CreateAccountSchema` / `CreateAccountDTO`).
- Error codes: `SCREAMING_SNAKE_CASE` keys into `ERROR_CODES`, namespaced code strings (`AUTH_001`, `VAL_002`) — see [error-handling.md](error-handling.md).

## Structural rules (established by convention, follow them)

- **Routes stay path-relative.** A route file must not hardcode its resource prefix (`/owners/:id`) — the prefix is added once when `app.ts` mounts the router (`app.use("/api/v1/owners", ownerRoutes)`). Mixing the two produces duplicated path segments.
- **Controllers don't touch Mongoose.** If a controller needs `mongoose.Types.ObjectId` or a model import, that logic belongs in the service.
- **No repository layer.** Services call models directly. Don't route new features through `src/repositories/`/`src/interfaces/` — they're unused scaffolding (see [folder-structure.md](folder-structure.md)).
- **Don't add a second definition of something that already exists.** This codebase has had real duplicate-definition bugs (two `IdParamSchema`s, two `verifyHmac`s, a stray copy of the DTO barrel in the wrong folder, a `models/index.ts` that redefined its own `connectDatabase`). Before adding a schema/util/constant, check `dto/`, `utils/`, and `constants/` for an existing one first.

## Error handling

Throw `AppError.fromCode("SOME_CODE", { correlationId, message?, details? })` rather than `throw new Error(...)` or `res.status(x).json(...)` inline — see [error-handling.md](error-handling.md). Add a new `ERROR_CODES` entry before introducing a new failure mode; don't invent ad hoc status/message pairs at the call site.

## `any` usage

`strict`/`noImplicitAny` are on (see [typescript.md](typescript.md)), but this codebase pragmatically accepts `any` in a few specific, narrow situations rather than fighting Mongoose's generics further than necessary:
- Casting a populated ref field to its resolved shape (`this.roleId as unknown as { hasPermission(...): ... }`) after `await this.populate(...)`.
- Loosely-typed pass-through options objects on model statics where the exact shape isn't load-bearing for correctness (e.g. query option bags).

Don't reach for `any` to silence an error you haven't understood — the acceptable cases above are deliberate escapes documented in [mongoose.md](mongoose.md), not a general license.

## Comments

Default to no comments. Section-banner comments (`// ─── Foo ───`) are used in a few larger files (`config/database.ts`, `models/*.ts`) to group related statics/methods/indexes — match that style if you're extending one of those files, don't introduce a different comment convention within the same file.

## What not to add

- Don't add a fallback/try-catch for a condition that can't occur — trust Mongoose/Express/framework guarantees.
- Don't add a new abstraction (base class, generic helper) for a single use site "for later." Three near-identical inline blocks are fine; a premature abstraction that only one thing calls is not.
- Don't reintroduce the dead subsystems (`events/`, `subscribers/`, extra `jobs/*`) as if they were live — either wire them up for real as part of the task, or don't touch them.
