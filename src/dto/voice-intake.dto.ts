import { z } from "zod";

// ========== VOICE INTAKE DTOs ==========
// The draft is held by the client between calls (stateless server): each
// /parse call merges new speech into it, /confirm creates the records.

export const SERVICE_TYPES = [
  "oil_change",
  "brake_service",
  "tire_rotation",
  "repair",
  "maintenance",
  "inspection",
  "other",
] as const;

const FUEL_TYPES = ["petrol", "diesel", "electric", "hybrid", "cng", "lpg"] as const;

export const VoiceDraftSchema = z.object({
  owner: z
    .object({
      firstName: z.string().trim().min(1).max(50).optional(),
      lastName: z.string().trim().max(50).optional(),
      phone: z.string().trim().optional(),
    })
    .default({}),
  vehicle: z
    .object({
      registrationNumber: z.string().trim().min(1).optional(),
      make: z.string().trim().min(1).optional(),
      model: z.string().trim().min(1).optional(),
      year: z.number().int().min(1900).max(new Date().getFullYear() + 1).optional(),
      fuelType: z.enum(FUEL_TYPES).optional(),
      color: z.string().trim().optional(),
      odometer: z.number().min(0).optional(),
    })
    .default({}),
  job: z
    .object({
      serviceType: z.enum(SERVICE_TYPES).optional(),
      description: z.string().trim().min(1).optional(),
      laborTotal: z.number().min(0).optional(),
      partsTotal: z.number().min(0).optional(),
    })
    .default({}),
});

export const ParseVoiceIntakeSchema = z.object({
  transcript: z.string().trim().min(1).max(4000),
  draft: VoiceDraftSchema.optional(),
});

export const ConfirmVoiceIntakeSchema = z.object({
  draft: VoiceDraftSchema,
  /** Staff must be attached to a center; admins have to say which one. */
  serviceCenterId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId")
    .optional(),
});

export type VoiceDraft = z.infer<typeof VoiceDraftSchema>;
export type ParseVoiceIntakeDTO = z.infer<typeof ParseVoiceIntakeSchema>;
export type ConfirmVoiceIntakeDTO = z.infer<typeof ConfirmVoiceIntakeSchema>;
