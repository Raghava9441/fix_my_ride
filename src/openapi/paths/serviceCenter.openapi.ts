import { z } from "zod";
import { registry } from "../registry";
import { successEnvelope, paginatedEnvelope, commonErrorResponses, entityDocumentUploadBody, BEARER_AUTH, IdParamSchema, PaginationQuerySchema } from "../common";
import {
  CreateServiceCenterSchema,
  UpdateServiceCenterSchema,
  UpdateServiceSettingsSchema,
  AddServiceSchema,
  UpdateServiceSchema,
  CreateReviewSchema,
  VerifyCenterSchema,
} from "../../dto/service-center.dto";

const TAGS = ["Service Centers"];
const record = z.record(z.any());
const jsonBody = <T extends z.ZodTypeAny>(schema: T) => ({ body: { content: { "application/json": { schema } } } });
const withId = (extra: z.ZodRawShape) => IdParamSchema.extend(extra);
const base = "/api/v1/service-centers";

registry.registerPath({
  method: "get", path: base, tags: TAGS, summary: "List service centers", security: BEARER_AUTH,
  request: { query: PaginationQuerySchema.extend({ tenantId: z.string().optional(), city: z.string().optional(), status: z.string().optional() }) },
  responses: { 200: { description: "Service centers", content: { "application/json": { schema: paginatedEnvelope("ServiceCenterListResponse", record) } } }, ...commonErrorResponses() },
});

registry.registerPath({
  method: "get", path: `${base}/nearby`, tags: TAGS, summary: "Find service centers near a location", security: BEARER_AUTH,
  request: { query: z.object({ lat: z.coerce.number(), lng: z.coerce.number(), maxDistance: z.coerce.number().optional().openapi({ description: "meters, default 10000" }) }) },
  responses: { 200: { description: "Nearby centers", content: { "application/json": { schema: successEnvelope("NearbyCentersResponse", z.array(record)) } } }, 400: { description: "lat/lng missing or invalid" }, ...commonErrorResponses() },
});

registry.registerPath({
  method: "get", path: `${base}/{id}`, tags: TAGS, summary: "Get a service center by id", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Service center", content: { "application/json": { schema: successEnvelope("ServiceCenterResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "post", path: base, tags: TAGS, summary: "Create a service center", security: BEARER_AUTH, request: jsonBody(CreateServiceCenterSchema),
  responses: { 201: { description: "Service center created", content: { "application/json": { schema: successEnvelope("ServiceCenterResponse", record) } } }, 409: { description: "Registration number already exists" }, ...commonErrorResponses({ notFound: true, validate: true }) },
});

registry.registerPath({
  method: "put", path: `${base}/{id}`, tags: TAGS, summary: "Update a service center", security: BEARER_AUTH, request: { params: IdParamSchema, ...jsonBody(UpdateServiceCenterSchema) },
  responses: { 200: { description: "Service center updated", content: { "application/json": { schema: successEnvelope("ServiceCenterResponse", record) } } }, ...commonErrorResponses({ notFound: true, validate: true }) },
});

