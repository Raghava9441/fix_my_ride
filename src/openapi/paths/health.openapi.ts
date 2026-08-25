import { z } from "zod";
import { registry } from "../registry";

const TAGS = ["Health"];

const HealthStatusSchema = z.object({
  status: z.enum(["healthy", "degraded", "unhealthy"]),
  message: z.string().optional(),
  timestamp: z.string(),
});

registry.registerPath({
  method: "get",
  path: "/live",
  tags: TAGS,
  summary: "Liveness probe — process is alive, no dependency checks",
  responses: { 200: { description: "Alive", content: { "application/json": { schema: HealthStatusSchema } } } },
});

registry.registerPath({
  method: "get",
  path: "/ready",
  tags: TAGS,
  summary: "Readiness probe — checks database and Redis",
  responses: {
    200: { description: "Ready", content: { "application/json": { schema: HealthStatusSchema } } },
    503: { description: "Not ready", content: { "application/json": { schema: HealthStatusSchema } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/health",
  tags: TAGS,
  summary: "Detailed health status (database, Redis, process info)",
  responses: {
    200: { description: "Healthy", content: { "application/json": { schema: z.record(z.any()) } } },
    503: { description: "Degraded or unhealthy", content: { "application/json": { schema: z.record(z.any()) } } },
  },
});
