import { z } from "zod";

const ObjectIdSchema = z
  .string()
  .refine((val) => /^[0-9a-fA-F]{24}$/.test(val), {
    message: "Invalid ObjectId",
  });

// ========== PERMISSION DTOs ==========

export const CreatePermissionSchema = z.object({
  key: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  resource: z.enum([
    "vehicle",
    "service_record",
    "owner_profile",
    "staff_profile",
    "service_center",
    "reminder",
    "invitation",
    "report",
    "billing",
    "audit_log",
    "role",
    "account",
    "system",
  ]),
  action: z.enum([
    "create",
    "read",
    "read_all",
    "update",
    "update_all",
    "delete",
    "hard_delete",
    "manage",
    "execute",
    "assign",
  ]),
  scope: z.enum(["own", "center", "tenant", "global"]).default("own"),
  isActive: z.boolean().default(true),
  category: z.string().optional(),
  requiredPlan: z
    .enum(["free", "basic", "professional", "enterprise"])
    .default("free"),
});

export const UpdatePermissionSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
    category: z.string().optional(),
    requiredPlan: z
      .enum(["free", "basic", "professional", "enterprise"])
      .optional(),
  })
  .partial();

// Types
export type CreatePermissionDTO = z.infer<typeof CreatePermissionSchema>;
export type UpdatePermissionDTO = z.infer<typeof UpdatePermissionSchema>;
