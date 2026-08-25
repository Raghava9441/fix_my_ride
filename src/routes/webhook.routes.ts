import { Router, Request, Response } from "express";
import { asyncHandler } from "../utils";
import { WebhookController } from "../controllers/webhook.controller";
import { billingService } from "../services/billing.service";

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

export default router;
