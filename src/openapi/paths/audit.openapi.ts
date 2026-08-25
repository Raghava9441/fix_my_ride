import { z } from "zod";
import { registry } from "../registry";
import { successEnvelope, paginatedEnvelope, commonErrorResponses, BEARER_AUTH, PaginationQuerySchema } from "../common";

const TAGS = ["Audit Logs"];
const record = z.record(z.any());
const base = "/api/v1/audit-logs";
const adminNote = " Admin only.";

registry.registerPath({
  method: "get", path: base, tags: TAGS, summary: "List audit log entries." + adminNote, security: BEARER_AUTH,
  request: { query: PaginationQuerySchema.extend({ tenantId: z.string().optional(), actorId: z.string().optional(), entityType: z.string().optional(), entityId: z.string().optional(), action: z.string().optional(), fromDate: z.string().datetime().optional(), toDate: z.string().datetime().optional() }) },
  responses: { 200: { description: "Audit logs", content: { "application/json": { schema: paginatedEnvelope("AuditLogListResponse", record) } } }, ...commonErrorResponses() },
});

registry.registerPath({
  method: "get", path: `${base}/summary`, tags: TAGS, summary: "Get an action/entity-type activity summary." + adminNote, security: BEARER_AUTH,
  request: { query: z.object({ tenantId: z.string().optional(), fromDate: z.string().datetime().optional(), toDate: z.string().datetime().optional() }) },
  responses: { 200: { description: "Activity summary", content: { "application/json": { schema: successEnvelope("AuditActivitySummaryResponse", z.array(record)) } } }, ...commonErrorResponses() },
});

registry.registerPath({
  method: "get", path: `${base}/entity/{entityType}/{entityId}`, tags: TAGS, summary: "Get the audit history for one entity." + adminNote, security: BEARER_AUTH,
  request: { params: z.object({ entityType: z.string(), entityId: z.string() }), query: z.object({ limit: z.coerce.number().optional() }) },
  responses: { 200: { description: "Entity history", content: { "application/json": { schema: successEnvelope("AuditEntityHistoryResponse", z.array(record)) } } }, ...commonErrorResponses() },
});

registry.registerPath({
  method: "get", path: `${base}/actor/{actorId}`, tags: TAGS, summary: "Get an actor's activity history." + adminNote, security: BEARER_AUTH,
  request: { params: z.object({ actorId: z.string() }), query: z.object({ limit: z.coerce.number().optional(), fromDate: z.string().datetime().optional(), toDate: z.string().datetime().optional() }) },
  responses: { 200: { description: "Actor activity", content: { "application/json": { schema: successEnvelope("AuditActorActivityResponse", z.array(record)) } } }, ...commonErrorResponses() },
});

registry.registerPath({
  method: "get", path: `${base}/{id}`, tags: TAGS, summary: "Get a single audit log entry." + adminNote, security: BEARER_AUTH,
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: "Audit log entry", content: { "application/json": { schema: successEnvelope("AuditLogResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});
