import { z } from "zod";
import { registry } from "../registry";
import { successEnvelope, paginatedEnvelope, commonErrorResponses, BEARER_AUTH, IdParamSchema, PaginationQuerySchema } from "../common";

// Read-only by design — Payment records are only ever written by the
// verified Razorpay webhook flow (billing.service.ts), never a direct
// client request, so there is no create/update endpoint to document here.
const TAGS = ["Payments"];
const record = z.record(z.any());
const base = "/api/v1/payments";

registry.registerPath({
  method: "get", path: base, tags: TAGS, summary: "List all payments (admin only)", security: BEARER_AUTH,
  request: { query: PaginationQuerySchema.extend({ accountId: z.string().optional(), serviceCenterId: z.string().optional(), tenantId: z.string().optional(), type: z.string().optional(), status: z.string().optional(), provider: z.string().optional() }) },
  responses: { 200: { description: "Payments", content: { "application/json": { schema: paginatedEnvelope("PaymentListResponse", record) } } }, ...commonErrorResponses() },
});

registry.registerPath({
  method: "get", path: `${base}/mine`, tags: TAGS, summary: "List the caller's own payments", security: BEARER_AUTH,
  responses: { 200: { description: "Payments", content: { "application/json": { schema: successEnvelope("MyPaymentsResponse", z.array(record)) } } }, ...commonErrorResponses() },
});

registry.registerPath({
  method: "get", path: `${base}/stats`, tags: TAGS, summary: "Get the caller's payment stats grouped by status", security: BEARER_AUTH,
  request: { query: z.object({ startDate: z.string().datetime().optional(), endDate: z.string().datetime().optional() }) },
  responses: { 200: { description: "Stats", content: { "application/json": { schema: successEnvelope("PaymentStatsResponse", z.array(record)) } } }, ...commonErrorResponses() },
});

registry.registerPath({
  method: "get", path: `${base}/{id}`, tags: TAGS, summary: "Get a payment by id (own payments, or any as admin)", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: {
    200: { description: "Payment", content: { "application/json": { schema: successEnvelope("PaymentResponse", record) } } },
    403: { description: "Not your payment" },
    ...commonErrorResponses({ notFound: true }),
  },
});
