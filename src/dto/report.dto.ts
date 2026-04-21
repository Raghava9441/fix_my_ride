import { z } from "zod";

const ObjectIdSchema = z
  .string()
  .refine((val) => /^[0-9a-fA-F]{24}$/.test(val), {
    message: "Invalid ObjectId",
  });

// ========== REPORT DTOs ==========

export const ReportDateRangeSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  serviceCenterId: ObjectIdSchema.optional(),
});

export const ExportReportSchema = z.object({
  type: z.enum([
    "revenue",
    "vehicles",
    "services",
    "staff",
    "expenses",
    "tenant",
    "growth",
  ]),
  format: z.enum(["csv", "pdf", "excel"]).default("csv"),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// Types
export type ReportDateRangeDTO = z.infer<typeof ReportDateRangeSchema>;
export type ExportReportDTO = z.infer<typeof ExportReportSchema>;
