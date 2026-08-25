import { z } from "zod";
import { registry } from "./registry";

export const BEARER_AUTH = [{ bearerAuth: [] }];

export const IdParamSchema = registry.register(
  "IdParam",
  z.object({ id: z.string().openapi({ example: "665f1a2b3c4d5e6f7a8b9c0d" }) }),
);

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().openapi({ example: 1 }),
  limit: z.coerce.number().int().min(1).max(100).optional().openapi({ example: 20 }),
});

const PaginationMetaSchema = registry.register(
  "PaginationMeta",
  z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
    hasNext: z.boolean(),
    hasPrevious: z.boolean(),
    from: z.number(),
    to: z.number(),
  }),
);

export const ErrorResponseSchema = registry.register(
  "ErrorResponse",
  z.object({
    success: z.literal(false),
    code: z.string().openapi({ example: "VAL_001" }),
    key: z.string().openapi({ example: "validation.failed" }),
    correlationId: z.string().optional(),
    message: z.string(),
    details: z.any().optional(),
    timestamp: z.string(),
  }),
);

/** Wraps a data schema in the `createSuccessResponse` envelope. */
export function successEnvelope<T extends z.ZodTypeAny>(name: string, dataSchema: T) {
  return registry.register(
    name,
    z.object({
      success: z.literal(true),
      statusCode: z.number(),
      message: z.string(),
      data: dataSchema,
      meta: z.any().nullable(),
      timestamp: z.string(),
    }),
  );
}

/** Wraps an item schema in the `createPaginatedResponse` envelope. */
export function paginatedEnvelope<T extends z.ZodTypeAny>(name: string, itemSchema: T) {
  return registry.register(
    name,
    z.object({
      success: z.literal(true),
      statusCode: z.number(),
      message: z.string(),
      data: z.array(itemSchema),
      meta: z.object({ pagination: PaginationMetaSchema }),
      timestamp: z.string(),
    }),
  );
}

/** Standard 400/401/403/404/422 response set for the given operation. */
export function commonErrorResponses(opts: { auth?: boolean; notFound?: boolean; validate?: boolean } = {}) {
  const responses: Record<string, { description: string; content: { "application/json": { schema: typeof ErrorResponseSchema } } }> = {};
  if (opts.validate) {
    responses["422"] = { description: "Validation failed", content: { "application/json": { schema: ErrorResponseSchema } } };
  }
  if (opts.auth !== false) {
    responses["401"] = { description: "Missing or invalid access token", content: { "application/json": { schema: ErrorResponseSchema } } };
    responses["403"] = { description: "Authenticated but not authorized", content: { "application/json": { schema: ErrorResponseSchema } } };
  }
  if (opts.notFound) {
    responses["404"] = { description: "Not found", content: { "application/json": { schema: ErrorResponseSchema } } };
  }
  return responses;
}
