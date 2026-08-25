import { z } from "zod";
import { registry } from "../registry";
import { successEnvelope, paginatedEnvelope, commonErrorResponses, BEARER_AUTH, IdParamSchema, PaginationQuerySchema } from "../common";
import {
  CreateServiceCenterSchema,
  UpdateServiceCenterSchema,
  UpdateServiceSettingsSchema,
  AddServiceSchema,
  UpdateServiceSchema,
  CreateReviewSchema,
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
  method: "put", path: `${base}/{id}/services/{serviceId}`, tags: TAGS, summary: "Update a service offering (not implemented — service only supports add-by-name/remove-by-name)", security: BEARER_AUTH,
  request: { params: withId({ serviceId: z.string() }), ...jsonBody(UpdateServiceSchema) },
  responses: { 501: { description: "Not implemented" }, ...commonErrorResponses() },
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
  method: "get", path: `${base}/{id}/reviews`, tags: TAGS, summary: "List reviews (not implemented — no Review model exists)", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 501: { description: "Not implemented" }, ...commonErrorResponses() },
});

registry.registerPath({
  method: "post", path: `${base}/{id}/reviews`, tags: TAGS, summary: "Add a review (not implemented — no Review model exists)", security: BEARER_AUTH, request: { params: IdParamSchema, ...jsonBody(CreateReviewSchema) },
  responses: { 501: { description: "Not implemented" }, ...commonErrorResponses() },
});

registry.registerPath({
  method: "post", path: `${base}/{id}/verify`, tags: TAGS, summary: "Mark a center as verified (not implemented — no verified field on the schema)", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 501: { description: "Not implemented" }, ...commonErrorResponses() },
});

registry.registerPath({
  method: "post", path: `${base}/{id}/documents`, tags: TAGS, summary: "Upload a center document (not implemented here — use POST /api/v1/documents/upload)", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 501: { description: "Not implemented" }, ...commonErrorResponses() },
});

registry.registerPath({
  method: "get", path: `${base}/{id}/documents`, tags: TAGS, summary: "List center documents (not implemented here — use GET /api/v1/documents/entity/service_center/{id})", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 501: { description: "Not implemented" }, ...commonErrorResponses() },
});

registry.registerPath({
  method: "get", path: `${base}/{id}/settings`, tags: TAGS, summary: "Get a service center's settings", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Settings", content: { "application/json": { schema: successEnvelope("ServiceCenterSettingsResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "put", path: `${base}/{id}/settings`, tags: TAGS, summary: "Update a service center's settings", security: BEARER_AUTH, request: { params: IdParamSchema, ...jsonBody(UpdateServiceSettingsSchema) },
  responses: { 200: { description: "Settings updated", content: { "application/json": { schema: successEnvelope("ServiceCenterResponse", record) } } }, ...commonErrorResponses({ notFound: true, validate: true }) },
});
