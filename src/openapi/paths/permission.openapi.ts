import { z } from "zod";
import { registry } from "../registry";
import { successEnvelope, paginatedEnvelope, commonErrorResponses, BEARER_AUTH, IdParamSchema, PaginationQuerySchema } from "../common";
import { CreatePermissionSchema, UpdatePermissionSchema } from "../../dto/permission.dto";

const TAGS = ["Permissions"];
const record = z.record(z.any());
const jsonBody = <T extends z.ZodTypeAny>(schema: T) => ({ body: { content: { "application/json": { schema } } } });
const base = "/api/v1/permissions";
const adminNote = " Requires the `admin` role.";

registry.registerPath({
  method: "get", path: base, tags: TAGS, summary: "List permissions (global catalog, not tenant-scoped)", security: BEARER_AUTH,
  request: { query: PaginationQuerySchema.extend({ resource: z.string().optional(), action: z.string().optional(), scope: z.string().optional(), isActive: z.coerce.boolean().optional() }) },
  responses: { 200: { description: "Permissions", content: { "application/json": { schema: paginatedEnvelope("PermissionListResponse", record) } } }, ...commonErrorResponses() },
});

registry.registerPath({
  method: "get", path: `${base}/{id}`, tags: TAGS, summary: "Get a permission by id", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Permission", content: { "application/json": { schema: successEnvelope("PermissionResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "post", path: base, tags: TAGS, summary: "Create a permission." + adminNote, security: BEARER_AUTH, request: jsonBody(CreatePermissionSchema),
  responses: { 201: { description: "Permission created", content: { "application/json": { schema: successEnvelope("PermissionResponse", record) } } }, 409: { description: "Permission key already exists" }, ...commonErrorResponses({ validate: true }) },
});

registry.registerPath({
  method: "put", path: `${base}/{id}`, tags: TAGS, summary: "Update a permission." + adminNote, security: BEARER_AUTH, request: { params: IdParamSchema, ...jsonBody(UpdatePermissionSchema) },
  responses: { 200: { description: "Permission updated", content: { "application/json": { schema: successEnvelope("PermissionResponse", record) } } }, ...commonErrorResponses({ notFound: true, validate: true }) },
});

registry.registerPath({
  method: "delete", path: `${base}/{id}`, tags: TAGS, summary: "Deactivate a permission (soft, sets isActive=false)." + adminNote, security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Permission deactivated", content: { "application/json": { schema: successEnvelope("PermissionResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "post", path: `${base}/seed`, tags: TAGS, summary: "Seed the default permission catalog (idempotent upsert)." + adminNote, security: BEARER_AUTH,
  responses: { 200: { description: "Seeded", content: { "application/json": { schema: successEnvelope("OkResponse", z.any().nullable()) } } }, ...commonErrorResponses() },
});
