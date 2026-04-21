import { z } from "zod";

const ObjectIdSchema = z
  .string()
  .refine((val) => /^[0-9a-fA-F]{24}$/.test(val), {
    message: "Invalid ObjectId",
  });

// ========== PAYMENT DTOs ==========

export const CreatePaymentSchema = z.object({
  accountId: ObjectIdSchema,
  serviceCenterId: ObjectIdSchema.optional(),
  tenantId: ObjectIdSchema.optional(),
  type: z.enum(["subscription", "invoice", "one_time", "refund"]),
  amount: z.number().min(0),
  taxAmount: z.number().min(0).default(0),
  discountAmount: z.number().min(0).default(0),
  totalAmount: z.number().min(0),
  provider: z.enum(["stripe", "paypal", "razorpay", "bank_transfer", "cash"]),
  providerPaymentId: z.string().optional(),
  providerCustomerId: z.string().optional(),
  providerSubscriptionId: z.string().optional(),
  invoiceId: ObjectIdSchema.optional(),
  subscriptionId: ObjectIdSchema.optional(),
  serviceRecordIds: z.array(ObjectIdSchema).optional(),
  description: z.string().optional(),
  billingEmail: z.string().email(),
  billingName: z.string().optional(),
  billingAddress: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      postalCode: z.string().optional(),
    })
    .optional(),
  metadata: z.record(z.any()).optional(),
});

export const UpdatePaymentStatusSchema = z.object({
  status: z.enum([
    "pending",
    "completed",
    "failed",
    "refunded",
    "disputed",
    "cancelled",
  ]),
  paidAt: z.string().datetime().optional(),
  failedAt: z.string().datetime().optional(),
  failureReason: z.string().optional(),
});

export const RefundPaymentSchema = z.object({
  refundAmount: z.number().min(0),
  refundReason: z.string().optional(),
});

// Types
export type CreatePaymentDTO = z.infer<typeof CreatePaymentSchema>;
export type UpdatePaymentStatusDTO = z.infer<typeof UpdatePaymentStatusSchema>;
export type RefundPaymentDTO = z.infer<typeof RefundPaymentSchema>;
