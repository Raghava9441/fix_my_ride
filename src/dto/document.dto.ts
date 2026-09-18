import { z } from "zod";

const ObjectIdSchema = z
  .string()
  .refine((val) => /^[0-9a-fA-F]{24}$/.test(val), {
    message: "InvalidObjectId",
  });

// ========== DOCUMENT DTOs ==========

export const UploadDocumentSchema = z.object({
  tenantId: ObjectIdSchema.optional(),
  accountId: ObjectIdSchema.optional(),
  entityType: z.enum([
    "vehicle",
    "service_record",
    "service_center",
    "owner_profile",
    "staff_profile",
    "invoice",
    "subscription",
    "audit",
    "other",
  ]),
  entityId: ObjectIdSchema,
  documentType: z.enum([
    "registration",
    "insurance",
    "puc",
    "invoice",
    "warranty",
    "service_history",
    "photo",
    "video",
    "report",
    "contract",
    "id_proof",
    "certificate",
    "other",
  ]),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().default(false),
  allowedRoles: z.array(z.string()).optional(),
  allowedAccounts: z.array(ObjectIdSchema).optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
});

export const UpdateDocumentSchema = z
  .object({
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    isPublic: z.boolean().optional(),
    allowedRoles: z.array(z.string()).optional(),
    allowedAccounts: z.array(ObjectIdSchema).optional(),
    validFrom: z.string().datetime().optional(),
    validUntil: z.string().datetime().optional(),
  })
  .partial();

export const VerifyDocumentSchema = z.object({
  verifiedBy: ObjectIdSchema,
});

export const QueryDocumentsSchema = z.object({
  type: z
    .enum([
      "registration",
      "insurance",
      "puc",
      "invoice",
      "warranty",
      "service_history",
      "photo",
      "video",
      "report",
      "contract",
      "id_proof",
      "certificate",
      "other",
    ])
    .optional(),
  includeDeleted: z.boolean().default(false),
});

// Types
export type UploadDocumentDTO = z.infer<typeof UploadDocumentSchema>;
export type UpdateDocumentDTO = z.infer<typeof UpdateDocumentSchema>;
export type VerifyDocumentDTO = z.infer<typeof VerifyDocumentSchema>;
export type QueryDocumentsDTO = z.infer<typeof QueryDocumentsSchema>;

// ========== PER-ENTITY DOCUMENT DTOs ==========

/**
 * Multipart form fields always arrive as strings, so the booleans/arrays that
 * `UploadDocumentSchema` declares natively need coercing before they parse.
 */
const multipartBoolean = z.preprocess(
  (val) => (typeof val === "string" ? val === "true" : val),
  z.boolean(),
);

const multipartStringArray = z.preprocess(
  (val) =>
    typeof val === "string"
      ? val
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean)
      : val,
  z.array(z.string()),
);

/**
 * Body schema for the per-entity document endpoints
 * (`POST /api/v1/vehicles/:id/documents` and its service-record /
 * service-center siblings). `entityType` is fixed by which router the request
 * hit and `entityId` comes from the `:id` path param, so both are omitted
 * here rather than being accepted from the client — otherwise a caller could
 * attach a file to an entity other than the one in the URL.
 */
export const UploadEntityDocumentSchema = UploadDocumentSchema.omit({
  entityType: true,
  entityId: true,
}).extend({
  tags: multipartStringArray.optional(),
  isPublic: multipartBoolean.optional().default(false),
  allowedRoles: multipartStringArray.optional(),
  allowedAccounts: multipartStringArray.optional(),
});

export type UploadEntityDocumentDTO = z.infer<typeof UploadEntityDocumentSchema>;
