# Validation (DTOs)

Request validation is Zod-based, living in `src/dto/*.dto.ts` — one file per resource (`account.dto.ts`, `vehicle.dto.ts`, `tenant.dto.ts`, etc.), barreled through `src/dto/index.ts`. Deeper usage examples/reference already exist in `src/docs/DTO_USAGE.md`, `DTO_REFERENCE.md`, `DTO_EXAMPLES.md` — this file summarizes the parts most relevant to writing new code.

There is a second, unused `src/dtos/` (plural) tree from an earlier pass — deleted as dead code; if you ever see a reference to it again, that's a regression, not something to resurrect.

## Applying validation in a route

`middleware/validation.middleware.ts` exports three factories, each taking **one** `ZodSchema` (not a plain object of per-field schemas):

```ts
router.post("/", validate(CreateAccountSchema), controller.create);
router.get("/", validateQuery(PaginationSchema), controller.getAll);
router.delete(
  "/:id/roles/:roleId",
  validateParams(z.object({ id: IdParamSchema.shape.id, roleId: IdParamSchema.shape.id })),
  controller.removeRole,
);
```

- `validate(schema)` → validates `req.body`
- `validateQuery(schema)` → validates `req.query`
- `validateParams(schema)` → validates `req.params`

Passing a bare object literal of field schemas instead of a `z.object({...})` wrapper is a type error (`ZodSchema` expected) — wrap it, as in the third example above.

On success, the parsed/coerced value is attached to `req.validated`, **not** merged back onto `req.body`/`req.query`/`req.params`. On failure, `sendValidationError` responds with the standard error envelope (see [error-handling.md](error-handling.md)) built from the Zod issues — routes don't need their own try/catch for this.

## Reading validated data in a controller

Type the request as `ValidatedRequest<T>` from `middleware/validation.middleware.ts`, not plain Express `Request`, or `req.validated` won't type-check:

```ts
async create(req: ValidatedRequest<CreateAccountDTO>, res: Response) {
  const data = req.validated; // typed, not `any`
  ...
}
```

## Shared/common schemas

`dto/common.dto.ts` defines `PaginationSchema`, `IdParamSchema` (24-char hex ObjectId), `MessageSchema`. **Reuse these rather than redefining an ObjectId regex or a pagination shape locally** — there was a real bug where `IdParamSchema` was independently defined in both `common.dto.ts` and `account.dto.ts` with the same shape, which produced an ambiguous-export error the moment both were re-exported from the same barrel. If a resource-specific DTO file needs an ObjectId schema for a field, import/build it from `common.dto.ts`'s pieces rather than writing a second copy.

## Naming

`PascalCaseSchema` for the Zod schema (`CreateAccountSchema`), `PascalCaseDTO` for `z.infer<typeof X>` (`CreateAccountDTO`). Export both from the resource's `.dto.ts` file.
