import { z } from "zod";
import { registry } from "../registry";
import { successEnvelope, paginatedEnvelope, commonErrorResponses, BEARER_AUTH, IdParamSchema, PaginationQuerySchema } from "../common";
import {
  CreateVehicleSchema,
  UpdateVehicleSchema,
  AuthorizeCenterSchema,
  UpdateCenterAccessSchema,
  UpdateOdometerSchema,
  TransferOwnershipSchema,
} from "../../dto/vehicle.dto";

const TAGS = ["Vehicles"];
const record = z.record(z.any());
const jsonBody = <T extends z.ZodTypeAny>(schema: T) => ({ body: { content: { "application/json": { schema } } } });
const withId = (extra: z.ZodRawShape = {}) => IdParamSchema.extend(extra);
const base = "/api/v1/vehicles";

registry.registerPath({
  method: "get", path: base, tags: TAGS, summary: "List vehicles", security: BEARER_AUTH,
  request: { query: PaginationQuerySchema.extend({ ownerId: z.string().optional(), serviceCenterId: z.string().optional() }) },
  responses: { 200: { description: "Vehicles", content: { "application/json": { schema: paginatedEnvelope("VehicleListResponse", record) } } }, ...commonErrorResponses() },
});

registry.registerPath({
  method: "get", path: `${base}/search`, tags: TAGS, summary: "Search vehicles (not implemented — no text-search filter in the service)", security: BEARER_AUTH,
  responses: { 501: { description: "Not implemented" }, ...commonErrorResponses() },
});

