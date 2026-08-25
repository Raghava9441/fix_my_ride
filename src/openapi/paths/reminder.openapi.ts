import { z } from "zod";
import { registry } from "../registry";
import { successEnvelope, paginatedEnvelope, commonErrorResponses, BEARER_AUTH, IdParamSchema, PaginationQuerySchema } from "../common";
import {
  CreateReminderSchema,
  UpdateReminderSchema,
  SnoozeReminderSchema,
  BulkReminderActionSchema,
} from "../../dto/reminder.dto";

const TAGS = ["Reminders"];
const record = z.record(z.any());
const jsonBody = <T extends z.ZodTypeAny>(schema: T) => ({ body: { content: { "application/json": { schema } } } });
const base = "/api/v1/reminders";

registry.registerPath({
  method: "get", path: base, tags: TAGS, summary: "List reminders", security: BEARER_AUTH,
  request: { query: PaginationQuerySchema.extend({ ownerId: z.string().optional(), vehicleId: z.string().optional(), staffId: z.string().optional(), status: z.string().optional(), type: z.string().optional(), priority: z.string().optional() }) },
  responses: { 200: { description: "Reminders", content: { "application/json": { schema: paginatedEnvelope("ReminderListResponse", record) } } }, ...commonErrorResponses() },
});

registry.registerPath({
  method: "get", path: `${base}/upcoming`, tags: TAGS, summary: "List an owner's upcoming reminders", security: BEARER_AUTH,
  request: { query: z.object({ ownerId: z.string(), days: z.coerce.number().optional().openapi({ example: 7 }) }) },
  responses: { 200: { description: "Upcoming reminders", content: { "application/json": { schema: successEnvelope("UpcomingRemindersResponse", z.array(record)) } } }, 400: { description: "ownerId is required" }, ...commonErrorResponses() },
});

registry.registerPath({
  method: "get", path: `${base}/overdue`, tags: TAGS, summary: "List overdue reminders (optionally scoped to one owner)", security: BEARER_AUTH,
  request: { query: z.object({ ownerId: z.string().optional() }) },
  responses: { 200: { description: "Overdue reminders", content: { "application/json": { schema: successEnvelope("OverdueRemindersResponse", z.array(record)) } } }, ...commonErrorResponses() },
});

registry.registerPath({
  method: "get", path: `${base}/{id}`, tags: TAGS, summary: "Get a reminder by id", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Reminder", content: { "application/json": { schema: successEnvelope("ReminderResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "post", path: base, tags: TAGS, summary: "Create a reminder", security: BEARER_AUTH, request: jsonBody(CreateReminderSchema),
  responses: { 201: { description: "Reminder created", content: { "application/json": { schema: successEnvelope("ReminderResponse", record) } } }, ...commonErrorResponses({ validate: true }) },
});

registry.registerPath({
  method: "put", path: `${base}/{id}`, tags: TAGS, summary: "Update a reminder", security: BEARER_AUTH, request: { params: IdParamSchema, ...jsonBody(UpdateReminderSchema) },
  responses: { 200: { description: "Reminder updated", content: { "application/json": { schema: successEnvelope("ReminderResponse", record) } } }, ...commonErrorResponses({ notFound: true, validate: true }) },
});

registry.registerPath({
  method: "delete", path: `${base}/{id}`, tags: TAGS, summary: "Soft-delete a reminder", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Reminder deleted", content: { "application/json": { schema: successEnvelope("ReminderDeletedResponse", z.object({ id: z.string(), deleted: z.boolean() })) } } }, ...commonErrorResponses({ notFound: true }) },
});

for (const [action, summary] of [
  ["acknowledge", "Acknowledge a reminder"],
  ["complete", "Mark a reminder complete (auto-schedules the next occurrence if recurring)"],
  ["cancel", "Cancel a reminder"],
] as const) {
  registry.registerPath({
    method: "post", path: `${base}/{id}/${action}`, tags: TAGS, summary, security: BEARER_AUTH, request: { params: IdParamSchema },
    responses: { 200: { description: "Updated", content: { "application/json": { schema: successEnvelope("ReminderResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
  });
}

registry.registerPath({
  method: "post", path: `${base}/{id}/snooze`, tags: TAGS, summary: "Snooze a reminder until a later date", security: BEARER_AUTH, request: { params: IdParamSchema, ...jsonBody(SnoozeReminderSchema) },
  responses: { 200: { description: "Reminder snoozed", content: { "application/json": { schema: successEnvelope("ReminderResponse", record) } } }, ...commonErrorResponses({ notFound: true, validate: true }) },
});

for (const action of ["acknowledge", "cancel"] as const) {
  registry.registerPath({
    method: "post", path: `${base}/bulk/${action}`, tags: TAGS, summary: `Bulk-${action} reminders by id`, security: BEARER_AUTH, request: jsonBody(BulkReminderActionSchema),
    responses: { 200: { description: "Bulk action result", content: { "application/json": { schema: successEnvelope("BulkReminderActionResponse", z.object({ [action === "acknowledge" ? "acknowledged" : "cancelled"]: z.number() })) } } }, ...commonErrorResponses({ validate: true }) },
  });
}
