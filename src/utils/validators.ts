import { z } from "zod";

// ============================================
// Common Validation Schemas
// ============================================

export const emailSchema = z
  .string()
  .email("Invalid email format")
  .max(255, "Email too long");

export const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format");

export const urlSchema = z
  .string()
  .url("Invalid URL format")
  .max(2048, "URL too long");

export const uuidSchema = z.string().uuid("Invalid UUID format");

export const indianPhoneSchema = z
  .string()
  .regex(/^(\+91[\-\s]?)?[0]?(91)?[6-9]\d{9}$/, "Invalid Indian phone number");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password too long")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(
    /[^A-Za-z0-9]/,
    "Password must contain at least one special character",
  );

// ============================================
// Object Validation
// ============================================

export const requiredStringSchema = z.string().min(1, "Field is required");

export const optionalStringSchema = z.string().optional();

export const requiredNumberSchema = z
  .number()
  .min(0, "Must be a positive number");

export const optionalNumberSchema = z.number().optional();

export const requiredArraySchema = z
  .array(z.any())
  .min(1, "Array cannot be empty");

export const optionalArraySchema = z.array(z.any()).optional();

// ============================================
// Generic Validators
// ============================================

export function validateEmail(email: unknown): boolean {
  return emailSchema.safeParse(email).success;
}

export function validatePhone(phone: unknown): boolean {
  return phoneSchema.safeParse(phone).success;
}

export function validateUrl(url: unknown): boolean {
  return urlSchema.safeParse(url).success;
}

export function validateUuid(uuid: unknown): boolean {
  return uuidSchema.safeParse(uuid).success;
}

export function validatePassword(password: unknown): boolean {
  return passwordSchema.safeParse(password).success;
}

// ============================================
// Validation Result Type
// ============================================

export interface ValidationResult {
  isValid: boolean;
  errors: Array<{
    field: string;
    message: string;
    code?: string;
  }>;
}

// ============================================
// Field Validators
// ============================================

export function validateObject(
  schema: z.ZodSchema,
  data: unknown,
  fieldName: string = "data",
): ValidationResult {
  const result = schema.safeParse(data);

  if (result.success) {
    return { isValid: true, errors: [] };
  }

  return {
    isValid: false,
    errors: result.error.errors.map((err) => ({
      field: fieldName,
      message: err.message,
      code: err.code,
    })),
  };
}

export function validatePartial(
  schema: z.ZodSchema,
  data: unknown,
  fieldName: string = "data",
): ValidationResult {
  const result = schema.safeParse(data);

  if (result.success) {
    return { isValid: true, errors: [] };
  }

  return {
    isValid: false,
    errors: result.error.errors.map((err) => ({
      field: fieldName,
      message: err.message,
      code: err.code,
    })),
  };
}

// ============================================
// Custom Validators
// ============================================

export function isNumeric(value: unknown): boolean {
  if (typeof value === "number") return true;
  if (typeof value === "string") {
    return !isNaN(Number(value)) && value.trim() !== "";
  }
  return false;
}

export function isAlpha(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /^[a-zA-Z]+$/.test(value);
}

export function isAlphanumeric(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /^[a-zA-Z0-9]+$/.test(value);
}

export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

export function isPastDate(date: Date | string | number): boolean {
  const d = new Date(date);
  return d < new Date();
}

export function isFutureDate(date: Date | string | number): boolean {
  const d = new Date(date);
  return d > new Date();
}

// ============================================
// Type Guards
// ============================================

export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function isNumber(value: unknown): value is number {
  return typeof value === "number" && !isNaN(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export function isDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

export function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// ============================================
// Sanitization
// ============================================

export function sanitizeString(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.trim().replace(/\s+/g, " ");
}

export function sanitizeNumber(input: unknown): number | null {
  const num = Number(input);
  return isNaN(num) ? null : num;
}

export function sanitizeBoolean(input: unknown): boolean | null {
  if (typeof input === "boolean") return input;
  if (typeof input === "string") {
    return input.toLowerCase() === "true";
  }
  return null;
}

export function sanitizeArray<T>(
  input: unknown,
  sanitizer: (item: unknown) => T,
): T[] {
  if (!Array.isArray(input)) return [];
  return input.map((item) => sanitizer(item));
}
