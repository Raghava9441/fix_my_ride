import { z } from "zod";
import { registry } from "../registry";
import { successEnvelope, paginatedEnvelope, commonErrorResponses, BEARER_AUTH, IdParamSchema, PaginationQuerySchema } from "../common";
import { CreateRoleSchema, UpdateRoleSchema, AddPermissionToRoleSchema } from "../../dto/role.dto";

const TAGS = ["Roles"];
const record = z.record(z.any());
const jsonBody = <T extends z.ZodTypeAny>(schema: T) => ({ body: { content: { "application/json": { schema } } } });
const withId = (extra: z.ZodRawShape) => IdParamSchema.extend(extra);
const base = "/api/v1/roles";
const adminNote = " Requires the `admin` role.";

registry.registerPath({
  method: "get", path: base, tags: TAGS, summary: "List roles (system roles + tenant/custom roles)", security: BEARER_AUTH,
  request: { query: PaginationQuerySchema.extend({ type: z.string().optional(), tenantId: z.string().optional(), serviceCenterId: z.string().optional(), isActive: z.coerce.boolean().optional() }) },
  responses: { 200: { description: "Roles", content: { "application/json": { schema: paginatedEnvelope("RoleListResponse", record) } } }, ...commonErrorResponses() },
});

registry.registerPath({
  method: "get", path: `${base}/{id}`, tags: TAGS, summary: "Get a role by id", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Role", content: { "application/json": { schema: successEnvelope("RoleResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "post", path: base, tags: TAGS, summary: "Create a role." + adminNote, security: BEARER_AUTH, request: jsonBody(CreateRoleSchema),
  responses: { 201: { description: "Role created", content: { "application/json": { schema: successEnvelope("RoleResponse", record) } } }, 409: { description: "Role with this slug already exists" }, ...commonErrorResponses({ validate: true }) },
});

registry.registerPath({
  method: "put", path: `${base}/{id}`, tags: TAGS, summary: "Update a role." + adminNote, security: BEARER_AUTH, request: { params: IdParamSchema, ...jsonBody(UpdateRoleSchema) },
  responses: { 200: { description: "Role updated", content: { "application/json": { schema: successEnvelope("RoleResponse", record) } } }, ...commonErrorResponses({ notFound: true, validate: true }) },
});

registry.registerPath({
  method: "delete", path: `${base}/{id}`, tags: TAGS, summary: "Deactivate a role (soft, sets isActive=false)." + adminNote, security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Role deactivated", content: { "application/json": { schema: successEnvelope("RoleResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "get", path: `${base}/{id}/permissions`, tags: TAGS, summary: "Get a role's resolved permissions (direct + inherited)", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Permissions", content: { "application/json": { schema: successEnvelope("RolePermissionsResponse", z.array(z.string())) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "post", path: `${base}/{id}/permissions`, tags: TAGS, summary: "Add a permission to a role." + adminNote, security: BEARER_AUTH, request: { params: IdParamSchema, ...jsonBody(AddPermissionToRoleSchema) },
  responses: { 200: { description: "Permission added", content: { "application/json": { schema: successEnvelope("RoleResponse", record) } } }, ...commonErrorResponses({ notFound: true, validate: true }) },
});

registry.registerPath({
  method: "delete", path: `${base}/{id}/permissions/{permissionId}`, tags: TAGS, summary: "Remove a permission from a role." + adminNote, security: BEARER_AUTH, request: { params: withId({ permissionId: z.string() }) },
  responses: { 200: { description: "Permission removed", content: { "application/json": { schema: successEnvelope("RoleResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "post", path: `${base}/{id}/assign`, tags: TAGS, summary: "Assign a role to a user (not implemented here — role assignment lives on StaffProfile, see PUT /api/v1/staff/{id})", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 501: { description: "Not implemented" }, ...commonErrorResponses() },
});

registry.registerPath({
  method: "delete", path: `${base}/{id}/assign/{accountId}`, tags: TAGS, summary: "Unassign a role from a user (not implemented — see PUT /api/v1/staff/{id})", security: BEARER_AUTH, request: { params: withId({ accountId: z.string() }) },
  responses: { 501: { description: "Not implemented" }, ...commonErrorResponses() },
});

registry.registerPath({
  method: "post", path: `${base}/seed`, tags: TAGS, summary: "Seed the default system role hierarchy (idempotent upsert)." + adminNote, security: BEARER_AUTH,
  responses: { 200: { description: "Seeded", content: { "application/json": { schema: successEnvelope("OkResponse", z.any().nullable()) } } }, ...commonErrorResponses() },
});
