import { OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { registry } from "./registry";
import "./paths"; // side-effect imports: every *.openapi.ts file registers its paths here

export function buildOpenApiDocument() {
  const generator = new OpenApiGeneratorV31(registry.definitions);

  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "Fix My Ride API",
      version: "1.0.0",
      description:
        "Multi-tenant vehicle service management API. Generated directly from this codebase's Zod DTOs — see docs/api-standards.md for the response envelope shape and docs/multi-tenancy.md for how `tenantId` scoping works under the hood.",
    },
    // Root, not /api/v1 — health checks mount at root while everything else
    // is under /api/v1, so every registered path below is fully-qualified
    // rather than relying on a single shared server-prefix shortcut.
    servers: [{ url: "/", description: "Current server" }],
  });
}
