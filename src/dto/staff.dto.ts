import { z } from "zod";

const ObjectIdSchema = z
  .string()
  .refine((val) => /^[0-9a-fA-F]{24}$/.test(val), {
    message: "Invalid ObjectId",
  });

// ========== STAFF PROFILE DTOs ==========

export const CreateStaffSchema = z.object({
  accountId: ObjectIdSchema,
  serviceCenterId: ObjectIdSchema,
  employeeId: z.string().optional(),
  roleId: ObjectIdSchema,
  customPermissions: z
    .array(
      z.object({
        permission: ObjectIdSchema,
        grantedBy: ObjectIdSchema,
        expiresAt: z.string().datetime().optional(),
        reason: z.string().optional(),
      }),
    )
    .optional(),
  employmentStatus: z
    .enum(["active", "on_leave", "suspended", "terminated"])
    .default("active"),
  employmentType: z
    .enum(["full_time", "part_time", "contractor", "intern"])
    .default("full_time"),
  workSchedule: z
    .record(
      z.object({
        start: z.string().optional(),
        end: z.string().optional(),
        available: z.boolean().optional(),
      }),
    )
    .optional(),
  skills: z
    .array(
      z.object({
        name: z.string(),
        level: z.enum(["beginner", "intermediate", "expert"]),
        certified: z.boolean().default(false),
        certificationExpiry: z.string().datetime().optional(),
        yearsOfExperience: z.number().optional(),
      }),
    )
    .optional(),
  specializations: z.array(z.string()).optional(),
});

export const UpdateStaffSchema = z
  .object({
    employeeId: z.string().optional(),
    roleId: ObjectIdSchema.optional(),
    employmentStatus: z
      .enum(["active", "on_leave", "suspended", "terminated"])
      .optional(),
    employmentType: z
      .enum(["full_time", "part_time", "contractor", "intern"])
      .optional(),
    workSchedule: z
      .record(
        z.object({
          start: z.string().optional(),
          end: z.string().optional(),
          available: z.boolean().optional(),
        }),
      )
      .optional(),
    skills: z
      .array(
        z.object({
          name: z.string(),
          level: z.enum(["beginner", "intermediate", "expert"]),
          certified: z.boolean(),
          certificationExpiry: z.string().datetime().optional(),
          yearsOfExperience: z.number().optional(),
        }),
      )
      .optional(),
    specializations: z.array(z.string()).optional(),
  })
  .partial();

export const UpdateStaffScheduleSchema = z.object({
  workSchedule: z.record(
    z.object({
      start: z.string().optional(),
      end: z.string().optional(),
      available: z.boolean().optional(),
    }),
  ),
});

export const AddCustomPermissionSchema = z.object({
  permissionId: ObjectIdSchema,
  grantedBy: ObjectIdSchema,
  expiresAt: z.string().datetime().optional(),
  reason: z.string().optional(),
});

export const DenyPermissionSchema = z.object({
  permissionId: ObjectIdSchema,
  deniedBy: ObjectIdSchema,
  reason: z.string().optional(),
});

// Types
export type CreateStaffDTO = z.infer<typeof CreateStaffSchema>;
export type UpdateStaffDTO = z.infer<typeof UpdateStaffSchema>;
export type UpdateStaffScheduleDTO = z.infer<typeof UpdateStaffScheduleSchema>;
export type AddCustomPermissionDTO = z.infer<typeof AddCustomPermissionSchema>;
export type DenyPermissionDTO = z.infer<typeof DenyPermissionSchema>;
