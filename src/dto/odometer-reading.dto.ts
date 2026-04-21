import { z } from "zod";

const ObjectIdSchema = z
  .string()
  .refine((val) => /^[0-9a-fA-F]{24}$/.test(val), {
    message: "Invalid ObjectId",
  });

// ========== ODOMETER READING DTOs ==========

export const CreateOdometerReadingSchema = z.object({
  tenantId: ObjectIdSchema.optional(),
  vehicleId: ObjectIdSchema,
  value: z.number().min(0),
  unit: z.enum(["km", "miles"]).default("km"),
  recordedBy: ObjectIdSchema.optional(),
  recordedByModel: z
    .enum(["Account", "OwnerProfile", "StaffProfile", "System"])
    .optional(),
  source: z
    .enum(["manual_entry", "service_record", "import", "api", "obd_device"])
    .default("manual_entry"),
  isVerified: z.boolean().default(false),
  verifiedBy: ObjectIdSchema.optional(),
  notes: z.string().optional(),
});

export const UpdateOdometerReadingSchema = z
  .object({
    value: z.number().min(0).optional(),
    unit: z.enum(["km", "miles"]).optional(),
    isVerified: z.boolean().optional(),
    verifiedBy: ObjectIdSchema.optional(),
    notes: z.string().optional(),
  })
  .partial();

export const VerifyOdometerSchema = z.object({
  verifiedBy: ObjectIdSchema,
});

export const QueryOdometerHistorySchema = z.object({
  limit: z.number().min(1).max(100).default(100),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

// Types
export type CreateOdometerReadingDTO = z.infer<
  typeof CreateOdometerReadingSchema
>;
export type UpdateOdometerReadingDTO = z.infer<
  typeof UpdateOdometerReadingSchema
>;
export type VerifyOdometerDTO = z.infer<typeof VerifyOdometerSchema>;
export type QueryOdometerHistoryDTO = z.infer<
  typeof QueryOdometerHistorySchema
>;
