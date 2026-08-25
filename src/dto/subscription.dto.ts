import { z } from "zod";

const ObjectIdSchema = z
  .string()
  .refine((val) => /^[0-9a-fA-F]{24}$/.test(val), {
    message: "Invalid ObjectId",
  });

// ========== SUBSCRIPTION DTOs ==========

export const CreateSubscriptionSchema = z.object({
  planId: ObjectIdSchema,
  serviceCenterId: ObjectIdSchema.optional(),
});

export const CancelSubscriptionSchema = z.object({
  reason: z.string().optional(),
  immediate: z.boolean().default(false),
});

// Types
export type CreateSubscriptionDTO = z.infer<typeof CreateSubscriptionSchema>;
export type CancelSubscriptionDTO = z.infer<typeof CancelSubscriptionSchema>;
