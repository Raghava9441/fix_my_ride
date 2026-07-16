// src/routes/health.routes.ts
import { Router, Request, Response } from "express";
import { liveness, readiness, detailed } from "../services/health.service";

const router = Router();

// Liveness probe (process alive, no deps)
router.get("/live", (_req: Request, res: Response) => {
  const result = liveness();
  res.status(200).json({ status: result.status, timestamp: new Date().toISOString() });
});

// Readiness probe (deps ready)
router.get("/ready", async (_req: Request, res: Response) => {
  const result = await readiness();
  const code = result.status === "healthy" ? 200 : 503;
  res.status(code).json({ ...result, timestamp: new Date().toISOString() });
});

// Detailed status
router.get("/health", async (_req: Request, res: Response) => {
  const result = await detailed();
  const code = result.status === "healthy" ? 200 : 503;
  res.status(code).json({ ...result, timestamp: new Date().toISOString() });
});

export default router;
