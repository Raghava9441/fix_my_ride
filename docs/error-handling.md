# Error Handling

## The error catalog

`src/constants/errors.ts` exports `ERROR_CODES`, a single object mapping a stable key (`TOKEN_EXPIRED`, `VALIDATION_FAILED`, `INSUFFICIENT_ROLE`, ...) to `{ code, key, httpStatus, message }`:
- `code` — machine-readable, namespaced (`AUTH_005`, `VAL_001`) — stable, don't renumber existing ones.
- `key` — stable i18n key (`auth.token_expired`) for client-side translation — also don't rename once shipped.
- `httpStatus` — the status code the client gets.
- `message` — a safe default; callers can override it per-throw without touching the code/key.

**Adding a new failure mode means adding an entry to `ERROR_CODES` first**, then throwing it — don't invent a one-off status/message pair inline.

## Throwing errors

```ts
import { AppError } from "../utils/appError";

throw AppError.fromCode("ACCOUNT_SUSPENDED", {
  correlationId: req.id,
  message: "This account has been suspended", // optional override
  details: { ... },                            // optional, e.g. field errors
});
```

`AppError` (`utils/appError.ts`) carries `code`/`key`/`httpStatus`/`correlationId`/`details`/`isOperational`. `isOperational: true` (the default) means "safe to show the client"; `false` means a programmer/unexpected error — in production its message gets replaced with a generic one in the response (the real message still goes to the log).

A handful of legacy-named subclasses (`ValidationError`, `AuthenticationError`, `AuthorizationError`, `NotFoundError`, `ConflictError`, `RateLimitError` in `middleware/error.middleware.ts`) exist as thin wrappers over specific `ERROR_CODES` entries for backwards compatibility — prefer `AppError.fromCode(...)` directly in new code rather than adding to that list.

## The global handler

`middleware/error.middleware.ts`'s `errorHandler` (mounted last in `app.ts`) normalizes *anything* thrown into an `AppError` before responding, so route/service code never needs its own try/catch just to shape a response:
- Already an `AppError` → passed through (correlation id backfilled if missing).
- `ZodError` / `mongoose.Error.ValidationError` → mapped to `VALIDATION_FAILED` with field-level `details`.
- `mongoose.Error.CastError` (bad ObjectId) → `INVALID_ID`.
- Duplicate key (`err.code === 11000`) → `DUPLICATE_KEY`, with the offending field/value extracted from `keyPattern`/`keyValue`.
- `JsonWebTokenError` / `TokenExpiredError` → `TOKEN_INVALID` / `TOKEN_EXPIRED`.
- Anything else → `INTERNAL_ERROR`, `isOperational: false`.

It logs a structured line (`type: "error"`, code/key/correlationId/requestId/userId/tenantId/method/url/status/message/stack/details) and responds with `{ success: false, code, key, correlationId, message, timestamp, details?, stack? (non-prod only) }`. `notFound` (also mounted in `app.ts`, just before the error handler) produces the same shape for unmatched routes via `ERROR_CODES.NOT_FOUND`.

## Validation errors specifically

`middleware/validation.middleware.ts`'s `validate`/`validateQuery`/`validateParams` catch `ZodError` themselves and build the same response shape directly (via `sendValidationError`) rather than calling `next(err)` — this is a deliberate parallel construction for the common case, not a divergent format; keep both in sync if the response envelope shape ever changes. See [validation.md](validation.md).

## Correlation IDs

Every `AppError` should carry `correlationId: req.id` so the client-visible error and the corresponding server log line can be matched up (`X-Correlation-ID` response header, also logged). `req.id` is set once per request in `app.ts`/`requestContext.middleware.ts` — see [api-standards.md](api-standards.md).
