import { z } from "zod";
import { registry } from "../registry";
import { successEnvelope, paginatedEnvelope, commonErrorResponses, BEARER_AUTH, IdParamSchema, PaginationQuerySchema } from "../common";
import { UpdateOwnerSchema } from "../../dto/owner.dto";

const TAGS = ["Owners"];
const record = z.record(z.any());
const jsonBody = <T extends z.ZodTypeAny>(schema: T) => ({ body: { content: { "application/json": { schema } } } });
const withId = (extra: z.ZodRawShape) => IdParamSchema.extend(extra);
const base = "/api/v1/owners";

registry.registerPath({
  method: "get", path: base, tags: TAGS, summary: "List owner profiles", security: BEARER_AUTH, request: { query: PaginationQuerySchema },
  responses: { 200: { description: "Owners", content: { "application/json": { schema: paginatedEnvelope("OwnerListResponse", record) } } }, ...commonErrorResponses() },
});

registry.registerPath({
  method: "get", path: `${base}/{id}`, tags: TAGS, summary: "Get an owner profile by id", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Owner profile", content: { "application/json": { schema: successEnvelope("OwnerResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "put", path: `${base}/{id}`, tags: TAGS, summary: "Update an owner profile", security: BEARER_AUTH, request: { params: IdParamSchema, ...jsonBody(UpdateOwnerSchema) },
  responses: { 200: { description: "Owner profile updated", content: { "application/json": { schema: successEnvelope("OwnerResponse", record) } } }, ...commonErrorResponses({ notFound: true, validate: true }) },
});

registry.registerPath({
  method: "delete", path: `${base}/{id}`, tags: TAGS, summary: "Soft-delete an owner profile", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Owner profile deleted", content: { "application/json": { schema: successEnvelope("OwnerDeletedResponse", z.object({ id: z.string(), deleted: z.boolean() })) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "get", path: `${base}/{id}/vehicles`, tags: TAGS, summary: "List an owner's vehicles", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Vehicles", content: { "application/json": { schema: successEnvelope("OwnerVehiclesResponse", z.array(record)) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "post", path: `${base}/{id}/vehicles`, tags: TAGS, summary: "Add a vehicle to an owner's profile", security: BEARER_AUTH,
  request: { params: IdParamSchema, ...jsonBody(z.object({ vehicleId: z.string(), isPrimary: z.boolean().optional() })) },
  responses: { 201: { description: "Vehicle added", content: { "application/json": { schema: successEnvelope("OwnerResponse", record) } } }, 409: { description: "Vehicle already added to this owner" }, ...commonErrorResponses({ notFound: true, validate: true }) },
});

registry.registerPath({
  method: "get", path: `${base}/{id}/service-history`, tags: TAGS, summary: "Get an owner's service history across all their vehicles", security: BEARER_AUTH, request: { params: IdParamSchema, query: PaginationQuerySchema },
  responses: { 200: { description: "Service history", content: { "application/json": { schema: paginatedEnvelope("OwnerServiceHistoryResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "get", path: `${base}/{id}/expenses`, tags: TAGS, summary: "Get an owner's total spend, broken down by service type", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Expenses", content: { "application/json": { schema: successEnvelope("OwnerExpensesResponse", z.object({ total: z.number(), currency: z.string(), breakdown: z.record(z.number()) })) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "get", path: `${base}/{id}/notifications`, tags: TAGS, summary: "List an owner's notifications", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Notifications", content: { "application/json": { schema: successEnvelope("OwnerNotificationsResponse", z.array(record)) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "patch", path: `${base}/{id}/notifications/{notificationId}/read`, tags: TAGS, summary: "Mark one of an owner's notifications as read", security: BEARER_AUTH, request: { params: withId({ notificationId: z.string() }) },
  responses: { 200: { description: "Marked read", content: { "application/json": { schema: successEnvelope("NotificationResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "delete", path: `${base}/{id}/notifications`, tags: TAGS, summary: "Bulk-delete an owner's notifications (not implemented — no bulk-delete-by-recipient method exists)", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 501: { description: "Not implemented" }, ...commonErrorResponses() },
});

registry.registerPath({
  method: "get", path: `${base}/{id}/preferences`, tags: TAGS, summary: "Get an owner's notification preferences", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Preferences", content: { "application/json": { schema: successEnvelope("OwnerPreferencesResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "put", path: `${base}/{id}/preferences`, tags: TAGS, summary: "Update an owner's notification preferences", security: BEARER_AUTH,
  request: { params: IdParamSchema, ...jsonBody(UpdateOwnerSchema.shape.notificationPreferences) },
  responses: { 200: { description: "Preferences updated", content: { "application/json": { schema: successEnvelope("OwnerResponse", record) } } }, ...commonErrorResponses({ notFound: true, validate: true }) },
});
