import { z } from "zod";

const ObjectIdSchema = z
  .string()
  .refine((val) => /^[0-9a-fA-F]{24}$/.test(val), {
    message: "Invalid ObjectId",
  });

// ========== SUBSCRIPTION PLAN DTOs ==========

export const CreateSubscriptionPlanSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  slug: z.string().min(1).max(100).toLowerCase().trim(),
  description: z.string().optional(),
  type: z.enum(["free", "basic", "professional", "enterprise", "custom"]),
  price: z.number().min(0),
  currency: z.string().default("USD"),
  billingInterval: z.enum(["month", "year"]).default("month"),
  trialDays: z.number().min(0).default(14),
  limits: z.object({
    maxVehicles: z.number().default(0),
    maxStaff: z.number().default(0),
    maxServiceCenters: z.number().default(0),
    maxStorageGB: z.number().default(0),
    maxApiCallsPerMonth: z.number().default(0),
    includedRemindersPerMonth: z.number().default(0),
    customFeatures: z.array(z.string()).default([]),
  }),
  features: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        included: z.boolean().default(true),
        limit: z.number().optional(),
      }),
    )
    .optional(),
  isActive: z.boolean().default(true),
  isPublic: z.boolean().default(true),
  displayOrder: z.number().default(0),
});

export const UpdateSubscriptionPlanSchema = z
  .object({
    name: z.string().min(1).max(100).trim().optional(),
    description: z.string().optional(),
    price: z.number().min(0).optional(),
    currency: z.string().optional(),
    billingInterval: z.enum(["month", "year"]).optional(),
    trialDays: z.number().min(0).optional(),
    limits: z
      .object({
        maxVehicles: z.number().optional(),
        maxStaff: z.number().optional(),
        maxServiceCenters: z.number().optional(),
        maxStorageGB: z.number().optional(),
        maxApiCallsPerMonth: z.number().optional(),
        includedRemindersPerMonth: z.number().optional(),
        customFeatures: z.array(z.string()).optional(),
      })
      .optional(),
    features: z
      .array(
        z.object({
          name: z.string(),
          description: z.string().optional(),
          included: z.boolean(),
          limit: z.number().optional(),
        }),
      )
      .optional(),
    isActive: z.boolean().optional(),
    isPublic: z.boolean().optional(),
    displayOrder: z.number().optional(),
  })
  .partial();

export const AssignPermissionsToPlanSchema = z.object({
  permissionIds: z.array(ObjectIdSchema),
});

// Types
export type CreateSubscriptionPlanDTO = z.infer<
  typeof CreateSubscriptionPlanSchema
>;
export type UpdateSubscriptionPlanDTO = z.infer<
  typeof UpdateSubscriptionPlanSchema
>;
export type AssignPermissionsToPlanDTO = z.infer<
  typeof AssignPermissionsToPlanSchema
>;
