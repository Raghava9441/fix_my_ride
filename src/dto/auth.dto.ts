import { z } from "zod";

// Common schemas
const ObjectIdSchema = z
  .string()
  .refine((val) => /^[0-9a-fA-F]{24}$/.test(val), {
    message: "Invalid ObjectId",
  });

const DateSchema = z.string().datetime().or(z.date());

// ========== AUTH DTOs ==========

export const RegisterSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" })
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
      message:
        "Password must contain at least one lowercase, one uppercase letter, and one number",
    }),
  phone: z.string().optional(),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  primaryRole: z.enum([
    "owner",
    "staff",
    "admin",
    "fleet_manager",
    "service_advisor",
  ]),
  tenantId: ObjectIdSchema.optional(),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
      message:
        "Password must contain at least one lowercase, one uppercase letter, and one number",
    }),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
      message:
        "Password must contain at least one lowercase, one uppercase letter, and one number",
    }),
});

export const VerifyMFASchema = z.object({
  code: z.string().length(6),
});

export const EnableMFASchema = z.object({
  enabled: z.boolean(),
});

// Types
export type RegisterDTO = z.infer<typeof RegisterSchema>;
export type LoginDTO = z.infer<typeof LoginSchema>;
export type ForgotPasswordDTO = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordDTO = z.infer<typeof ResetPasswordSchema>;
export type ChangePasswordDTO = z.infer<typeof ChangePasswordSchema>;
export type VerifyMFADTO = z.infer<typeof VerifyMFASchema>;
export type EnableMFADTO = z.infer<typeof EnableMFASchema>;
