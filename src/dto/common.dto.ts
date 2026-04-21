import { z } from "zod";

// ========== COMMON DTOs ==========

export const PaginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const IdParamSchema = z.object({
  id: z.string().refine((val) => /^[0-9a-fA-F]{24}$/.test(val), {
    message: "Invalid ObjectId",
  }),
});

export const MessageSchema = z.object({
  message: z.string(),
});

// Types
export type PaginationDTO = z.infer<typeof PaginationSchema>;
export type IdParamDTO = z.infer<typeof IdParamSchema>;
export type MessageDTO = z.infer<typeof MessageSchema>;
