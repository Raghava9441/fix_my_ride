import { z } from "zod";
import { registry } from "../registry";
import { successEnvelope, commonErrorResponses, BEARER_AUTH, IdParamSchema } from "../common";
import { CreateSubscriptionSchema, CancelSubscriptionSchema } from "../../dto/subscription.dto";

const TAGS = ["Subscriptions"];
const record = z.record(z.any());
const jsonBody = <T extends z.ZodTypeAny>(schema: T) => ({ body: { content: { "application/json": { schema } } } });
const base = "/api/v1/subscriptions";

registry.registerPath({
  method: "get", path: `${base}/me`, tags: TAGS, summary: "Get the caller's tenant's active subscription", security: BEARER_AUTH,
  responses: { 200: { description: "Active subscription", content: { "application/json": { schema: successEnvelope("MySubscriptionResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "post", path: `${base}/subscribe`, tags: TAGS, summary: "Subscribe the caller's tenant to a plan (owner only)", security: BEARER_AUTH, request: jsonBody(CreateSubscriptionSchema),
  responses: {
    201: {
      description:
        "Subscription created. For paid plans, `checkoutUrl` is the Razorpay-hosted page the customer must visit to authorize the recurring mandate — the subscription only actually activates once billing.service.ts processes the resulting webhook. Free plans activate immediately with no checkoutUrl.",
      content: { "application/json": { schema: successEnvelope("SubscribeResponse", z.object({ subscription: record, checkoutUrl: z.string().optional() })) } },
    },
    400: { description: "Plan not found, already subscribed, plan not registered with the payment provider, or provider not configured" },
    ...commonErrorResponses({ validate: true }),
  },
});

registry.registerPath({
  method: "post", path: `${base}/{id}/cancel`, tags: TAGS, summary: "Cancel a subscription (owner or admin)", security: BEARER_AUTH, request: { params: IdParamSchema, ...jsonBody(CancelSubscriptionSchema) },
  responses: {
    200: { description: "Subscription cancelled (immediately, or at period end)", content: { "application/json": { schema: successEnvelope("SubscriptionResponse", record) } } },
    403: { description: "Not your tenant's subscription" },
    ...commonErrorResponses({ notFound: true, validate: true }),
  },
});
