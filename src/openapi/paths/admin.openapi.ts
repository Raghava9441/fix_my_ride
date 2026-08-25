import { z } from "zod";
import { registry } from "../registry";
import { successEnvelope, paginatedEnvelope, commonErrorResponses, BEARER_AUTH, IdParamSchema, PaginationQuerySchema } from "../common";

const TAGS = ["Admin"];
const jsonBody = <T extends z.ZodTypeAny>(schema: T) => ({ body: { content: { "application/json": { schema } } } });
const record = z.record(z.any());
const adminErrors = () => commonErrorResponses({ notFound: true });

registry.registerPath({
  method: "get",
  path: "/api/v1/admin/dashboard",
  tags: TAGS,
  summary: "Platform-wide dashboard totals (admin only)",
  security: BEARER_AUTH,
  responses: {
    200: {
      description: "Dashboard stats",
      content: {
        "application/json": {
          schema: successEnvelope(
            "AdminDashboardResponse",
            z.object({ totalTenants: z.number(), totalUsers: z.number(), totalVehicles: z.number(), totalServiceRecords: z.number(), revenue: z.number() }),
          ),
        },
      },
    },
    ...adminErrors(),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/admin/stats",
  tags: TAGS,
  summary: "Process/system resource stats (admin only)",
  security: BEARER_AUTH,
  responses: { 200: { description: "System stats", content: { "application/json": { schema: successEnvelope("AdminSystemStatsResponse", record) } } }, ...adminErrors() },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/admin/tenants",
  tags: TAGS,
  summary: "List tenants (admin only)",
  security: BEARER_AUTH,
  request: { query: PaginationQuerySchema },
  responses: { 200: { description: "Tenants", content: { "application/json": { schema: paginatedEnvelope("AdminTenantListResponse", record) } } }, ...adminErrors() },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/admin/tenants",
  tags: TAGS,
  summary: "Create a tenant (admin only)",
  security: BEARER_AUTH,
  request: jsonBody(record),
  responses: { 201: { description: "Tenant created", content: { "application/json": { schema: successEnvelope("AdminTenantResponse", record) } } }, ...adminErrors() },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/admin/tenants/{id}",
  tags: TAGS,
  summary: "Get a tenant by id (admin only)",
  security: BEARER_AUTH,
  request: { params: IdParamSchema },
  responses: { 200: { description: "Tenant", content: { "application/json": { schema: successEnvelope("AdminTenantResponse", record) } } }, ...adminErrors() },
});

registry.registerPath({
  method: "put",
  path: "/api/v1/admin/tenants/{id}",
  tags: TAGS,
  summary: "Update a tenant (admin only)",
  security: BEARER_AUTH,
  request: { params: IdParamSchema, ...jsonBody(record) },
  responses: { 200: { description: "Tenant updated", content: { "application/json": { schema: successEnvelope("AdminTenantResponse", record) } } }, ...adminErrors() },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/admin/tenants/{id}",
  tags: TAGS,
  summary: "Delete a tenant (admin only)",
  security: BEARER_AUTH,
  request: { params: IdParamSchema },
  responses: { 200: { description: "Tenant deleted", content: { "application/json": { schema: successEnvelope("AdminTenantDeletedResponse", z.object({ id: z.string(), deleted: z.boolean() })) } } }, ...adminErrors() },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/admin/tenants/{id}/status",
  tags: TAGS,
  summary: "Activate/deactivate a tenant (admin only)",
  security: BEARER_AUTH,
  request: { params: IdParamSchema, ...jsonBody(z.object({ isActive: z.boolean() })) },
  responses: { 200: { description: "Status updated", content: { "application/json": { schema: successEnvelope("AdminTenantStatusResponse", z.object({ id: z.string(), isActive: z.boolean() })) } } }, ...adminErrors() },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/admin/users",
  tags: TAGS,
  summary: "List all accounts platform-wide (admin only)",
  security: BEARER_AUTH,
  request: { query: PaginationQuerySchema.extend({ status: z.string().optional(), tenantId: z.string().optional() }) },
  responses: { 200: { description: "Users", content: { "application/json": { schema: paginatedEnvelope("AdminUserListResponse", record) } } }, ...adminErrors() },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/admin/users/{id}/suspend",
  tags: TAGS,
  summary: "Suspend a user account (admin only)",
  security: BEARER_AUTH,
  request: { params: IdParamSchema, ...jsonBody(z.object({ reason: z.string().optional() })) },
  responses: { 200: { description: "User suspended", content: { "application/json": { schema: successEnvelope("AdminUserStatusResponse", z.object({ id: z.string(), status: z.string() })) } } }, ...adminErrors() },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/admin/users/{id}/activate",
  tags: TAGS,
  summary: "Reactivate a suspended user account (admin only)",
  security: BEARER_AUTH,
  request: { params: IdParamSchema },
  responses: { 200: { description: "User activated", content: { "application/json": { schema: successEnvelope("AdminUserStatusResponse", z.object({ id: z.string(), status: z.string() })) } } }, ...adminErrors() },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/admin/system/health",
  tags: TAGS,
  summary: "Detailed system health (admin only)",
  security: BEARER_AUTH,
  responses: { 200: { description: "Health", content: { "application/json": { schema: successEnvelope("AdminSystemHealthResponse", record) } } }, ...adminErrors() },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/admin/system/logs",
  tags: TAGS,
  summary: "Query system logs (not implemented — no queryable log store)",
  security: BEARER_AUTH,
  responses: { 501: { description: "Not implemented" }, ...adminErrors() },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/admin/system/metrics",
  tags: TAGS,
  summary: "Request/latency metrics (not implemented — no metrics collector)",
  security: BEARER_AUTH,
  responses: { 501: { description: "Not implemented" }, ...adminErrors() },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/admin/maintenance/clear-cache",
  tags: TAGS,
  summary: "Clear cached Redis keys matching a pattern (admin only)",
  security: BEARER_AUTH,
  request: jsonBody(z.object({ pattern: z.string().optional().openapi({ example: "cache:*" }) })),
  responses: { 200: { description: "Cache cleared", content: { "application/json": { schema: successEnvelope("AdminCacheClearedResponse", z.object({ pattern: z.string() })) } } }, ...adminErrors() },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/admin/maintenance/reindex-search",
  tags: TAGS,
  summary: "Rebuild search index (not implemented — no search index exists)",
  security: BEARER_AUTH,
  responses: { 501: { description: "Not implemented" }, ...adminErrors() },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/admin/maintenance/backup",
  tags: TAGS,
  summary: "Trigger a database backup (not implemented — no backup automation exists)",
  security: BEARER_AUTH,
  responses: { 501: { description: "Not implemented" }, ...adminErrors() },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/admin/audit-logs",
  tags: TAGS,
  summary: "List audit log entries platform-wide (admin only)",
  security: BEARER_AUTH,
  request: { query: PaginationQuerySchema.extend({ tenantId: z.string().optional(), actorId: z.string().optional(), entityType: z.string().optional(), action: z.string().optional() }) },
  responses: { 200: { description: "Audit logs", content: { "application/json": { schema: paginatedEnvelope("AdminAuditLogListResponse", record) } } }, ...adminErrors() },
});
