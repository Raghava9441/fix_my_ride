import { z } from "zod";
import { registry } from "../registry";
import { successEnvelope, paginatedEnvelope, commonErrorResponses, BEARER_AUTH, IdParamSchema, PaginationQuerySchema } from "../common";
import {
  CreateStaffSchema,
  UpdateStaffSchema,
  UpdateStaffScheduleSchema,
  AddCustomPermissionSchema,
} from "../../dto/staff.dto";

const TAGS = ["Staff"];
const record = z.record(z.any());
const jsonBody = <T extends z.ZodTypeAny>(schema: T) => ({ body: { content: { "application/json": { schema } } } });
const withId = (extra: z.ZodRawShape) => IdParamSchema.extend(extra);
const base = "/api/v1/staff";

registry.registerPath({
  method: "get", path: base, tags: TAGS, summary: "List staff profiles", security: BEARER_AUTH,
  request: { query: PaginationQuerySchema.extend({ serviceCenterId: z.string().optional(), employmentStatus: z.string().optional(), roleId: z.string().optional() }) },
  responses: { 200: { description: "Staff", content: { "application/json": { schema: paginatedEnvelope("StaffListResponse", record) } } }, ...commonErrorResponses() },
});

registry.registerPath({
  method: "get", path: `${base}/{id}`, tags: TAGS, summary: "Get a staff profile by id", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Staff profile", content: { "application/json": { schema: successEnvelope("StaffResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "post", path: base, tags: TAGS, summary: "Create a staff profile", security: BEARER_AUTH, request: jsonBody(CreateStaffSchema),
  responses: { 201: { description: "Staff profile created", content: { "application/json": { schema: successEnvelope("StaffResponse", record) } } }, 409: { description: "Staff profile already exists for this account" }, ...commonErrorResponses({ notFound: true, validate: true }) },
});

registry.registerPath({
  method: "put", path: `${base}/{id}`, tags: TAGS, summary: "Update a staff profile", security: BEARER_AUTH, request: { params: IdParamSchema, ...jsonBody(UpdateStaffSchema) },
  responses: { 200: { description: "Staff profile updated", content: { "application/json": { schema: successEnvelope("StaffResponse", record) } } }, ...commonErrorResponses({ notFound: true, validate: true }) },
});

registry.registerPath({
  method: "delete", path: `${base}/{id}`, tags: TAGS, summary: "Soft-delete a staff profile", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Staff profile deleted", content: { "application/json": { schema: successEnvelope("StaffDeletedResponse", z.object({ id: z.string(), deleted: z.boolean() })) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "get", path: `${base}/{id}/permissions`, tags: TAGS, summary: "Get a staff member's effective permissions", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Permissions", content: { "application/json": { schema: successEnvelope("StaffPermissionsResponse", z.array(z.string())) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "post", path: `${base}/{id}/permissions`, tags: TAGS, summary: "Grant a custom permission to a staff member", security: BEARER_AUTH, request: { params: IdParamSchema, ...jsonBody(AddCustomPermissionSchema) },
  responses: { 201: { description: "Permission granted", content: { "application/json": { schema: successEnvelope("StaffResponse", record) } } }, 409: { description: "Permission already granted" }, ...commonErrorResponses({ notFound: true, validate: true }) },
});

registry.registerPath({
  method: "delete", path: `${base}/{id}/permissions/{permissionId}`, tags: TAGS, summary: "Revoke a custom permission from a staff member", security: BEARER_AUTH, request: { params: withId({ permissionId: z.string() }) },
  responses: { 200: { description: "Permission revoked", content: { "application/json": { schema: successEnvelope("StaffResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "get", path: `${base}/{id}/schedule`, tags: TAGS, summary: "Get a staff member's work schedule", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Schedule", content: { "application/json": { schema: successEnvelope("StaffScheduleResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "put", path: `${base}/{id}/schedule`, tags: TAGS, summary: "Update a staff member's work schedule", security: BEARER_AUTH, request: { params: IdParamSchema, ...jsonBody(UpdateStaffScheduleSchema) },
  responses: { 200: { description: "Schedule updated", content: { "application/json": { schema: successEnvelope("StaffResponse", record) } } }, ...commonErrorResponses({ notFound: true, validate: true }) },
});

registry.registerPath({
  method: "get", path: `${base}/{id}/performance`, tags: TAGS, summary: "Get a staff member's performance stats", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Performance", content: { "application/json": { schema: successEnvelope("StaffPerformanceResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "get", path: `${base}/{id}/services`, tags: TAGS, summary: "List service records this staff member performed", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Service records", content: { "application/json": { schema: successEnvelope("StaffServicesResponse", z.array(record)) } } }, ...commonErrorResponses({ notFound: true }) },
});
