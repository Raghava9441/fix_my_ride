# API Standards

## Versioning & mounting

All routes are mounted under `/api/v1/<resource>` in `app.ts` (e.g. `/api/v1/owners`, `/api/v1/vehicles`). Health probes (`/live`, `/ready`, `/health`) are intentionally unversioned and unscoped so infra/orchestrators can hit them without auth or tenant context — see `middleware/tenant.middleware.ts`'s `PUBLIC_PREFIXES`.

Route files themselves only ever use relative paths (`/`, `/:id`, `/:id/roles`) — see [architecture.md](architecture.md).

## Response envelope

Every response goes through `utils/apiResponse.ts`. Two response shapes, discriminated by `success`:

```ts
// success
{ success: true,  statusCode, message, data: T | null, meta: { pagination?, requestId?, ... } | null, timestamp }
// error
{ success: false, statusCode, message, errors: ValidationErrorDetail[], timestamp, requestId? }
```

Build these with the helpers re-exported from `utils/index.ts`, not by hand:
- `createSuccessResponse(data, message, statusCode?)`
- `createErrorResponse(message, statusCode)`
- `createPaginatedResponse(data, page, limit, total, message)`
- `createValidationError(...)`

Controllers call `.toJSON()` on the returned `ApiResponse`/`ResponseBuilder` instance and send it with `res.status(response.statusCode).json(response.toJSON())` — follow that exact call shape for consistency (see any method in `controllers/account.controller.ts` for the pattern).

## Status codes

Use the `HttpStatus` enum-like object from `utils/apiResponse.ts` (`HttpStatus.OK`, `HttpStatus.CREATED`, `HttpStatus.NOT_FOUND`, etc.) rather than raw numbers, and prefer mapping failures through `AppError.fromCode(...)` (see [error-handling.md](error-handling.md)) so the status code and client-facing message stay attached to a single named error definition instead of being duplicated at each call site.

## Request validation

Body/query/param validation is Zod-based, applied per-route via `validate()`/`validateQuery()`/`validateParams()` — see [validation.md](validation.md). Controllers that read validated input should type `req` as `ValidatedRequest<T>` (from `middleware/validation.middleware.ts`), not plain Express `Request`, or `req.validated` won't type-check.

## Pagination

List endpoints follow the `{ page, limit }` query convention, resolved via `utils/pagination.ts`'s `parsePagination`/`calculatePagination` or the `paginate()` helper in `config/database.ts` (see [database.md](database.md)), and returned via `createPaginatedResponse`. Default page size and max are enforced in the DTO's `PaginationSchema` (`dto/common.dto.ts`), not ad hoc per route.

## Correlation / request IDs

Every request gets an `X-Request-ID` (and mirrored `X-Correlation-ID`) header, generated in `app.ts` and again threaded through `requestContext` — pass `req.id` as the `correlationId` when constructing an `AppError` so it shows up in both the error response and the structured log line for that request.
