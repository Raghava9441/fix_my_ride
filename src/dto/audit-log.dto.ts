import { z } from "zod";

const ObjectIdSchema = z
  .string()
  .refine((val) => /^[0-9a-fA-F]{24}$/.test(val), {
    message: "Invalid ObjectId",
  });

// ========== AUDIT LOG DTOs ==========

export const AuditLogFiltersSchema = z.object({
  tenantId: ObjectIdSchema.optional(),
  actorId: ObjectIdSchema.optional(),
  action: z
    .enum([
      "CREATE",
      "READ",
      "UPDATE",
      "DELETE",
      "LOGIN",
      "LOGOUT",
      "GRANT_ACCESS",
      "REVOKE_ACCESS",
    ])
    .optional(),
  entityType: z
    .enum([
      "Vehicle",
      "ServiceRecord",
      "Account",
      "OwnerProfile",
      "StaffProfile",
      "ServiceCenter",
    ])
    .optional(),
  entityId: ObjectIdSchema.optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  limit: z.number().min(1).max(100).default(50),
  skip: z.number().min(0).default(0),
});

// Types
export type AuditLogFiltersDTO = z.infer<typeof AuditLogFiltersSchema>;