registry.registerPath({
  method: "delete", path: `${base}/{id}`, tags: TAGS, summary: "Soft-delete a service center", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Service center deleted", content: { "application/json": { schema: successEnvelope("ServiceCenterDeletedResponse", z.object({ id: z.string(), deleted: z.boolean() })) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "get", path: `${base}/{id}/vehicles`, tags: TAGS, summary: "List vehicles authorized at a service center", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Vehicles", content: { "application/json": { schema: successEnvelope("ServiceCenterVehiclesResponse", z.array(record)) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "get", path: `${base}/{id}/staff`, tags: TAGS, summary: "List staff at a service center", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Staff", content: { "application/json": { schema: successEnvelope("ServiceCenterStaffResponse", z.array(record)) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "get", path: `${base}/{id}/services`, tags: TAGS, summary: "List services offered by a center", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Services offered", content: { "application/json": { schema: successEnvelope("ServiceCenterServicesResponse", z.array(record)) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "post", path: `${base}/{id}/services`, tags: TAGS, summary: "Add a service offering to a center", security: BEARER_AUTH, request: { params: IdParamSchema, ...jsonBody(AddServiceSchema) },
  responses: { 201: { description: "Service added", content: { "application/json": { schema: successEnvelope("ServiceCenterResponse", record) } } }, ...commonErrorResponses({ notFound: true, validate: true }) },
});

registry.registerPath({
  method: "put", path: `${base}/{id}/services/{serviceId}`, tags: TAGS,
  summary: "Update one service offering in place",
  description: "Addressed by the offering's subdocument id. Only the fields sent are changed; omitted fields keep their stored value.",
  security: BEARER_AUTH,
  request: { params: withId({ serviceId: z.string() }), ...jsonBody(UpdateServiceSchema) },
  responses: {
    200: { description: "Service updated", content: { "application/json": { schema: successEnvelope("ServiceCenterServiceUpdatedResponse", record) } } },
    ...commonErrorResponses({ notFound: true, validate: true }),
  },
});

registry.registerPath({
  method: "delete", path: `${base}/{id}/services/{serviceId}`, tags: TAGS, summary: "Remove a service offering", security: BEARER_AUTH, request: { params: withId({ serviceId: z.string() }) },
  responses: { 200: { description: "Service removed", content: { "application/json": { schema: successEnvelope("ServiceCenterResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "get", path: `${base}/{id}/stats`, tags: TAGS, summary: "Get a service center's cached stats", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Stats", content: { "application/json": { schema: successEnvelope("ServiceCenterStatsResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "get", path: `${base}/{id}/reviews`, tags: TAGS, summary: "List a service centre's customer reviews, newest first", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: {
    200: { description: "Reviews", content: { "application/json": { schema: successEnvelope("ServiceCenterReviewsResponse", z.array(record)) } } },
    ...commonErrorResponses({ notFound: true }),
  },
});

registry.registerPath({
  method: "post", path: `${base}/{id}/reviews`, tags: TAGS,
  summary: "Leave a review for a service centre",
  description: "One review per account per centre — posting again edits the existing review rather than adding a second rating. The centre's cached `stats.averageRating` and `stats.totalReviews` are recomputed on every write. The reviewer is taken from the access token.",
  security: BEARER_AUTH, request: { params: IdParamSchema, ...jsonBody(CreateReviewSchema) },
  responses: {
    201: { description: "Review saved", content: { "application/json": { schema: successEnvelope("ServiceCenterReviewResponse", record) } } },
    ...commonErrorResponses({ notFound: true, validate: true }),
  },
});

registry.registerPath({
  method: "post", path: `${base}/{id}/verify`, tags: TAGS,
  summary: "Mark a service centre as verified (admin only)",
  description: "Records who verified the centre and when. Send `isVerified: false` to withdraw verification. Restricted to admins — verification is a trust signal shown to customers, so a centre must not be able to verify itself.",
  security: BEARER_AUTH, request: { params: IdParamSchema, ...jsonBody(VerifyCenterSchema) },
  responses: {
    200: { description: "Verification updated", content: { "application/json": { schema: successEnvelope("ServiceCenterVerificationResponse", record) } } },
    ...commonErrorResponses({ notFound: true, validate: true }),
  },
});

registry.registerPath({
  method: "post", path: `${base}/{id}/documents`, tags: TAGS, summary: "Attach a document to a service center (multipart/form-data)", security: BEARER_AUTH,
  request: { params: IdParamSchema, ...entityDocumentUploadBody() },
  responses: {
    201: { description: "Document uploaded", content: { "application/json": { schema: successEnvelope("ServiceCenterDocumentUploadResponse", record) } } },
    400: { description: "No file uploaded, or unsupported file type" },
    ...commonErrorResponses({ notFound: true, validate: true }),
  },
});

registry.registerPath({
  method: "get", path: `${base}/{id}/documents`, tags: TAGS, summary: "List documents attached to a service center", security: BEARER_AUTH,
  request: { params: IdParamSchema, query: z.object({ type: z.string().optional() }) },
  responses: { 200: { description: "Documents", content: { "application/json": { schema: successEnvelope("ServiceCenterDocumentsResponse", z.array(record)) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "get", path: `${base}/{id}/settings`, tags: TAGS, summary: "Get a service center's settings", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Settings", content: { "application/json": { schema: successEnvelope("ServiceCenterSettingsResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "put", path: `${base}/{id}/settings`, tags: TAGS, summary: "Update a service center's settings", security: BEARER_AUTH, request: { params: IdParamSchema, ...jsonBody(UpdateServiceSettingsSchema) },
  responses: { 200: { description: "Settings updated", content: { "application/json": { schema: successEnvelope("ServiceCenterResponse", record) } } }, ...commonErrorResponses({ notFound: true, validate: true }) },
});
