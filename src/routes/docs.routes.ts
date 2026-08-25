import { Router, Request, Response } from "express";
import { apiReference } from "@scalar/express-api-reference";
import { buildOpenApiDocument } from "../openapi/document";

const router = Router();

// Cached at module load — the spec is derived from route/DTO registrations
// that don't change at runtime, so there's no need to rebuild it per request.
const openApiDocument = buildOpenApiDocument();

router.get("/openapi.json", (_req: Request, res: Response) => {
  res.json(openApiDocument);
});

router.use(
  "/",
  apiReference({
    url: "/api-docs/openapi.json",
    metaData: { title: "Fix My Ride API Reference" },
  }),
);

export default router;
