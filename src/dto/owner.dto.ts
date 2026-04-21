import { z } from "zod";

const ObjectIdSchema = z
  .string()
  .refine((val) => /^[0-9a-fA-F]{24}$/.test(val), {
    message: "Invalid ObjectId",
  });

// ========== OWNER PROFILE DTOs ==========

export const CreateOwnerSchema = z.object({
  accountId: ObjectIdSchema,
  firstName: z.string().min(1).max(50).trim(),
  lastName: z.string().min(1).max(50).trim(),
  profileImage: z.string().optional(),
  alternateEmail: z.string().email().optional(),
  alternatePhone: z.string().optional(),
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      postalCode: z.string().optional(),
    })
    .optional(),
  defaultVehicleId: ObjectIdSchema.optional(),
  preferredServiceCenterId: ObjectIdSchema.optional(),
  notificationPreferences: z
    .object({
      serviceReminders: z.object({
        email: z.boolean(),
        sms: z.boolean(),
        push: z.boolean(),
      }),
      invoiceNotifications: z.object({
        email: z.boolean(),
        sms: z.boolean(),
      }),
      centerCommunications: z.object({
        email: z.boolean(),
        sms: z.boolean(),
      }),
      quietHours: z.object({
        enabled: z.boolean(),
        start: z.string().optional(),
        end: z.string().optional(),
      }),
    })
    .optional(),
});

export const UpdateOwnerSchema = z
  .object({
    firstName: z.string().min(1).max(50).trim().optional(),
    lastName: z.string().min(1).max(50).trim().optional(),
    profileImage: z.string().optional(),
    alternateEmail: z.string().email().optional(),
    alternatePhone: z.string().optional(),
    address: z
      .object({
        street: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        postalCode: z.string().optional(),
      })
      .optional(),
    defaultVehicleId: ObjectIdSchema.optional(),
    preferredServiceCenterId: ObjectIdSchema.optional(),
    notificationPreferences: z
      .object({
        serviceReminders: z.object({
          email: z.boolean(),
          sms: z.boolean(),
          push: z.boolean(),
        }),
        invoiceNotifications: z.object({
          email: z.boolean(),
          sms: z.boolean(),
        }),
        centerCommunications: z.object({
          email: z.boolean(),
          sms: z.boolean(),
        }),
        quietHours: z.object({
          enabled: z.boolean(),
          start: z.string().optional(),
          end: z.string().optional(),
        }),
      })
      .optional(),
  })
  .partial();

export const UpdateOwnerPreferencesSchema = z.object({
  language: z.enum(["en", "es", "fr", "de", "ar", "hi"]).optional(),
  notifications: z.boolean().optional(),
  theme: z.enum(["light", "dark"]).optional(),
});

// Types
export type CreateOwnerDTO = z.infer<typeof CreateOwnerSchema>;
export type UpdateOwnerDTO = z.infer<typeof UpdateOwnerSchema>;
export type UpdateOwnerPreferencesDTO = z.infer<
  typeof UpdateOwnerPreferencesSchema
>;
