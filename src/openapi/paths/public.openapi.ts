import { z } from "zod";
import { registry } from "../registry";
import { successEnvelope, commonErrorResponses } from "../common";

// public.controller.ts is still fully mocked (not part of the controller
// wiring pass that made most of this API real) — documented honestly as
// such rather than implying these return real data.
const TAGS = ["Public"];
const MOCK_NOTE = " Note: this endpoint currently returns placeholder/mock data, not real records.";
const record = z.record(z.any());
const base = "/api/v1/public";

const endpoints: Array<["get" | "post", string, string]> = [
  ["get", "/health", "Basic health check"],
  ["get", "/health/detailed", "Detailed health check"],
  ["get", "/info", "System info"],
  ["get", "/version", "API version"],
  ["get", "/service-centers", "List public service center listings"],
  ["get", "/service-centers/{id}", "Get a public service center listing"],
  ["get", "/service-centers/{id}/reviews", "List public reviews for a service center"],
  ["post", "/contact", "Submit a contact form"],
  ["post", "/newsletter/subscribe", "Subscribe to the newsletter"],
  ["post", "/newsletter/unsubscribe", "Unsubscribe from the newsletter"],
  ["get", "/demo/request", "Request a product demo"],
  ["get", "/onboarding/status", "Get onboarding status"],
];

for (const [method, path, summary] of endpoints) {
  const hasIdParam = path.includes("{id}");
  registry.registerPath({
    method,
    path: `${base}${path}`,
    tags: TAGS,
    summary: summary + MOCK_NOTE,
    request: hasIdParam ? { params: z.object({ id: z.string() }) } : undefined,
    responses: {
      200: { description: "OK", content: { "application/json": { schema: successEnvelope("PublicResponse", record) } } },
      ...commonErrorResponses({ auth: false }),
    },
  });
}