registry.registerPath({
  method: "get", path: `${base}/registration/{regNumber}`, tags: TAGS, summary: "Get a vehicle by registration number", security: BEARER_AUTH,
  request: { params: z.object({ regNumber: z.string() }) },
  responses: { 200: { description: "Vehicle", content: { "application/json": { schema: successEnvelope("VehicleResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "get", path: `${base}/vin/{vin}`, tags: TAGS, summary: "Get a vehicle by VIN", security: BEARER_AUTH,
  request: { params: z.object({ vin: z.string() }) },
  responses: { 200: { description: "Vehicle", content: { "application/json": { schema: successEnvelope("VehicleResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "get", path: `${base}/{id}`, tags: TAGS, summary: "Get a vehicle by id", security: BEARER_AUTH,
  request: { params: IdParamSchema },
  responses: { 200: { description: "Vehicle", content: { "application/json": { schema: successEnvelope("VehicleResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "post", path: base, tags: TAGS, summary: "Create a vehicle", security: BEARER_AUTH, request: jsonBody(CreateVehicleSchema),
  responses: { 201: { description: "Vehicle created", content: { "application/json": { schema: successEnvelope("VehicleResponse", record) } } }, 409: { description: "Registration number already exists" }, ...commonErrorResponses({ validate: true }) },
});

registry.registerPath({
  method: "put", path: `${base}/{id}`, tags: TAGS, summary: "Update a vehicle", security: BEARER_AUTH, request: { params: IdParamSchema, ...jsonBody(UpdateVehicleSchema) },
  responses: { 200: { description: "Vehicle updated", content: { "application/json": { schema: successEnvelope("VehicleResponse", record) } } }, ...commonErrorResponses({ notFound: true, validate: true }) },
});

registry.registerPath({
  method: "delete", path: `${base}/{id}`, tags: TAGS, summary: "Soft-delete a vehicle", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Vehicle deleted", content: { "application/json": { schema: successEnvelope("VehicleDeletedResponse", z.object({ id: z.string(), deleted: z.boolean() })) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "get", path: `${base}/{id}/service-records`, tags: TAGS, summary: "Get a vehicle's service history", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Service records", content: { "application/json": { schema: successEnvelope("VehicleServiceRecordsResponse", z.array(record)) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "get", path: `${base}/{id}/service-centers`, tags: TAGS, summary: "Get a vehicle's authorized service centers", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Authorized centers", content: { "application/json": { schema: successEnvelope("VehicleCentersResponse", z.array(record)) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "post", path: `${base}/{id}/service-centers`, tags: TAGS, summary: "Authorize a service center for a vehicle", security: BEARER_AUTH, request: { params: IdParamSchema, ...jsonBody(AuthorizeCenterSchema) },
  responses: { 201: { description: "Center authorized", content: { "application/json": { schema: successEnvelope("VehicleCenterAuthorizedResponse", record) } } }, ...commonErrorResponses({ notFound: true, validate: true }) },
});

registry.registerPath({
  method: "put", path: `${base}/{id}/service-centers/{centerId}`, tags: TAGS, summary: "Update a service center's access level for a vehicle", security: BEARER_AUTH,
  request: { params: withId({ centerId: z.string() }), ...jsonBody(UpdateCenterAccessSchema) },
  responses: { 200: { description: "Access updated", content: { "application/json": { schema: successEnvelope("VehicleCenterAccessResponse", record) } } }, ...commonErrorResponses({ notFound: true, validate: true }) },
});

registry.registerPath({
  method: "delete", path: `${base}/{id}/service-centers/{centerId}`, tags: TAGS, summary: "Revoke a service center's access to a vehicle", security: BEARER_AUTH,
  request: { params: withId({ centerId: z.string() }) },
  responses: { 200: { description: "Access revoked", content: { "application/json": { schema: successEnvelope("VehicleCenterRevokedResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "get", path: `${base}/{id}/odometer`, tags: TAGS, summary: "Get a vehicle's current odometer reading", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Current odometer", content: { "application/json": { schema: successEnvelope("VehicleOdometerResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "post", path: `${base}/{id}/odometer`, tags: TAGS, summary: "Record a new odometer reading", security: BEARER_AUTH, request: { params: IdParamSchema, ...jsonBody(UpdateOdometerSchema) },
  responses: { 200: { description: "Odometer updated", content: { "application/json": { schema: successEnvelope("VehicleOdometerResponse", record) } } }, ...commonErrorResponses({ notFound: true, validate: true }) },
});

registry.registerPath({
  method: "get", path: `${base}/{id}/odometer/history`, tags: TAGS, summary: "Get a vehicle's odometer history", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Odometer history", content: { "application/json": { schema: successEnvelope("VehicleOdometerHistoryResponse", z.array(record)) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "get", path: `${base}/{id}/documents`, tags: TAGS, summary: "List documents attached to a vehicle", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Documents", content: { "application/json": { schema: successEnvelope("VehicleDocumentsResponse", z.array(record)) } } }, ...commonErrorResponses({ notFound: true }) },
});

for (const [method, suffix, summary] of [
  ["post", "/documents", "Upload a vehicle document (not implemented here — use POST /api/v1/documents/upload)"],
  ["delete", "/documents/{documentId}", "Delete a vehicle document (not implemented here — use DELETE /api/v1/documents/{id})"],
  ["get", "/documents/{documentId}/download", "Download a vehicle document (not implemented here — use GET /api/v1/documents/{id}/download)"],
] as const) {
  registry.registerPath({
    method, path: `${base}/{id}${suffix}`, tags: TAGS, summary, security: BEARER_AUTH,
    request: { params: suffix.includes("documentId") ? withId({ documentId: z.string() }) : IdParamSchema },
    responses: { 501: { description: "Not implemented" }, ...commonErrorResponses() },
  });
}

registry.registerPath({
  method: "get", path: `${base}/{id}/reminders`, tags: TAGS, summary: "List reminders for a vehicle", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Reminders", content: { "application/json": { schema: successEnvelope("VehicleRemindersResponse", z.array(record)) } } }, ...commonErrorResponses({ notFound: true }) },
});

for (const [suffix, label] of [["warranty", "warranty"], ["insurance", "insurance"]] as const) {
  registry.registerPath({
    method: "get", path: `${base}/{id}/${suffix}`, tags: TAGS, summary: `Get vehicle ${label} info (not implemented — no ${label} fields on the Vehicle schema)`, security: BEARER_AUTH,
    request: { params: IdParamSchema },
    responses: { 501: { description: "Not implemented" }, ...commonErrorResponses() },
  });
  registry.registerPath({
    method: "put", path: `${base}/{id}/${suffix}`, tags: TAGS, summary: `Update vehicle ${label} info (not implemented — no ${label} fields on the Vehicle schema)`, security: BEARER_AUTH,
    request: { params: IdParamSchema, ...jsonBody(record) },
    responses: { 501: { description: "Not implemented" }, ...commonErrorResponses() },
  });
}

registry.registerPath({
  method: "post", path: `${base}/{id}/transfer`, tags: TAGS, summary: "Transfer vehicle ownership to a new owner", security: BEARER_AUTH, request: { params: IdParamSchema, ...jsonBody(TransferOwnershipSchema) },
  responses: { 200: { description: "Ownership transferred", content: { "application/json": { schema: successEnvelope("VehicleTransferResponse", record) } } }, ...commonErrorResponses({ notFound: true, validate: true }) },
});

registry.registerPath({
  method: "get", path: `${base}/{id}/stats`, tags: TAGS, summary: "Get aggregate service stats for a vehicle", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Vehicle stats", content: { "application/json": { schema: successEnvelope("VehicleStatsResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});
