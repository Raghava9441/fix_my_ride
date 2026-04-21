import { z } from "zod";

const ObjectIdSchema = z
  .string()
  .refine((val) => /^[0-9a-fA-F]{24}$/.test(val), {
    message: "Invalid ObjectId",
  });

// ========== TENANT DTOs ==========

export const CreateTenantSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100),
  description: z.string().optional(),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional(),
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().default("US"),
      postalCode: z.string().optional(),
      timezone: z.string().default("UTC"),
      currency: z.enum(["USD", "eur", "gbp", "inr", "aed"]).default("USD"),
    })
    .optional(),
  subscription: z
    .object({
      planId: ObjectIdSchema.optional(),
      status: z
        .enum(["trial", "active", "expired", "suspended", "cancelled"])
        .default("trial"),
      trialEndsAt: z.string().datetime().optional(),
    })
    .optional(),
  ownerId: ObjectIdSchema.optional(),
  settings: z
    .object({
      enableMfa: z.boolean().default(true),
      requireEmailVerification: z.boolean().default(true),
      allowSignups: z.boolean().default(true),
      sessionTimeoutMinutes: z.number().default(60),
    })
    .optional(),
  billing: z
    .object({
      companyName: z.string().optional(),
      taxId: z.string().optional(),
      billingEmail: z.string().email().optional(),
      billingAddress: z
        .object({
          street: z.string().optional(),
          city: z.string().optional(),
          state: z.string().optional(),
          country: z.string().optional(),
          postalCode: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

export const UpdateTenantSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    slug: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
    contactEmail: z.string().email().optional(),
    contactPhone: z.string().optional(),
    address: z
      .object({
        street: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        postalCode: z.string().optional(),
        timezone: z.string().optional(),
        currency: z.enum(["USD", "eur", "gbp", "inr", "aed"]).optional(),
      })
      .optional(),
    subscription: z
      .object({
        planId: ObjectIdSchema.optional(),
        status: z
          .enum(["trial", "active", "expired", "suspended", "cancelled"])
          .optional(),
        startedAt: z.string().datetime().optional(),
        expiresAt: z.string().datetime().optional(),
        trialEndsAt: z.string().datetime().optional(),
      })
      .optional(),
    limits: z
      .object({
        maxVehicles: z.number().optional(),
        maxStaff: z.number().optional(),
        maxServiceCenters: z.number().optional(),
        maxStorageGB: z.number().optional(),
        maxApiCallsPerMonth: z.number().optional(),
      })
      .optional(),
    settings: z
      .object({
        enableMfa: z.boolean().optional(),
        requireEmailVerification: z.boolean().optional(),
        allowSignups: z.boolean().optional(),
        sessionTimeoutMinutes: z.number().optional(),
      })
      .optional(),
    isActive: z.boolean().optional(),
  })
  .partial();

export const UpdateTenantStatusSchema = z.object({
  status: z.enum(["active", "inactive", "suspended", "cancelled"]),
});

// Types
export type CreateTenantDTO = z.infer<typeof CreateTenantSchema>;
export type UpdateTenantDTO = z.infer<typeof UpdateTenantSchema>;
export type UpdateTenantStatusDTO = z.infer<typeof UpdateTenantStatusSchema>;
