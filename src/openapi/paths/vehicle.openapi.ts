import { z } from "zod";
import { registry } from "../registry";
import { successEnvelope, paginatedEnvelope, commonErrorResponses, entityDocumentUploadBody, BEARER_AUTH, IdParamSchema, PaginationQuerySchema } from "../common";
import {
  CreateVehicleSchema,
  UpdateVehicleSchema,
  AuthorizeCenterSchema,
  UpdateCenterAccessSchema,
  UpdateOdometerSchema,
  TransferOwnershipSchema,
  UpdateWarrantySchema,
  UpdateInsuranceSchema,
  SearchVehiclesSchema,
} from "../../dto/vehicle.dto";
import {
  CreateOdometerReadingSchema,
  UpdateOdometerReadingSchema,
  VerifyOdometerSchema,
  QueryOdometerHistorySchema,
} from "../../dto/odometer-reading.dto";

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
  method: "get", path: `${base}/search`, tags: TAGS,
  summary: "Search vehicles by registration, VIN, make, model or colour",
  description: "Case-insensitive substring match across the identifying fields. The term is treated as a literal, not a pattern.",
  security: BEARER_AUTH,
  request: { query: SearchVehiclesSchema },
  responses: { 200: { description: "Matching vehicles", content: { "application/json": { schema: paginatedEnvelope("VehicleSearchResponse", record) } } }, ...commonErrorResponses({ validate: true }) },
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

