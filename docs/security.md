# Security

## Transport-level middleware (app.ts, in order)

- **helmet** with an explicit CSP (`defaultSrc 'self'`, allows Stripe/Google Maps `connectSrc`/`frameSrc` — update this list if you integrate a new third-party script/iframe origin).
- **cors** via `config/cors.ts` (`corsOptions`) — allowed origins come from `CORS_ALLOWED_ORIGINS` env var.
- **express-rate-limit**, configured in `config/rate-limit.ts` and mounted on the whole `/api` prefix. Keyed by `tenantId:ip` (not just IP) so one noisy tenant doesn't throttle others; skips `/health`, `/ready`, `/live`, `/api/v1/webhooks`. Note: `middleware/rateLimit.middleware.ts` is an empty stub — the real config lives in `config/rate-limit.ts` and is applied directly in `app.ts`, not through that middleware file.
- **express-mongo-sanitize** (`mongoSanitize()`) — strips `$`/`.` operator injection from `req.body`/`req.query`/`req.params`.
- **hpp()** — HTTP parameter pollution protection.
- **`requestSanitizer`** (`middleware/sanitizer.middleware.ts`) — deep-walks `req.body`/`req.query`/`req.params` and runs every string through the `xss` package with a whitelist of safe tags (`p`, `br`, `strong`, `a[href,title,target]`, etc.) for fields that legitimately contain limited rich text (service descriptions). Recursion is capped at depth 10.

## AuthN

JWT-based, `middleware/auth.middleware.ts`:
- `authenticate` extracts a `Bearer` token, verifies it (`utils/token.ts`, signed with `JWT_SECRET`, `issuer: "fix-my-ride"`, `audience: "fix-my-ride-clients"`), and checks a Redis-backed revocation denylist (`isTokenBlacklisted`). If Redis itself is unreachable, auth **fails closed** (`SERVICE_UNAVAILABLE`) rather than silently allowing the request through.
- On success it attaches `req.user` (`userId`, `email`, `role`/`roles`, `tenantId`, `permissions`, `sessionVersion`, `mfaVerified`, `jti`) plus `req.userId`/`req.userRole`/`req.tenantId`/`req.authToken`.
- Refresh tokens are separately signed (`JWT_REFRESH_SECRET`) and verified in `services/auth.service.ts`.
- `Account` documents carry `mfaEnabled`/`mfaSecret`/`mfaBackupCodes` and `emailVerified`/`phoneVerified`/`failedLoginAttempts`/`lockedUntil`/`suspensionReason` — account lockout and suspension are data-model concerns checked in the auth flow, not separate middleware.

## AuthZ

Two layers exist; only one is actually wired in — see [rbac.md](rbac.md) for the full picture:
- `middleware/authorization.middleware.ts` (`requireRole`, `requirePermission`, `requireTenant`) reads `req.user.roles`/`req.user.permissions` (JWT claims). **Implemented but not mounted on any route today.**
- Model-level `staff.can(permissionKey, resourceId?)` / `owner.can(permissionKey, resourceId?)` (see `models/StaffProfile.ts`, `models/OwnerProfile.ts`) — the actual live enforcement, called explicitly from individual services where needed.

Multi-tenant data isolation is a separate, always-on mechanism enforced at the Mongoose layer — see [multi-tenancy.md](multi-tenancy.md). Don't confuse "tenant-scoped" with "permission-checked"; a query can be correctly tenant-scoped and still missing a permission check.

## Passwords

`bcryptjs`, `utils/password.ts`: `hashPassword`/`verifyPassword` (async, `SALT_ROUNDS = 12`), `hashPasswordSync`/`verifyPasswordSync`, `needsRehash(hash)` (compares `bcrypt.getRounds(hash)` against the current `SALT_ROUNDS` so a rotation to a higher cost factor can be detected and rehashed on next login), `validatePasswordStrength`/`estimatePasswordStrength`/`isCommonPassword` for signup-time policy checks.

## Secrets & environment

Real secrets live in `.env.<NODE_ENV>` files, all git-ignored (`.env.example` is the checked-in reference). `src/config/schema.ts` (Zod) validates every required var at startup — a missing/invalid secret fails fast with a descriptive error rather than surfacing later as a runtime crash. Never commit a `.env.*` file other than `.env.example`/`.env.test`.

## Known gaps

- CSRF protection is not implemented (this is a token-auth API, not cookie-session-based, but `cookie-parser` is mounted — if you add a cookie-based auth flow, add CSRF protection alongside it).
- No centralized `requirePermission()` gate on routes today (see above) — resource-sensitive endpoints rely on the service/controller remembering to call `.can()`. When adding a new sensitive endpoint, check that it actually calls the permission check rather than assuming the framework enforces it.
