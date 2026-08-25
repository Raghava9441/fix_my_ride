import { OpenAPIRegistry, extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

// Patches the Zod prototype with `.openapi(...)` for attaching metadata
// (names, examples, descriptions). Must run before any schema is registered
// or passed to registerPath — every file under src/openapi/paths/ imports
// `registry` from here first, which is what guarantees that ordering.
extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description:
    "Access token from POST /api/v1/auth/login or /register. Send as `Authorization: Bearer <token>`.",
});