// Dedicated OdometerReading resource — addressable individual readings
// (verify/correct/delete), on top of the current-value endpoints above.
registry.registerPath({
  method: "get", path: `${base}/{id}/odometer-readings`, tags: TAGS, summary: "List a vehicle's odometer reading history (paginated, filterable)", security: BEARER_AUTH,
  request: { params: IdParamSchema, query: QueryOdometerHistorySchema },
  responses: { 200: { description: "Odometer readings", content: { "application/json": { schema: successEnvelope("OdometerReadingListResponse", z.array(record)) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "post", path: `${base}/{id}/odometer-readings`, tags: TAGS, summary: "Record a new odometer reading (as an addressable history entry)", security: BEARER_AUTH,
  request: { params: IdParamSchema, ...jsonBody(CreateOdometerReadingSchema.omit({ vehicleId: true })) },
  responses: { 201: { description: "Odometer reading recorded", content: { "application/json": { schema: successEnvelope("OdometerReadingResponse", record) } } }, 400: { description: "New reading is lower than the vehicle's current reading" }, ...commonErrorResponses({ notFound: true, validate: true }) },
});

registry.registerPath({
  method: "get", path: `${base}/{id}/odometer-readings/{readingId}`, tags: TAGS, summary: "Get a single odometer reading", security: BEARER_AUTH, request: { params: withId({ readingId: z.string() }) },
  responses: { 200: { description: "Odometer reading", content: { "application/json": { schema: successEnvelope("OdometerReadingResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "patch", path: `${base}/{id}/odometer-readings/{readingId}`, tags: TAGS, summary: "Correct a historical odometer reading's own fields (does not touch the vehicle's current reading)", security: BEARER_AUTH,
  request: { params: withId({ readingId: z.string() }), ...jsonBody(UpdateOdometerReadingSchema) },
  responses: { 200: { description: "Odometer reading updated", content: { "application/json": { schema: successEnvelope("OdometerReadingResponse", record) } } }, ...commonErrorResponses({ notFound: true, validate: true }) },
});

registry.registerPath({
  method: "patch", path: `${base}/{id}/odometer-readings/{readingId}/verify`, tags: TAGS, summary: "Mark an odometer reading as verified", security: BEARER_AUTH,
  request: { params: withId({ readingId: z.string() }), ...jsonBody(VerifyOdometerSchema) },
  responses: { 200: { description: "Odometer reading verified", content: { "application/json": { schema: successEnvelope("OdometerReadingResponse", record) } } }, ...commonErrorResponses({ notFound: true, validate: true }) },
});

registry.registerPath({
  method: "delete", path: `${base}/{id}/odometer-readings/{readingId}`, tags: TAGS, summary: "Soft-delete a bad odometer reading entry", security: BEARER_AUTH, request: { params: withId({ readingId: z.string() }) },
  responses: { 200: { description: "Odometer reading deleted", content: { "application/json": { schema: successEnvelope("OdometerReadingDeletedResponse", z.object({ id: z.string(), deleted: z.boolean() })) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "get", path: `${base}/{id}/documents`, tags: TAGS, summary: "List documents attached to a vehicle", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Documents", content: { "application/json": { schema: successEnvelope("VehicleDocumentsResponse", z.array(record)) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "post", path: `${base}/{id}/documents`, tags: TAGS, summary: "Attach a document to a vehicle (multipart/form-data)", security: BEARER_AUTH,
  request: { params: IdParamSchema, ...entityDocumentUploadBody() },
  responses: {
    201: { description: "Document uploaded", content: { "application/json": { schema: successEnvelope("VehicleDocumentUploadResponse", record) } } },
    400: { description: "No file uploaded, or unsupported file type" },
    ...commonErrorResponses({ notFound: true, validate: true }),
  },
});

registry.registerPath({
  method: "delete", path: `${base}/{id}/documents/{documentId}`, tags: TAGS, summary: "Soft-delete a vehicle document and remove the stored file", security: BEARER_AUTH,
  request: { params: withId({ documentId: z.string() }) },
  responses: { 200: { description: "Document deleted", content: { "application/json": { schema: successEnvelope("VehicleDocumentDeletedResponse", z.object({ id: z.string(), deleted: z.boolean() })) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "get", path: `${base}/{id}/documents/{documentId}/download`, tags: TAGS, summary: "Download a vehicle document (redirects when stored off-box)", security: BEARER_AUTH,
  request: { params: withId({ documentId: z.string() }) },
  responses: {
    200: { description: "File contents", content: { "application/octet-stream": { schema: { type: "string", format: "binary" } } } },
    302: { description: "Redirect to the storage provider's URL for non-local files" },
    403: { description: "Not accessible to the current user" },
    ...commonErrorResponses({ notFound: true }),
  },
});

registry.registerPath({
  method: "get", path: `${base}/{id}/reminders`, tags: TAGS, summary: "List reminders for a vehicle", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Reminders", content: { "application/json": { schema: successEnvelope("VehicleRemindersResponse", z.array(record)) } } }, ...commonErrorResponses({ notFound: true }) },
});

for (const [suffix, label, schema] of [
  ["warranty", "warranty", UpdateWarrantySchema],
  ["insurance", "insurance", UpdateInsuranceSchema],
] as const) {
  registry.registerPath({
    method: "get", path: `${base}/{id}/${suffix}`, tags: TAGS, summary: `Get a vehicle's ${label} details`, security: BEARER_AUTH,
    request: { params: IdParamSchema },
    responses: {
      200: { description: `${label} details, or null if none recorded`, content: { "application/json": { schema: successEnvelope(`Vehicle${label === "warranty" ? "Warranty" : "Insurance"}Response`, record.nullable()) } } },
      ...commonErrorResponses({ notFound: true }),
    },
  });
  registry.registerPath({
    method: "put", path: `${base}/{id}/${suffix}`, tags: TAGS,
    summary: `Replace a vehicle's ${label} details`,
    description: `Replaces the whole ${label} block — an omitted field clears it rather than preserving the stored value.`,
    security: BEARER_AUTH,
    request: { params: IdParamSchema, ...jsonBody(schema) },
    responses: {
      200: { description: `${label} updated`, content: { "application/json": { schema: successEnvelope(`Vehicle${label === "warranty" ? "Warranty" : "Insurance"}UpdatedResponse`, record) } } },
      ...commonErrorResponses({ notFound: true, validate: true }),
    },
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
