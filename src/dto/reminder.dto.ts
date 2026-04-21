import { z } from "zod";

const ObjectIdSchema = z
  .string()
  .refine((val) => /^[0-9a-fA-F]{24}$/.test(val), {
    message: "Invalid ObjectId",
  });

// ========== REMINDER DTOs (Based on routes - model not yet created) ==========

export const CreateReminderSchema = z.object({
  tenantId: ObjectIdSchema.optional(),
  vehicleId: ObjectIdSchema.optional(),
  serviceRecordId: ObjectIdSchema.optional(),
  ownerId: ObjectIdSchema.optional(),
  staffId: ObjectIdSchema.optional(),
  type: z.enum(["service", "insurance", "tax", "registration", "custom"]),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  dueDate: z.string().datetime(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  recurrence: z
    .object({
      enabled: z.boolean().default(false),
      frequency: z.enum(["daily", "weekly", "monthly", "yearly"]).optional(),
      interval: z.number().min(1).default(1),
      endDate: z.string().datetime().optional(),
      occurrences: z.number().optional(),
    })
    .optional(),
  notificationPreferences: z
    .object({
      email: z.boolean().default(true),
      sms: z.boolean().default(false),
      push: z.boolean().default(true),
      reminderLeadTime: z.number().min(0).default(24),
    })
    .optional(),
});

export const UpdateReminderSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().optional(),
    dueDate: z.string().datetime().optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    recurrence: z
      .object({
        enabled: z.boolean(),
        frequency: z.enum(["daily", "weekly", "monthly", "yearly"]).optional(),
        interval: z.number().min(1).optional(),
        endDate: z.string().datetime().optional(),
        occurrences: z.number().optional(),
      })
      .optional(),
    notificationPreferences: z
      .object({
        email: z.boolean(),
        sms: z.boolean(),
        push: z.boolean(),
        reminderLeadTime: z.number().min(0),
      })
      .optional(),
  })
  .partial();

export const SnoozeReminderSchema = z.object({
  until: z.string().datetime(),
});

export const BulkReminderActionSchema = z.object({
  ids: z.array(ObjectIdSchema),
});

// Types
export type CreateReminderDTO = z.infer<typeof CreateReminderSchema>;
export type UpdateReminderDTO = z.infer<typeof UpdateReminderSchema>;
export type SnoozeReminderDTO = z.infer<typeof SnoozeReminderSchema>;
export type BulkReminderActionDTO = z.infer<typeof BulkReminderActionSchema>;
