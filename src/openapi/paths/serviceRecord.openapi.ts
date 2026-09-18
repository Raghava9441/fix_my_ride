import { z } from "zod";
import { registry } from "../registry";
import { successEnvelope, paginatedEnvelope, commonErrorResponses, entityDocumentUploadBody, BEARER_AUTH, IdParamSchema, PaginationQuerySchema } from "../common";
import {
  CreateServiceRecordSchema,
  UpdateServiceRecordSchema,
  AddPartSchema,
  UpdatePartSchema,
  UpdateStatusSchema,
  SetNextServiceSchema,
  GenerateInvoiceSchema,
  AddLaborSchema,
  AddFeedbackSchema,
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

registry.registerPath({
  method: "get", path: `${base}/{id}/labor`, tags: TAGS, summary: "List the itemised labour lines on a service record", security: BEARER_AUTH,
  request: { params: IdParamSchema },
  responses: {
    200: { description: "Labour lines", content: { "application/json": { schema: successEnvelope("ServiceRecordLaborResponse", z.array(record)) } } },
    ...commonErrorResponses({ notFound: true }),
  },
});

registry.registerPath({
  method: "post", path: `${base}/{id}/labor`, tags: TAGS,
  summary: "Add a labour line to a service record",
  description: "`total` is derived from hours x rate when omitted. `cost.laborTotal` (and therefore subtotal and total) is recomputed from all labour lines on every add.",
  security: BEARER_AUTH,
  request: { params: IdParamSchema, ...jsonBody(AddLaborSchema) },
  responses: {
    201: { description: "Labour line added", content: { "application/json": { schema: successEnvelope("ServiceRecordLaborAddedResponse", record) } } },
    ...commonErrorResponses({ notFound: true, validate: true }),
  },
});

registry.registerPath({
  method: "get", path: `${base}/{id}/feedback`, tags: TAGS, summary: "Get the customer feedback on a service record", security: BEARER_AUTH,
  request: { params: IdParamSchema },
  responses: {
    200: { description: "Feedback, or null if none submitted", content: { "application/json": { schema: successEnvelope("ServiceRecordFeedbackResponse", record.nullable()) } } },
    ...commonErrorResponses({ notFound: true }),
  },
});

registry.registerPath({
  method: "post", path: `${base}/{id}/feedback`, tags: TAGS,
  summary: "Submit customer feedback on a service record",
  description: "One feedback entry per record — submitting again replaces the previous one. The submitting account is recorded from the access token.",
  security: BEARER_AUTH,
  request: { params: IdParamSchema, ...jsonBody(AddFeedbackSchema) },
  responses: {
    201: { description: "Feedback submitted", content: { "application/json": { schema: successEnvelope("ServiceRecordFeedbackSubmittedResponse", record) } } },
    ...commonErrorResponses({ notFound: true, validate: true }),
  },
});

registry.registerPath({
  method: "get", path: `${base}/{id}/invoice`, tags: TAGS, summary: "Get the invoice raised against this service record", security: BEARER_AUTH,
  request: { params: IdParamSchema },
  responses: {
    200: { description: "Invoice", content: { "application/json": { schema: successEnvelope("ServiceRecordInvoiceResponse", record) } } },
    ...commonErrorResponses({ notFound: true }),
  },
});

registry.registerPath({
  method: "post", path: `${base}/{id}/invoice/generate`, tags: TAGS,
  summary: "Generate an invoice from this service record's parts and labour",
  description: "Builds one line item per replaced part plus a single labour line (ServiceRecord stores only `cost.laborTotal`, not itemised labour). Omitted body fields fall back to the record's own `cost` figures. Fails with 409 if a non-void invoice already exists for the record.",
  security: BEARER_AUTH,
  request: { params: IdParamSchema, ...jsonBody(GenerateInvoiceSchema) },
  responses: {
    201: { description: "Invoice generated", content: { "application/json": { schema: successEnvelope("ServiceRecordInvoiceGeneratedResponse", record) } } },
    409: { description: "An invoice already exists for this service record" },
    ...commonErrorResponses({ notFound: true, validate: true }),
  },
});

registry.registerPath({
  method: "get", path: `${base}/{id}/invoice/download`, tags: TAGS,
  summary: "Download the invoice as a spreadsheet",
  description: "Returns .xlsx rather than PDF — `exceljs` is already a dependency whereas no PDF generator is, the same constraint documented on POST /api/v1/reports/export.",
  security: BEARER_AUTH,
  request: { params: IdParamSchema },
  responses: {
    200: { description: "Invoice workbook", content: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { schema: { type: "string", format: "binary" } } } },
    ...commonErrorResponses({ notFound: true }),
  },
});

registry.registerPath({
  method: "get", path: `${base}/{id}/documents`, tags: TAGS, summary: "List documents attached to a service record", security: BEARER_AUTH,
  request: { params: IdParamSchema, query: z.object({ type: z.string().optional() }) },
  responses: { 200: { description: "Documents", content: { "application/json": { schema: successEnvelope("ServiceRecordDocumentsResponse", z.array(record)) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "post", path: `${base}/{id}/documents`, tags: TAGS, summary: "Attach a document to a service record (multipart/form-data)", security: BEARER_AUTH,
  request: { params: IdParamSchema, ...entityDocumentUploadBody() },
  responses: {
    201: { description: "Document uploaded", content: { "application/json": { schema: successEnvelope("ServiceRecordDocumentUploadResponse", record) } } },
    400: { description: "No file uploaded, or unsupported file type" },
    ...commonErrorResponses({ notFound: true, validate: true }),
  },
});

registry.registerPath({
  method: "delete", path: `${base}/{id}/documents/{documentId}`, tags: TAGS, summary: "Soft-delete a service record document and remove the stored file", security: BEARER_AUTH,
  request: { params: withId({ documentId: z.string() }) },
  responses: { 200: { description: "Document deleted", content: { "application/json": { schema: successEnvelope("ServiceRecordDocumentDeletedResponse", z.object({ id: z.string(), deleted: z.boolean() })) } } }, ...commonErrorResponses({ notFound: true }) },
});
