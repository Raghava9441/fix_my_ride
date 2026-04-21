import { z } from "zod";

const ObjectIdSchema = z
  .string()
  .refine((val) => /^[0-9a-fA-F]{24}$/.test(val), {
    message: "Invalid ObjectId",
  });

// ========== ROLE DTOs ==========

export const CreateRoleSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  slug: z.string().min(1).max(100).toLowerCase().trim(),
  description: z.string().optional(),
  type: z.enum(["system", "tenant", "custom"]).default("custom"),
  tenantId: ObjectIdSchema.optional(),
  serviceCenterId: ObjectIdSchema.optional(),
  level: z.number().min(0).max(1000).default(100),
  permissions: z.array(ObjectIdSchema).optional(),
  inheritsFrom: z.array(ObjectIdSchema).optional(),
  color: z.string().default("#6B7280"),
  icon: z.string().optional(),
  maxUsers: z.number().default(0),
  isDefault: z.boolean().default(false),
  createdBy: ObjectIdSchema.optional(),
});

export const UpdateRoleSchema = z
  .object({
    name: z.string().min(1).max(100).trim().optional(),
    description: z.string().optional(),
    permissions: z.array(ObjectIdSchema).optional(),
    inheritsFrom: z.array(ObjectIdSchema).optional(),
    color: z.string().optional(),
    icon: z.string().optional(),
    maxUsers: z.number().optional(),
    isActive: z.boolean().optional(),
    isDefault: z.boolean().optional(),
  })
  .partial();

export const AddPermissionToRoleSchema = z.object({
  permissionId: ObjectIdSchema,
});

export const AssignRoleToUserSchema = z.object({
  accountId: ObjectIdSchema,
  profileId: ObjectIdSchema.optional(),
});

// Types
export type CreateRoleDTO = z.infer<typeof CreateRoleSchema>;
export type UpdateRoleDTO = z.infer<typeof UpdateRoleSchema>;
export type AddPermissionToRoleDTO = z.infer<typeof AddPermissionToRoleSchema>;
export type AssignRoleToUserDTO = z.infer<typeof AssignRoleToUserSchema>;
