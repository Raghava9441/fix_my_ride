import { z } from "zod";
import { registry } from "../registry";
import { successEnvelope, paginatedEnvelope, commonErrorResponses, BEARER_AUTH, IdParamSchema, PaginationQuerySchema } from "../common";
import { CreateSubscriptionPlanSchema, UpdateSubscriptionPlanSchema } from "../../dto/subscription-plan.dto";

const TAGS = ["Subscription Plans"];
const record = z.record(z.any());
const jsonBody = <T extends z.ZodTypeAny>(schema: T) => ({ body: { content: { "application/json": { schema } } } });
const base = "/api/v1/subscription-plans";

registry.registerPath({
  method: "get", path: `${base}/public`, tags: TAGS, summary: "List public, active plans (pricing page — no auth)",
  responses: { 200: { description: "Public plans", content: { "application/json": { schema: successEnvelope("PublicPlansResponse", z.array(record)) } } } },
});

registry.registerPath({
  method: "get", path: base, tags: TAGS, summary: "List subscription plans", security: BEARER_AUTH,
  request: { query: PaginationQuerySchema.extend({ type: z.string().optional(), isActive: z.coerce.boolean().optional(), isPublic: z.coerce.boolean().optional() }) },
  responses: { 200: { description: "Plans", content: { "application/json": { schema: paginatedEnvelope("SubscriptionPlanListResponse", record) } } }, ...commonErrorResponses() },
});

registry.registerPath({
  method: "get", path: `${base}/compare`, tags: TAGS, summary: "Compare plans side by side", security: BEARER_AUTH,
  request: { query: z.object({ ids: z.string().openapi({ description: "Comma-separated plan ids", example: "665f1a2b3c4d5e6f7a8b9c0d,665f1a2b3c4d5e6f7a8b9c0e" }) }) },
  responses: { 200: { description: "Comparison", content: { "application/json": { schema: successEnvelope("PlanComparisonResponse", z.array(record)) } } }, 400: { description: "ids is required" }, ...commonErrorResponses() },
});

registry.registerPath({
  method: "get", path: `${base}/slug/{slug}`, tags: TAGS, summary: "Get a plan by slug", security: BEARER_AUTH,
  request: { params: z.object({ slug: z.string().openapi({ example: "basic" }) }) },
  responses: { 200: { description: "Plan", content: { "application/json": { schema: successEnvelope("SubscriptionPlanResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "get", path: `${base}/{id}`, tags: TAGS, summary: "Get a plan by id", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Plan", content: { "application/json": { schema: successEnvelope("SubscriptionPlanResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "post", path: base, tags: TAGS, summary: "Create a plan (admin only — also registers a matching Razorpay Plan when priced)", security: BEARER_AUTH, request: jsonBody(CreateSubscriptionPlanSchema),
  responses: { 201: { description: "Plan created", content: { "application/json": { schema: successEnvelope("SubscriptionPlanResponse", record) } } }, 409: { description: "Slug already exists" }, ...commonErrorResponses({ validate: true }) },
});

registry.registerPath({
  method: "put", path: `${base}/{id}`, tags: TAGS, summary: "Update a plan (admin only — re-registers the Razorpay Plan if price/interval/name changed)", security: BEARER_AUTH, request: { params: IdParamSchema, ...jsonBody(UpdateSubscriptionPlanSchema) },
  responses: { 200: { description: "Plan updated", content: { "application/json": { schema: successEnvelope("SubscriptionPlanResponse", record) } } }, ...commonErrorResponses({ notFound: true, validate: true }) },
});

registry.registerPath({
  method: "delete", path: `${base}/{id}`, tags: TAGS, summary: "Soft-delete a plan (admin only)", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Plan deleted", content: { "application/json": { schema: successEnvelope("SubscriptionPlanDeletedResponse", z.object({ id: z.string(), deleted: z.boolean() })) } } }, ...commonErrorResponses({ notFound: true }) },
});
