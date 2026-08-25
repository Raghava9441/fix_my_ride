import { z } from "zod";
import { registry } from "../registry";
import { successEnvelope, paginatedEnvelope, commonErrorResponses, BEARER_AUTH, IdParamSchema, PaginationQuerySchema } from "../common";

const TAGS = ["Notifications"];
const record = z.record(z.any());
const base = "/api/v1/notifications";

registry.registerPath({
  method: "get", path: base, tags: TAGS, summary: "List the current user's notifications", security: BEARER_AUTH,
  request: { query: PaginationQuerySchema.extend({ channel: z.string().optional(), type: z.string().optional(), status: z.string().optional(), unreadOnly: z.coerce.boolean().optional() }) },
  responses: { 200: { description: "Notifications", content: { "application/json": { schema: paginatedEnvelope("NotificationListResponse", record) } } }, ...commonErrorResponses() },
});

registry.registerPath({
  method: "get", path: `${base}/unread`, tags: TAGS, summary: "List the current user's unread notifications", security: BEARER_AUTH,
  responses: { 200: { description: "Unread notifications", content: { "application/json": { schema: successEnvelope("UnreadNotificationsResponse", z.array(record)) } } }, ...commonErrorResponses() },
});

registry.registerPath({
  method: "get", path: `${base}/stats`, tags: TAGS, summary: "Get a status breakdown of the current user's notifications", security: BEARER_AUTH,
  responses: { 200: { description: "Stats", content: { "application/json": { schema: successEnvelope("NotificationStatsResponse", z.array(z.object({ _id: z.string(), count: z.number() }))) } } }, ...commonErrorResponses() },
});

registry.registerPath({
  method: "post", path: `${base}/read-all`, tags: TAGS, summary: "Mark all of the current user's notifications as read", security: BEARER_AUTH,
  responses: { 200: { description: "Marked all read", content: { "application/json": { schema: successEnvelope("MarkAllReadResponse", z.object({ matched: z.number(), modified: z.number() })) } } }, ...commonErrorResponses() },
});

registry.registerPath({
  method: "get", path: `${base}/{id}`, tags: TAGS, summary: "Get one of the current user's notifications", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Notification", content: { "application/json": { schema: successEnvelope("NotificationResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "patch", path: `${base}/{id}/read`, tags: TAGS, summary: "Mark a notification as read", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Marked read", content: { "application/json": { schema: successEnvelope("NotificationResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "patch", path: `${base}/{id}/clicked`, tags: TAGS, summary: "Mark a notification as clicked", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Marked clicked", content: { "application/json": { schema: successEnvelope("NotificationResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "delete", path: `${base}/{id}`, tags: TAGS, summary: "Delete a notification", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Notification deleted", content: { "application/json": { schema: successEnvelope("NotificationDeletedResponse", z.object({ id: z.string(), deleted: z.boolean() })) } } }, ...commonErrorResponses({ notFound: true }) },
});
