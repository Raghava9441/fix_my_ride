import { z } from "zod";

const ObjectIdSchema = z
  .string()
  .refine((val) => /^[0-9a-fA-F]{24}$/.test(val), {
    message: "Invalid ObjectId",
  });

const AddressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
});

// ========== INVOICE DTOs ==========

export const CreateInvoiceSchema = z.object({
  accountId: ObjectIdSchema,
  serviceCenterId: ObjectIdSchema.optional(),
  serviceRecordIds: z.array(ObjectIdSchema).optional(),
  lineItems: z
    .array(
      z.object({
        description: z.string().optional(),
        quantity: z.number().min(0).default(1),
        unitPrice: z.number().min(0),
      }),
    )
    .min(1),
  taxAmount: z.number().min(0).default(0),
  discountAmount: z.number().min(0).default(0),
  dueDate: z.string().datetime(),
  notes: z.string().optional(),
  billingEmail: z.string().email().optional(),
  billingName: z.string().optional(),
  billingAddress: AddressSchema.optional(),
});

export const RecordInvoicePaymentSchema = z.object({
  amount: z.number().positive(),
});

export const VoidInvoiceSchema = z.object({
  reason: z.string().optional(),
});

// Types
export type CreateInvoiceDTO = z.infer<typeof CreateInvoiceSchema>;
export type RecordInvoicePaymentDTO = z.infer<typeof RecordInvoicePaymentSchema>;
export type VoidInvoiceDTO = z.infer<typeof VoidInvoiceSchema>;
