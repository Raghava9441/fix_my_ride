# RBAC / Permissions

Two independent permission mechanisms exist in the codebase. Only one of them is actually enforced anywhere today — know which is which before assuming a route/action is protected.

## 1. The Permission → Role → StaffProfile model chain (live, but opt-in per call site)

- **`models/Permission.ts`** — a flat catalog of `resource:action` strings (`vehicle:read`, `staff_profile:manage`, `system:admin`, ...), each with a `scope` (`own`/`center`/`tenant`/`global`) and `requiredPlan`. Seeded via `Permission.seedDefaults()`.
- **`models/Role.ts`** — named bundles of permission refs, with `type: 'system' | 'tenant' | 'custom'`, a numeric `level` (lower = more powerful), and `inheritsFrom` (other roles, walked recursively). Key methods: `role.getAllPermissions()` (resolves direct + inherited permission keys), `role.hasPermission(key)`, `role.addPermission(key)`/`removePermission(key)`. Statics: `Role.getSystemRoles()`, `Role.seedSystemRoles()` (seeds the fixed hierarchy: System Admin → Tenant Admin → Service Center Manager → Technician → Receptionist → Accountant → Vehicle Owner), `Role.findForServiceCenter(centerId)`.
- **`models/StaffProfile.ts`** — a staff member's `roleId` plus two additive/subtractive override lists: `customPermissions` (grants beyond the role, each with optional `expiresAt`) and `deniedPermissions` (explicit revocations, also expirable). The entry point is `staff.can(permissionKey, resourceId?)`:
  1. Check `deniedPermissions` first (non-expired denial → `false`, full stop).
  2. Check `customPermissions` (non-expired grant → `true`).
  3. Fall through to the role: populate `roleId`, call `role.hasPermission(permissionKey)`.
  4. If a `resourceId` was passed, additionally call `staff.canAccessResource(permissionKey, resourceId)` for resource-level ownership (e.g. "can this technician touch *this* vehicle" checks against `vehicle.authorizedServiceCenters` for the staff member's own `serviceCenterId`).
  - Also: `staff.getPermissions()` (effective permission list, custom minus denied), `staff.isAdmin()`/`isManager()` (role `level` thresholds).
- **`models/OwnerProfile.ts`** — owners don't go through Role/Permission at all; they have implicit full permissions on their own data. `owner.can(permissionKey, resourceId?)` checks the resource is one of `['vehicle','service_record','reminder','owner_profile','invitation']`, allows `read`/`create` unconditionally, and for `update`/`delete` defers to `owner.ownsResource(resource, resourceId)` (checks `owner.vehicles`, or looks up the record's `ownerId` for `service_record`/`reminder`).

**None of this is invoked by a route-level middleware today.** It's called explicitly, ad hoc, from inside individual services/controllers wherever the author remembered to add the check. When adding a new endpoint that touches another user's data, you need to call the relevant `.can()`/`.ownsResource()` yourself — there's no framework-level guarantee that it happens.

## 2. `middleware/authorization.middleware.ts` (implemented, but unused — 0 routes reference it)

- `requireRole(...roles)` — checks `req.user.roles` (JWT claim) against an allow-list, throws `INSUFFICIENT_ROLE` otherwise.
- `requirePermission(...permissions)` — checks `req.user.permissions` (also a JWT claim, so it reflects whatever was baked into the token at login, not a live DB lookup) against a required set, throws `FORBIDDEN` for any missing.
- `requireTenant` — checks the requester belongs to the tenant referenced by `req.params.tenantId`/`req.body.tenantId` (admins bypass).

This exists and is fully written, but grep confirms it's not imported by any route file. If a task is "lock down endpoint X," the two real options are: (a) call the appropriate model-level `.can()` from inside the service/controller (consistent with current live behavior), or (b) actually wire `requirePermission()`/`requireRole()` into that route (a genuine improvement, just not the status quo — flag it as an intentional change rather than assuming it was already the pattern).

## Practical guidance

- Prefer the model-level `.can()` check for anything involving *resource ownership* (a specific vehicle, a specific service record) — the JWT-claim-based middleware has no concept of "does this specific resource belong to this user," only role/permission-name membership.
- Prefer `requirePermission()`/`requireRole()` (once wired in) for coarse-grained "does this user's role allow this endpoint at all" gating, since it doesn't require a DB round-trip.
- Watch `expiresAt` on `customPermissions`/`deniedPermissions` — both are only honored by the code paths above if the query itself filters on the current time; there's no background job expiring them out of the arrays (nor would there need to be, since the check is done live at read time).
- Multi-tenancy ([multi-tenancy.md](multi-tenancy.md)) and RBAC are separate concerns — a query can be correctly tenant-scoped and still lack a permission check, or vice versa (e.g. `owner.can()` performing an ownership check on a shared, non-tenant-scoped collection like `vehicles`).
