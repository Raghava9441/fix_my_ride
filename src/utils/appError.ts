// src/utils/appError.ts
import { ErrorCodeKey, ERROR_CODES, getErrorDefinition } from "../constants/errors";

/**
 * Structured field-level validation error returned to clients.
 */
export interface FieldError {
  field: string;
  message: string;
  code?: string;
  value?: unknown;
}

/**
 * Unified application error.
 *
 * Every error carries:
 * - code:         machine-readable, namespaced (e.g. AUTH_002)
 * - key:          stable i18n key (e.g. auth.invalid_credentials)
 * - correlationId: request id for tracing in logs & client support
 * - httpStatus:   HTTP status to respond with
 * - details:      optional field-level errors / extra context
 *
 * Operational errors (isOperational = true) are safe to surface to clients.
 * Programmer errors (false) are logged but return a generic message in prod.
 */
export class AppError extends Error {
  readonly code: string;
  readonly key: string;
  readonly httpStatus: number;
  readonly isOperational: boolean;
  readonly details?: unknown;
  private _correlationId?: string;

  constructor(opts: {
    code: string;
    key: string;
    message: string;
    httpStatus: number;
    correlationId?: string;
    isOperational?: boolean;
    details?: unknown;
  }) {
    super(opts.message);
    this.name = "AppError";
    this.code = opts.code;
    this.key = opts.key;
    this.httpStatus = opts.httpStatus;
    this._correlationId = opts.correlationId;
    this.isOperational = opts.isOperational ?? true;
    this.details = opts.details;
    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, AppError.prototype);
  }

  get correlationId(): string | undefined {
    return this._correlationId;
  }

  set correlationId(value: string | undefined) {
    this._correlationId = value;
  }

  /**
   * Create an AppError from a catalog key, optionally overriding the message
   * and attaching a correlation id / field details.
   */
  static fromCode(
    key: ErrorCodeKey,
    overrides: {
      message?: string;
      correlationId?: string;
      details?: unknown;
      isOperational?: boolean;
    } = {},
  ): AppError {
    const def = getErrorDefinition(key);
    return new AppError({
      code: def.code,
      key: def.key,
      message: overrides.message ?? def.message,
      httpStatus: def.httpStatus,
      correlationId: overrides.correlationId,
      details: overrides.details,
      isOperational: overrides.isOperational,
    });
  }
}

/**
 * Convenience factory mirroring AppError.fromCode.
 */
export function createAppError(
  key: ErrorCodeKey,
  overrides: {
    message?: string;
    correlationId?: string;
    details?: unknown;
    isOperational?: boolean;
  } = {},
): AppError {
  return AppError.fromCode(key, overrides);
}

/**
 * Build field-level validation errors from a ZodError-like structure.
 */
export function toFieldErrors(
  errors: Array<{ path: (string | number)[]; message: string; code?: string }>,
): FieldError[] {
  return errors.map((e) => ({
    field: e.path.join("."),
    message: e.message,
    code: e.code,
  }));
}
