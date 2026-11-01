import { z } from "zod";
import { registry } from "../registry";
import { successEnvelope, paginatedEnvelope, commonErrorResponses, BEARER_AUTH, IdParamSchema, PaginationQuerySchema } from "../common";
import { UpdateDocumentSchema } from "../../dto/document.dto";

const TAGS = ["Documents"];
const record = z.record(z.any());
const jsonBody = <T extends z.ZodTypeAny>(schema: T) => ({ body: { content: { "application/json": { schema } } } });
const base = "/api/v1/documents";

registry.registerPath({
  method: "get", path: base, tags: TAGS, summary: "List documents", security: BEARER_AUTH,
  request: { query: PaginationQuerySchema.extend({ accountId: z.string().optional(), entityType: z.string().optional(), entityId: z.string().optional(), documentType: z.string().optional(), status: z.string().optional(), q: z.string().optional().describe("Free text over file name, description and tags"), tags: z.string().optional().describe("Comma-separated; matches any"), isVerified: z.enum(["true", "false"]).optional(), expiry: z.enum(["expired", "expiring"]).optional().describe("expired = past validUntil; expiring = within 30 days"), sort: z.enum(["createdAt", "-createdAt", "validUntil", "-validUntil", "size", "-size", "originalName", "-originalName"]).optional() }) },
  responses: { 200: { description: "Documents", content: { "application/json": { schema: paginatedEnvelope("DocumentListResponse", record) } } }, ...commonErrorResponses() },
});

registry.registerPath({
  method: "get", path: `${base}/entity/{entityType}/{entityId}`, tags: TAGS, summary: "List documents attached to a specific entity", security: BEARER_AUTH,
  request: { params: z.object({ entityType: z.string(), entityId: z.string() }), query: z.object({ type: z.string().optional(), includeDeleted: z.coerce.boolean().optional() }) },
  responses: { 200: { description: "Documents", content: { "application/json": { schema: successEnvelope("EntityDocumentsResponse", z.array(record)) } } }, ...commonErrorResponses() },
});

registry.registerPath({
  method: "post", path: `${base}/upload`, tags: TAGS, summary: "Upload a document (multipart/form-data)", security: BEARER_AUTH,
  request: {
    body: {
      content: {
        "multipart/form-data": {
          schema: z.object({
            file: z.string().openapi({ type: "string", format: "binary" }),
            entityType: z.enum(["vehicle", "service_record", "service_center", "owner_profile", "staff_profile", "invoice", "subscription", "audit", "other"]),
            entityId: z.string(),
            documentType: z.enum(["registration", "insurance", "puc", "invoice", "warranty", "service_history", "photo", "video", "report", "contract", "id_proof", "certificate", "other"]),
            description: z.string().optional(),
            tags: z.array(z.string()).optional(),
            isPublic: z.boolean().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: { description: "Document uploaded", content: { "application/json": { schema: successEnvelope("DocumentResponse", record) } } },
    400: { description: "No file uploaded, or unsupported file type" },
    ...commonErrorResponses({ validate: true }),
  },
});

registry.registerPath({
  method: "get", path: `${base}/{id}`, tags: TAGS, summary: "Get a document by id", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Document", content: { "application/json": { schema: successEnvelope("DocumentResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "put", path: `${base}/{id}`, tags: TAGS, summary: "Update a document's metadata", security: BEARER_AUTH, request: { params: IdParamSchema, ...jsonBody(UpdateDocumentSchema) },
  responses: { 200: { description: "Document updated", content: { "application/json": { schema: successEnvelope("DocumentResponse", record) } } }, ...commonErrorResponses({ notFound: true, validate: true }) },
});

registry.registerPath({
  method: "post", path: `${base}/{id}/verify`, tags: TAGS, summary: "Mark a document as verified", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Document verified", content: { "application/json": { schema: successEnvelope("DocumentResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "post", path: `${base}/{id}/archive`, tags: TAGS, summary: "Archive a document", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Document archived", content: { "application/json": { schema: successEnvelope("DocumentResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "get", path: `${base}/{id}/download`, tags: TAGS, summary: "Download the underlying file", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: {
    200: { description: "File contents", content: { "application/octet-stream": { schema: { type: "string", format: "binary" } } } },
    403: { description: "Not accessible to the current user" },
    ...commonErrorResponses({ notFound: true }),
  },
});

registry.registerPath({
  method: "delete", path: `${base}/{id}`, tags: TAGS, summary: "Soft-delete a document (also removes the underlying file)", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Document deleted", content: { "application/json": { schema: successEnvelope("DocumentDeletedResponse", z.object({ id: z.string(), deleted: z.boolean() })) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "get", path: `${base}/stats`, tags: TAGS, summary: "Totals, storage used, unverified / expired / expiring counts, and a per-type breakdown", security: BEARER_AUTH,
  responses: { 200: { description: "Statistics", content: { "application/json": { schema: successEnvelope("DocumentStatsResponse", z.object({ total: z.number(), totalBytes: z.number(), unverified: z.number(), expired: z.number(), expiringSoon: z.number(), byType: z.record(z.number()) })) } } }, ...commonErrorResponses() },
});

registry.registerPath({
  method: "get", path: `${base}/expiring`, tags: TAGS, summary: "Documents whose validUntil falls within the next N days", security: BEARER_AUTH,
  request: { query: z.object({ days: z.coerce.number().int().min(1).max(365).optional().describe("Defaults to 30") }) },
  responses: { 200: { description: "Expiring documents", content: { "application/json": { schema: successEnvelope("ExpiringDocumentsResponse", z.array(record)) } } }, ...commonErrorResponses() },
});

registry.registerPath({
  method: "get", path: `${base}/{id}/link`, tags: TAGS, summary: "Create a short-lived download link", security: BEARER_AUTH, request: { params: IdParamSchema },
  description: "Runs the same access check as /download, then returns a path usable without an Authorization header for five minutes - suitable for an anchor tag or window.open.",
  responses: { 200: { description: "Link", content: { "application/json": { schema: successEnvelope("DocumentLinkResponse", z.object({ path: z.string(), fileName: z.string(), expiresAt: z.string() })) } } }, 403: { description: "Not accessible to the current user" }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "get", path: `${base}/download/{token}`, tags: TAGS, summary: "Download a file using a link token (no Authorization header)",
  request: { params: z.object({ token: z.string() }) },
  responses: {
    200: { description: "File contents", content: { "application/octet-stream": { schema: { type: "string", format: "binary" } } } },
    401: { description: "Link is invalid or has expired" },
    404: { description: "Document not found" },
  },
});
