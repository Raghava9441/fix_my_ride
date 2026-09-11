import { Router, Request, Response } from "express";
import { asyncHandler } from "../utils";
import { WebhookController } from "../controllers/webhook.controller";
import { billingService } from "../services/billing.service";
import { logger } from "../config/logger";

// Deliberately unauthenticated — Razorpay calls this directly, not a
// logged-in user. Signature verification (webhook.controller.ts) is what
// substitutes for authenticate here. /api/v1/webhooks is already a
// tenant-isolation-exempt public prefix (tenant.middleware.ts) and skipped
// by rate limiting (config/rate-limit.ts).
const router = Router();

const webhookController = new WebhookController(billingService);

router.post(
  "/razorpay",
  asyncHandler(async (req: Request, res: Response) => {
    await webhookController.razorpay(req, res);
  }),
);

// POC endpoint: logs the payload the GitHub Actions POC workflow sends,
// standing in for a real Jira issue-update call, so it's visible in this
// service's own logs instead of a third-party mock API.
router.post(
  "/poc-jira-sync",
  asyncHandler(async (req: Request, res: Response) => {
    logger.info("POC Jira sync payload received", { body: req.body });
    res.status(200).json({ received: true, timestamp: new Date().toISOString() });
  }),
);

export default router;
