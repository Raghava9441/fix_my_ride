import { z } from "zod";

const ObjectIdSchema = z
  .string()
  .refine((val) => /^[0-9a-fA-F]{24}$/.test(val), {
    message: "Invalid ObjectId",
  });

export const IdParamSchema = z.object({
  id: ObjectIdSchema,
});

// ========== ACCOUNT DTOs ==========

export const CreateAccountSchema = z.object({
  email: z.string().email(),
  phone: z.string().optional(),
  password: z
    .string()
    .min(8)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
      message:
        "Password must contain at least one lowercase, one uppercase letter, and one number",
    }),
  primaryRole: z.enum([
    "owner",
    "staff",
    "admin",
    "fleet_manager",
    "service_advisor",
  ]),
  tenantId: ObjectIdSchema.optional(),
});

export const UpdateAccountSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().optional(),
    primaryRole: z
      .enum(["owner", "staff", "admin", "fleet_manager", "service_advisor"])
      .optional(),
    status: z
      .enum([
        "active",
        "suspended",
        "pending_verification",
        "deleted",
        "locked",
      ])
      .optional(),
    preferences: z
      .object({
        language: z.enum(["en", "es", "fr", "de", "ar", "hi"]).optional(),
        timezone: z.string().optional(),
        currency: z.enum(["USD", "EUR", "GBP", "INR", "AED"]).optional(),
      })
      .optional(),
  })
  .partial();

export const AssignRoleSchema = z.object({
  roleId: ObjectIdSchema,
  profileId: ObjectIdSchema.optional(),
});

export const SwitchRoleSchema = z.object({
  accountId: ObjectIdSchema,
  roleId: ObjectIdSchema,
});

export const UpdateAccountStatusSchema = z.object({
  status: z.enum([
    "active",
    "suspended",
    "pending_verification",
    "deleted",
    "locked",
  ]),
  suspensionReason: z.string().optional(),
});

// Types
export type CreateAccountDTO = z.infer<typeof CreateAccountSchema>;
export type UpdateAccountDTO = z.infer<typeof UpdateAccountSchema>;
export type AssignRoleDTO = z.infer<typeof AssignRoleSchema>;
export type SwitchRoleDTO = z.infer<typeof SwitchRoleSchema>;
export type UpdateAccountStatusDTO = z.infer<typeof UpdateAccountStatusSchema>;
