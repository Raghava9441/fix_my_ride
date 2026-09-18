import { z } from "zod";

const ObjectIdSchema = z
  .string()
  .refine((val) => /^[0-9a-fA-F]{24}$/.test(val), {
    message: "Invalid ObjectId",
  });

// ========== VEHICLE DTOs ==========

export const CreateVehicleSchema = z.object({
  tenantId: ObjectIdSchema.optional(),
  registrationNumber: z.string().min(1).toUpperCase().trim(),
  vin: z.string().length(17).optional(),
  make: z.string().min(1),
  model: z.string().min(1),
  year: z
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear() + 1),
  fuelType: z.enum(["petrol", "diesel", "electric", "hybrid", "cng", "lpg"]),
  transmission: z.enum(["manual", "automatic", "cvt"]).default("manual"),
  color: z.string().optional(),
  currentOwnerId: ObjectIdSchema,
  ownershipHistory: z
    .array(
      z.object({
        ownerId: ObjectIdSchema,
        fromDate: z.string().datetime(),
        toDate: z.string().datetime().optional(),
        transferReason: z.string().optional(),
      }),
    )
    .optional(),
  authorizedServiceCenters: z
    .array(
      z.object({
        serviceCenterId: ObjectIdSchema,
        authorizedBy: ObjectIdSchema,
        accessLevel: z.enum(["full", "readonly", "limited"]).default("full"),
        status: z.enum(["active", "revoked", "expired"]).default("active"),
        isPrimary: z.boolean().default(false),
      }),
    )
    .optional(),
  currentOdometer: z
    .object({
      value: z.number().min(0),
      unit: z.enum(["km", "miles"]).default("km"),
      recordedBy: ObjectIdSchema.optional(),
    })
    .optional(),
  serviceSchedule: z
    .object({
      lastServiceDate: z.string().datetime().optional(),
      lastServiceOdometer: z.number().optional(),
      nextServiceDueDate: z.string().datetime().optional(),
      nextServiceDueOdometer: z.number().optional(),
    })
    .optional(),
});

export const UpdateVehicleSchema = z
  .object({
    registrationNumber: z.string().min(1).toUpperCase().trim().optional(),
    vin: z.string().length(17).optional(),
    make: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    year: z
      .number()
      .int()
      .min(1900)
      .max(new Date().getFullYear() + 1)
      .optional(),
    fuelType: z
      .enum(["petrol", "diesel", "electric", "hybrid", "cng", "lpg"])
      .optional(),
    transmission: z.enum(["manual", "automatic", "cvt"]).optional(),
    color: z.string().optional(),
    currentOdometer: z
      .object({
        value: z.number().min(0),
        unit: z.enum(["km", "miles"]),
        recordedBy: ObjectIdSchema.optional(),
      })
      .optional(),
    serviceSchedule: z
      .object({
        lastServiceDate: z.string().datetime().optional(),
        lastServiceOdometer: z.number().optional(),
        nextServiceDueDate: z.string().datetime().optional(),
        nextServiceDueOdometer: z.number().optional(),
      })
      .optional(),
  })
  .partial();

export const AuthorizeCenterSchema = z.object({
  centerId: ObjectIdSchema,
  accessLevel: z.enum(["full", "readonly", "limited"]).default("full"),
});

export const UpdateCenterAccessSchema = z.object({
  accessLevel: z.enum(["full", "readonly", "limited"]).optional(),
  status: z.enum(["active", "revoked", "expired"]).optional(),
});

export const UpdateOdometerSchema = z.object({
  reading: z.number().min(0),
  unit: z.enum(["km", "miles"]).default("km"),
  source: z
    .enum(["manual_entry", "service_record", "import", "api", "obd_device"])
    .default("manual_entry"),
});

export const TransferOwnershipSchema = z.object({
  newOwnerId: ObjectIdSchema,
  transferReason: z.string().optional(),
});

/**
 * PUT semantics: the whole warranty block is replaced by what's sent, so an
 * omitted field clears that field rather than leaving the stored value.
 */
export const UpdateWarrantySchema = z.object({
  provider: z.string().optional(),
  policyNumber: z.string().optional(),
  startDate: z.string().datetime().optional(),
  expiryDate: z.string().datetime().optional(),
  coverageOdometer: z.number().min(0).optional(),
  coverageType: z
    .enum(["comprehensive", "powertrain", "extended", "other"])
    .optional(),
  notes: z.string().optional(),
});

/** Same replace-don't-merge semantics as UpdateWarrantySchema. */
export const UpdateInsuranceSchema = z.object({
  provider: z.string().optional(),
  policyNumber: z.string().optional(),
  startDate: z.string().datetime().optional(),
  expiryDate: z.string().datetime().optional(),
  premium: z.number().min(0).optional(),
  coverageType: z
    .enum(["comprehensive", "third_party", "collision", "other"])
    .optional(),
  notes: z.string().optional(),
});

/** Query for `GET /api/v1/vehicles/search`. */
export const SearchVehiclesSchema = z.object({
  q: z.string().trim().min(1),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// Types
export type CreateVehicleDTO = z.infer<typeof CreateVehicleSchema>;
export type UpdateVehicleDTO = z.infer<typeof UpdateVehicleSchema>;
export type AuthorizeCenterDTO = z.infer<typeof AuthorizeCenterSchema>;
export type UpdateCenterAccessDTO = z.infer<typeof UpdateCenterAccessSchema>;
export type UpdateOdometerDTO = z.infer<typeof UpdateOdometerSchema>;
export type TransferOwnershipDTO = z.infer<typeof TransferOwnershipSchema>;
export type UpdateWarrantyDTO = z.infer<typeof UpdateWarrantySchema>;
export type UpdateInsuranceDTO = z.infer<typeof UpdateInsuranceSchema>;
export type SearchVehiclesDTO = z.infer<typeof SearchVehiclesSchema>;
