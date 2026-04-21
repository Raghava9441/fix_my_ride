import { z } from "zod";

const ObjectIdSchema = z
  .string()
  .refine((val) => /^[0-9a-fA-F]{24}$/.test(val), {
    message: "Invalid ObjectId",
  });

// ========== NOTIFICATION DTOs ==========

export const NotificationFiltersSchema = z.object({
  status: z
    .enum([
      "pending",
      "queued",
      "sent",
      "delivered",
      "failed",
      "read",
      "clicked",
      "cancelled",
    ])
    .optional(),
  type: z
    .enum([
      "service_reminder",
      "appointment_reminder",
      "appointment_confirmation",
      "appointment_cancelled",
      "invoice_generated",
      "payment_received",
      "payment_overdue",
      "vehicle_authorized",
      "vehicle_revoked",
      "invitation_received",
      "invitation_accepted",
      "service_completed",
      "review_request",
      "welcome",
      "password_reset",
      "email_verification",
      "phone_verification",
      "account_suspended",
      "account_activated",
      "subscription_expiring",
      "subscription_expired",
      "subscription_renewed",
      "subscription_upgraded",
      "subscription_downgraded",
      "promotion",
      "system_alert",
      "maintenance_update",
      "security_alert",
    ])
    .optional(),
  channel: z.enum(["email", "sms", "push", "in_app"]).optional(),
  limit: z.number().min(1).max(100).default(20),
  skip: z.number().min(0).default(0),
  unreadOnly: z.boolean().default(false),
});

export const MarkAsReadSchema = z.object({
  notificationIds: z.array(ObjectIdSchema).optional(),
});

// Types
export type NotificationFiltersDTO = z.infer<typeof NotificationFiltersSchema>;
export type MarkAsReadDTO = z.infer<typeof MarkAsReadSchema>;
