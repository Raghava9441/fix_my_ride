import { z } from "zod";
import { registry } from "../registry";
import { successEnvelope, paginatedEnvelope, commonErrorResponses, BEARER_AUTH, IdParamSchema, PaginationQuerySchema } from "../common";
import {
  CreateServiceRecordSchema,
  UpdateServiceRecordSchema,
  AddPartSchema,
  UpdatePartSchema,
  UpdateStatusSchema,
  SetNextServiceSchema,
} from "../../dto/service-record.dto";

const TAGS = ["Service Records"];
const record = z.record(z.any());
const jsonBody = <T extends z.ZodTypeAny>(schema: T) => ({ body: { content: { "application/json": { schema } } } });
const withId = (extra: z.ZodRawShape) => IdParamSchema.extend(extra);
const base = "/api/v1/service-records";

registry.registerPath({
  method: "get", path: base, tags: TAGS, summary: "List service records", security: BEARER_AUTH,
  request: { query: PaginationQuerySchema.extend({ vehicleId: z.string().optional(), ownerId: z.string().optional(), serviceCenterId: z.string().optional(), status: z.string().optional() }) },
  responses: { 200: { description: "Service records", content: { "application/json": { schema: paginatedEnvelope("ServiceRecordListResponse", record) } } }, ...commonErrorResponses() },
});

registry.registerPath({
  method: "get", path: `${base}/{id}`, tags: TAGS, summary: "Get a service record by id", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Service record", content: { "application/json": { schema: successEnvelope("ServiceRecordResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "post", path: base, tags: TAGS, summary: "Create a service record", security: BEARER_AUTH, request: jsonBody(CreateServiceRecordSchema),
  responses: { 201: { description: "Service record created", content: { "application/json": { schema: successEnvelope("ServiceRecordResponse", record) } } }, ...commonErrorResponses({ notFound: true, validate: true }) },
});

registry.registerPath({
  method: "put", path: `${base}/{id}`, tags: TAGS, summary: "Update a service record", security: BEARER_AUTH, request: { params: IdParamSchema, ...jsonBody(UpdateServiceRecordSchema) },
  responses: { 200: { description: "Service record updated", content: { "application/json": { schema: successEnvelope("ServiceRecordResponse", record) } } }, ...commonErrorResponses({ notFound: true, validate: true }) },
});

registry.registerPath({
  method: "delete", path: `${base}/{id}`, tags: TAGS, summary: "Soft-delete a service record", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Service record deleted", content: { "application/json": { schema: successEnvelope("ServiceRecordDeletedResponse", z.object({ id: z.string(), deleted: z.boolean() })) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "get", path: `${base}/{id}/parts`, tags: TAGS, summary: "Get parts replaced on a service record", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Parts", content: { "application/json": { schema: successEnvelope("ServiceRecordPartsResponse", z.array(record)) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "post", path: `${base}/{id}/parts`, tags: TAGS, summary: "Add a replaced part to a service record", security: BEARER_AUTH, request: { params: IdParamSchema, ...jsonBody(AddPartSchema) },
  responses: { 201: { description: "Part added", content: { "application/json": { schema: successEnvelope("ServiceRecordResponse", record) } } }, ...commonErrorResponses({ notFound: true, validate: true }) },
});

registry.registerPath({
  method: "put", path: `${base}/{id}/parts/{partId}`, tags: TAGS, summary: "Update a replaced part", security: BEARER_AUTH, request: { params: withId({ partId: z.string() }), ...jsonBody(UpdatePartSchema) },
  responses: { 200: { description: "Part updated", content: { "application/json": { schema: successEnvelope("ServiceRecordResponse", record) } } }, ...commonErrorResponses({ notFound: true, validate: true }) },
});

registry.registerPath({
  method: "delete", path: `${base}/{id}/parts/{partId}`, tags: TAGS, summary: "Remove a replaced part", security: BEARER_AUTH, request: { params: withId({ partId: z.string() }) },
  responses: { 200: { description: "Part removed", content: { "application/json": { schema: successEnvelope("ServiceRecordResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "patch", path: `${base}/{id}/status`, tags: TAGS, summary: "Update a service record's status", security: BEARER_AUTH, request: { params: IdParamSchema, ...jsonBody(UpdateStatusSchema) },
  responses: { 200: { description: "Status updated", content: { "application/json": { schema: successEnvelope("ServiceRecordResponse", record) } } }, ...commonErrorResponses({ notFound: true, validate: true }) },
});

registry.registerPath({
  method: "get", path: `${base}/{id}/next-service`, tags: TAGS, summary: "Get the recommended next-service info", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Next service", content: { "application/json": { schema: successEnvelope("ServiceRecordNextServiceResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "post", path: `${base}/{id}/next-service`, tags: TAGS, summary: "Set the recommended next-service info", security: BEARER_AUTH, request: { params: IdParamSchema, ...jsonBody(SetNextServiceSchema) },
  responses: { 200: { description: "Next service set", content: { "application/json": { schema: successEnvelope("ServiceRecordResponse", record) } } }, ...commonErrorResponses({ notFound: true, validate: true }) },
});

// Not implemented: no itemized labor array, no document storage wired here,
// no Invoice service, and no feedback field on ServiceRecord — see
// ServiceRecordController for the exact reasoning behind each.
const notImplemented: Array<["get" | "post" | "delete", string, string]> = [
  ["get", "/labor", "Get itemized labor lines (not implemented — only a single cost.laborTotal exists)"],
  ["post", "/labor", "Add a labor line (not implemented — only a single cost.laborTotal exists)"],
  ["get", "/documents", "List attached documents (not implemented here — use GET /api/v1/documents/entity/service_record/{id})"],
  ["post", "/documents", "Upload a document (not implemented here — use POST /api/v1/documents/upload)"],
  ["get", "/invoice", "Get the generated invoice (not implemented — no invoice.service.ts yet)"],
  ["post", "/invoice/generate", "Generate an invoice (not implemented — no invoice.service.ts yet)"],
  ["get", "/invoice/download", "Download the invoice (not implemented — no invoice.service.ts yet)"],
  ["get", "/feedback", "Get customer feedback (not implemented — no feedback field on the schema)"],
  ["post", "/feedback", "Add customer feedback (not implemented — no feedback field on the schema)"],
];

for (const [method, suffix, summary] of notImplemented) {
  registry.registerPath({
    method, path: `${base}/{id}${suffix}`, tags: TAGS, summary, security: BEARER_AUTH,
    request: { params: IdParamSchema },
    responses: { 501: { description: "Not implemented" }, ...commonErrorResponses() },
  });
}

registry.registerPath({
  method: "delete", path: `${base}/{id}/documents/{documentId}`, tags: TAGS, summary: "Delete an attached document (not implemented here — use DELETE /api/v1/documents/{id})", security: BEARER_AUTH,
  request: { params: withId({ documentId: z.string() }) },
  responses: { 501: { description: "Not implemented" }, ...commonErrorResponses() },
});
