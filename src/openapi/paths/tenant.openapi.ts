import { z } from "zod";
import { registry } from "../registry";
import { successEnvelope, commonErrorResponses, BEARER_AUTH } from "../common";
import { UpdateMyTenantSchema } from "../../dto/tenant.dto";

const TAGS = ["Tenants"];
const record = z.record(z.any());
const jsonBody = <T extends z.ZodTypeAny>(schema: T) => ({ body: { content: { "application/json": { schema } } } });
const base = "/api/v1/tenants";

registry.registerPath({
  method: "get", path: `${base}/me`, tags: TAGS, summary: "Get the caller's own tenant (organization)", security: BEARER_AUTH,
  responses: { 200: { description: "Tenant", content: { "application/json": { schema: successEnvelope("MyTenantResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "patch", path: `${base}/me`, tags: TAGS, summary: "Update the caller's own tenant settings (owner only)", security: BEARER_AUTH, request: jsonBody(UpdateMyTenantSchema),
  responses: {
    200: { description: "Tenant updated", content: { "application/json": { schema: successEnvelope("MyTenantResponse", record) } } },
    ...commonErrorResponses({ notFound: true, validate: true }),
  },
});
