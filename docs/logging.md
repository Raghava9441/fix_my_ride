# Logging

## Implementation

`config/logger.ts` uses **winston**, not pino — despite `pino`/`pino-pretty` being listed in `package.json` dependencies, they aren't imported anywhere; don't assume pino is the active logger, and don't add pino-specific config expecting it to take effect. (If you're doing dependency cleanup, that's a legitimate unused dependency to remove — just know it's unused, not swapped in somewhere non-obvious.)

Custom levels: `error(0) > warn(1) > info(2) > http(3) > debug(4)`, driven by `config.logging.level` (env `LOG_LEVEL`). Console output is colorized/human-readable when `config.logging.prettyPrint` (env `LOG_PRETTY`) is true (typically dev); otherwise it's JSON. In non-pretty (production-shaped) mode, three rotating file transports are added on top of console: `logs/error.log` (error level only), `logs/combined.log` (everything), plus always-on `logs/exceptions.log`/`logs/rejections.log` for uncaught exceptions/unhandled rejections. Each rotates at 5MB, keeping 5 files.

`morgan("combined", { stream })` pipes HTTP access logs through winston's `http` level (`stream.write` in `config/logger.ts`) — mounted directly in `app.ts`. There's also a separately-exported `httpLogger` in the same file that isn't actually used (`app.ts` builds its own morgan instance inline instead) — if you need to change HTTP logging behavior, check both.

## Structured logging convention

Application code logs objects, not interpolated strings, with a `type` field identifying the event kind — this is what makes logs greppable/queryable downstream:

```ts
logger.info({
  type: "request_complete",
  requestId: req.id,
  method: req.method,
  url: req.url,
  statusCode: res.statusCode,
  duration: `${duration}ms`,
  tenantId: req.tenantId,
  userId: req.userId,
});
```

Follow this shape (a `type`, plus whatever structured fields are relevant) rather than `logger.info(\`Request ${req.method} ${req.url}\`)` — see `middleware/requestContext.middleware.ts`, `middleware/error.middleware.ts`, `middleware/tenant/tenantPlugin.ts` for more examples (`request_complete`, `error`, `tenant_isolation_blocked`, etc.).

## Correlation

Every log line for a request should include `requestId`/`correlationId` (from `req.id`) so it can be tied back to a specific client-visible error — see [error-handling.md](error-handling.md). `tenantId`/`userId` are included where available for the same reason.

## What not to do

- Don't `console.log` in application code that already has `logger` available — `config/database.ts` is a partial exception (it predates/coexists with the winston setup and still uses `console.log`/`console.error` directly for connection lifecycle events); match its existing style if you're editing that specific file, but use `logger` everywhere else.
- Don't log secrets/tokens/passwords, even at debug level. `mongoose.set('debug', ...)` query logging (enabled in dev or via `DEBUG_MONGOOSE=true`) will print full query documents — be mindful of what that includes if you enable it against non-trivial data.
