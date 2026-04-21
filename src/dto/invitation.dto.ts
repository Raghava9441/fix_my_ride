import { z } from "zod";

const ObjectIdSchema = z
  .string()
  .refine((val) => /^[0-9a-fA-F]{24}$/.test(val), {
    message: "Invalid ObjectId",
  });

// ========== INVITATION DTOs ==========

export const CreateInvitationSchema = z.object({
  tenantId: ObjectIdSchema.optional(),
  inviterId: ObjectIdSchema,
  inviterType: z.enum([
    "OwnerProfile",
    "StaffProfile",
    "Account",
    "ServiceCenter",
  ]),
  inviterName: z.string().optional(),
  inviteeEmail: z.string().email().optional(),
  inviteePhone: z.string().optional(),
  inviteeName: z.string().optional(),
  invitationType: z.enum([
    "vehicle_access",
    "center_staff",
    "ownership_transfer",
    "collaborator",
  ]),
  vehicleId: ObjectIdSchema.optional(),
  serviceCenterId: ObjectIdSchema.optional(),
  role: z.enum([
    "owner",
    "technician",
    "manager",
    "receptionist",
    "accountant",
    "viewer",
    "admin",
  ]),
  accessLevel: z.enum(["full", "readonly", "limited"]).default("readonly"),
  permissions: z.array(z.string()).optional(),
  message: z.string().optional(),
  maxUses: z.number().min(1).max(10).default(1),
  expiresAt: z.string().datetime().optional(),
});

export const UpdateInvitationSchema = z
  .object({
    message: z.string().optional(),
    maxUses: z.number().min(1).max(10).optional(),
    expiresAt: z.string().datetime().optional(),
  })
  .partial();

export const AcceptInvitationSchema = z.object({
  userId: ObjectIdSchema,
  userType: z.string(),
});

export const RevokeInvitationSchema = z.object({
  reason: z.string().optional(),
});

// Types
export type CreateInvitationDTO = z.infer<typeof CreateInvitationSchema>;
export type UpdateInvitationDTO = z.infer<typeof UpdateInvitationSchema>;
export type AcceptInvitationDTO = z.infer<typeof AcceptInvitationSchema>;
export type RevokeInvitationDTO = z.infer<typeof RevokeInvitationSchema>;
