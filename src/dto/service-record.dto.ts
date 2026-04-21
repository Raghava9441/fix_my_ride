import { z } from "zod";

const ObjectIdSchema = z
  .string()
  .refine((val) => /^[0-9a-fA-F]{24}$/.test(val), {
    message: "Invalid ObjectId",
  });

// ========== SERVICE RECORD DTOs ==========

export const CreateServiceRecordSchema = z.object({
  tenantId: ObjectIdSchema.optional(),
  vehicleId: ObjectIdSchema,
  serviceCenterId: ObjectIdSchema,
  technicianId: ObjectIdSchema.optional(),
  ownerId: ObjectIdSchema,
  serviceDate: z.string().datetime().default(new Date().toISOString()),
  serviceType: z.enum([
    "oil_change",
    "brake_service",
    "tire_rotation",
    "repair",
    "maintenance",
    "inspection",
    "other",
  ]),
  odometerReading: z.object({
    value: z.number().min(0),
    unit: z.enum(["km", "miles"]).default("km"),
  }),
  description: z.string().min(1),
  cost: z.object({
    partsTotal: z.number().min(0).default(0),
    laborTotal: z.number().min(0).default(0),
    subtotal: z.number().min(0).default(0),
    tax: z.number().min(0).default(0),
    discount: z.number().min(0).default(0),
    total: z.number().min(0).default(0),
    currency: z.string().default("USD"),
    paymentStatus: z
      .enum(["pending", "paid", "partial", "waived"])
      .default("pending"),
    invoiceNumber: z.string().optional(),
  }),
  partsReplaced: z
    .array(
      z.object({
        partName: z.string(),
        partNumber: z.string().optional(),
        quantity: z.number().min(1),
        unitCost: z.number().min(0),
        totalCost: z.number().min(0),
        warrantyMonths: z.number().optional(),
      }),
    )
    .optional(),
  nextService: z
    .object({
      recommendedDate: z.string().datetime().optional(),
      recommendedOdometer: z.number().optional(),
      serviceType: z.string().optional(),
    })
    .optional(),
  status: z
    .enum(["scheduled", "in_progress", "completed", "cancelled"])
    .default("scheduled"),
  createdBy: z.object({
    accountId: ObjectIdSchema,
    role: z.enum(["owner", "staff"]),
  }),
});

export const UpdateServiceRecordSchema = z
  .object({
    serviceDate: z.string().datetime().optional(),
    serviceType: z
      .enum([
        "oil_change",
        "brake_service",
        "tire_rotation",
        "repair",
        "maintenance",
        "inspection",
        "other",
      ])
      .optional(),
    odometerReading: z
      .object({
        value: z.number().min(0),
        unit: z.enum(["km", "miles"]),
      })
      .optional(),
    description: z.string().min(1).optional(),
    cost: z
      .object({
        partsTotal: z.number().min(0).optional(),
        laborTotal: z.number().min(0).optional(),
        subtotal: z.number().min(0).optional(),
        tax: z.number().min(0).optional(),
        discount: z.number().min(0).optional(),
        total: z.number().min(0).optional(),
        paymentStatus: z
          .enum(["pending", "paid", "partial", "waived"])
          .optional(),
      })
      .optional(),
    status: z
      .enum(["scheduled", "in_progress", "completed", "cancelled"])
      .optional(),
    technicianId: ObjectIdSchema.optional(),
  })
  .partial();

export const AddPartSchema = z.object({
  partName: z.string().min(1),
  partNumber: z.string().optional(),
  quantity: z.number().min(1),
  unitCost: z.number().min(0),
  totalCost: z.number().min(0),
  warrantyMonths: z.number().optional(),
});

export const UpdatePartSchema = z.object({
  partName: z.string().min(1).optional(),
  partNumber: z.string().optional(),
  quantity: z.number().min(1).optional(),
  unitCost: z.number().min(0).optional(),
  totalCost: z.number().min(0).optional(),
  warrantyMonths: z.number().optional(),
});

export const AddLaborSchema = z.object({
  description: z.string().min(1),
  hours: z.number().min(0),
  rate: z.number().min(0),
  total: z.number().min(0),
});

export const UpdateStatusSchema = z.object({
  status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]),
});

export const AddFeedbackSchema = z.object({
  rating: z.number().min(1).max(5),
  comment: z.string().min(1).max(1000),
});

export const SetNextServiceSchema = z.object({
  date: z.string().datetime(),
  mileage: z.number().min(0),
  serviceType: z.string().optional(),
});

export const GenerateInvoiceSchema = z.object({
  dueDate: z.string().datetime().optional(),
  taxRate: z.number().min(0).max(100).default(0),
});

// Types
export type CreateServiceRecordDTO = z.infer<typeof CreateServiceRecordSchema>;
export type UpdateServiceRecordDTO = z.infer<typeof UpdateServiceRecordSchema>;
export type AddPartDTO = z.infer<typeof AddPartSchema>;
export type UpdatePartDTO = z.infer<typeof UpdatePartSchema>;
export type AddLaborDTO = z.infer<typeof AddLaborSchema>;
export type UpdateStatusDTO = z.infer<typeof UpdateStatusSchema>;
export type AddFeedbackDTO = z.infer<typeof AddFeedbackSchema>;
export type SetNextServiceDTO = z.infer<typeof SetNextServiceSchema>;
export type GenerateInvoiceDTO = z.infer<typeof GenerateInvoiceSchema>;
