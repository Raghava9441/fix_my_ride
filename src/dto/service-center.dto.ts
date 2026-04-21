import { z } from "zod";

const ObjectIdSchema = z
  .string()
  .refine((val) => /^[0-9a-fA-F]{24}$/.test(val), {
    message: "Invalid ObjectId",
  });

// ========== SERVICE CENTER DTOs ==========

export const CreateServiceCenterSchema = z.object({
  tenantId: ObjectIdSchema.optional(),
  name: z.string().min(1).max(100).trim(),
  slug: z.string().min(1).max(100).toLowerCase().trim().optional(),
  businessRegistrationNumber: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  website: z.string().url().optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().min(1),
    state: z.string().optional(),
    country: z.string().default("US"),
    postalCode: z.string().optional(),
    coordinates: z.tuple([z.number(), z.number()]).optional(),
  }),
  subscription: z.object({
    planId: ObjectIdSchema,
    status: z
      .enum(["trial", "active", "expired", "suspended", "cancelled"])
      .default("trial"),
    trialEndsAt: z.string().datetime().optional(),
  }),
  settings: z.object({
    currency: z.enum(["USD", "eur", "gbp", "inr", "aed"]).default("USD"),
    timezone: z.string().default("America/New_York"),
    businessHours: z
      .record(
        z.object({
          open: z.string().optional(),
          close: z.string().optional(),
          closed: z.boolean().default(false),
        }),
      )
      .optional(),
  }),
  servicesOffered: z
    .array(
      z.object({
        name: z.string(),
        category: z.string(),
        duration: z.number().min(0),
        basePrice: z.number().min(0),
        isActive: z.boolean().default(true),
      }),
    )
    .optional(),
  createdBy: ObjectIdSchema,
});

export const UpdateServiceCenterSchema = z
  .object({
    name: z.string().min(1).max(100).trim().optional(),
    businessRegistrationNumber: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().min(1).optional(),
    website: z.string().url().optional(),
    address: z
      .object({
        street: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        postalCode: z.string().optional(),
        coordinates: z.tuple([z.number(), z.number()]).optional(),
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
    settings: z
      .object({
        currency: z.enum(["USD", "eur", "gbp", "inr", "aed"]).optional(),
        timezone: z.string().optional(),
        businessHours: z
          .record(
            z.object({
              open: z.string().optional(),
              close: z.string().optional(),
              closed: z.boolean().optional(),
            }),
          )
          .optional(),
      })
      .optional(),
    servicesOffered: z
      .array(
        z.object({
          name: z.string(),
          category: z.string(),
          duration: z.number().min(0),
          basePrice: z.number().min(0),
          isActive: z.boolean(),
        }),
      )
      .optional(),
  })
  .partial();

export const UpdateServiceSettingsSchema = z.object({
  settings: z.object({
    currency: z.enum(["USD", "eur", "gbp", "inr", "aed"]).optional(),
    timezone: z.string().optional(),
    businessHours: z
      .record(
        z.object({
          open: z.string().optional(),
          close: z.string().optional(),
          closed: z.boolean().optional(),
        }),
      )
      .optional(),
    allowOnlineBooking: z.boolean().optional(),
  }),
});

export const AddServiceSchema = z.object({
  name: z.string().min(1),
  category: z.string(),
  duration: z.number().min(0),
  basePrice: z.number().min(0),
  isActive: z.boolean().default(true),
});

export const UpdateServiceSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().optional(),
  duration: z.number().min(0).optional(),
  basePrice: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const CreateReviewSchema = z.object({
  rating: z.number().min(1).max(5),
  comment: z.string().min(1).max(1000),
});

// Types
export type CreateServiceCenterDTO = z.infer<typeof CreateServiceCenterSchema>;
export type UpdateServiceCenterDTO = z.infer<typeof UpdateServiceCenterSchema>;
export type UpdateServiceSettingsDTO = z.infer<
  typeof UpdateServiceSettingsSchema
>;
export type AddServiceDTO = z.infer<typeof AddServiceSchema>;
export type UpdateServiceDTO = z.infer<typeof UpdateServiceSchema>;
export type CreateReviewDTO = z.infer<typeof CreateReviewSchema>;
