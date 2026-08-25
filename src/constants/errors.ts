// src/constants/errors.ts
/**
 * Centralized error catalog for the application.
 *
 * Each entry defines three stable fields returned to clients:
 * - code:     machine-readable error code (namespaced, e.g. AUTH_001)
 * - key:      i18n key for client-side translation (stable, never changes)
 * - httpStatus: the HTTP status to respond with
 *
 * Messages here are safe fallbacks; services may override the message
 * at throw time without changing the code/key (so clients/i18n stay stable).
 */

export interface ErrorDefinition {
  code: string;
  key: string;
  httpStatus: number;
  message: string;
}

function def(code: string, key: string, httpStatus: number, message: string): ErrorDefinition {
  return { code, key, httpStatus, message };
}

export const ERROR_CODES = {
  // ─── Validation (VAL_xxx) ────────────────────────────────────────────────
  VALIDATION_FAILED: def("VAL_001", "validation.failed", 422, "Validation failed"),
  MISSING_REQUIRED_FIELD: def("VAL_002", "validation.required", 422, "A required field is missing"),
  INVALID_INPUT_FORMAT: def("VAL_003", "validation.invalid_format", 422, "One or more fields have an invalid format"),

  // ─── Authentication (AUTH_xxx) ───────────────────────────────────────────
  UNAUTHENTICATED: def("AUTH_001", "auth.required", 401, "Authentication required"),
  INVALID_CREDENTIALS: def("AUTH_002", "auth.invalid_credentials", 401, "Invalid email or password"),
  TOKEN_MISSING: def("AUTH_003", "auth.token_missing", 401, "Authorization token is missing"),
  TOKEN_INVALID: def("AUTH_004", "auth.token_invalid", 401, "Authorization token is invalid"),
  TOKEN_EXPIRED: def("AUTH_005", "auth.token_expired", 401, "Authorization token has expired"),
  TOKEN_REVOKED: def("AUTH_006", "auth.token_revoked", 401, "Authorization token has been revoked"),
  ACCOUNT_LOCKED: def("AUTH_007", "auth.account_locked", 423, "Account is temporarily locked due to failed attempts"),
  ACCOUNT_SUSPENDED: def("AUTH_008", "auth.account_suspended", 403, "Account is suspended"),
  EMAIL_NOT_VERIFIED: def("AUTH_009", "auth.email_not_verified", 403, "Email address is not verified"),
  MFA_REQUIRED: def("AUTH_010", "auth.mfa_required", 401, "Multi-factor authentication required"),
  MFA_INVALID: def("AUTH_011", "auth.mfa_invalid", 401, "Invalid MFA code"),
  REFRESH_TOKEN_INVALID: def("AUTH_012", "auth.refresh_invalid", 401, "Refresh token is invalid or expired"),
  SESSION_EXPIRED: def("AUTH_013", "auth.session_expired", 401, "Your session has expired, please log in again"),
  ORG_PENDING_APPROVAL: def("AUTH_014", "auth.org_pending_approval", 403, "Your organization is still awaiting review — we'll email you once it's approved"),
  ORG_REJECTED: def("AUTH_015", "auth.org_rejected", 403, "Your organization's application was not approved"),

  // ─── Authorization (PERM_xxx) ────────────────────────────────────────────
  FORBIDDEN: def("PERM_001", "permission.denied", 403, "You do not have permission to perform this action"),
  TENANT_CONTEXT_REQUIRED: def("PERM_002", "permission.tenant_required", 403, "Tenant context is required for this operation"),
  CROSS_TENANT_ACCESS: def("PERM_003", "permission.cross_tenant", 403, "Access to this resource is not allowed"),
  INSUFFICIENT_ROLE: def("PERM_004", "permission.insufficient_role", 403, "Your role is insufficient for this action"),

  // ─── Resources (RES_xxx) ─────────────────────────────────────────────────
  NOT_FOUND: def("RES_001", "resource.not_found", 404, "The requested resource was not found"),
  ALREADY_EXISTS: def("RES_002", "resource.already_exists", 409, "A resource with this identifier already exists"),
  DUPLICATE_KEY: def("RES_003", "resource.duplicate", 409, "A duplicate value was detected"),
  CONFLICT: def("RES_004", "resource.conflict", 409, "Resource state conflict"),
  RESOURCE_LOCKED: def("RES_005", "resource.locked", 423, "Resource is locked"),
  INVALID_ID: def("RES_006", "resource.invalid_id", 400, "Invalid identifier provided"),

  // ─── Rate limiting (RATE_xxx) ─────────────────────────────────────────────
  RATE_LIMIT_EXCEEDED: def("RATE_001", "rate.limit_exceeded", 429, "Too many requests, please try again later"),

  // ─── Database / infrastructure (SYS_xxx) ───────────────────────────────────
  DATABASE_ERROR: def("SYS_001", "system.database_error", 500, "A database error occurred"),
  TRANSACTION_FAILED: def("SYS_002", "system.transaction_failed", 500, "The operation could not be completed"),
  EXTERNAL_SERVICE_ERROR: def("SYS_003", "system.external_error", 502, "An external service failed to respond"),
  SERVICE_UNAVAILABLE: def("SYS_004", "system.unavailable", 503, "Service is temporarily unavailable"),
  TIMEOUT: def("SYS_005", "system.timeout", 504, "The request timed out"),
  CONFIGURATION_ERROR: def("SYS_006", "system.configuration", 500, "A configuration error occurred"),

  // ─── Generic (GEN_xxx) ───────────────────────────────────────────────────
  INTERNAL_ERROR: def("GEN_001", "system.internal_error", 500, "An unexpected error occurred"),
  NOT_IMPLEMENTED: def("GEN_002", "system.not_implemented", 501, "This feature is not implemented"),
  BAD_REQUEST: def("GEN_003", "system.bad_request", 400, "The request could not be processed"),
  METHOD_NOT_ALLOWED: def("GEN_004", "system.method_not_allowed", 405, "HTTP method not allowed"),
} as const;

export type ErrorCodeKey = keyof typeof ERROR_CODES;

/**
 * Resolve a catalog key to its definition.
 */
export function getErrorDefinition(key: ErrorCodeKey): ErrorDefinition {
  return ERROR_CODES[key];
}

/**
 * Build a namespaced error code from the catalog definition.
 */
export function errorCode(key: ErrorCodeKey): string {
  return ERROR_CODES[key].code;
}
