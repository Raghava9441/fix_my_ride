import { Request, Response } from "express";
import Razorpay from "razorpay";
import { BillingService } from "../services/billing.service";
import { config } from "../config/environment";
import { logger } from "../config/logger";
import { HttpStatus, createErrorResponse, createSuccessResponse } from "../utils";

const SUBSCRIPTION_EVENTS = new Set(["subscription.charged"]);
const SUBSCRIPTION_END_EVENTS: Record<string, "cancelled" | "expired"> = {
  "subscription.cancelled": "cancelled",
  "subscription.completed": "expired",
};

export class WebhookController {
  constructor(private readonly billingService: BillingService) {}

  async razorpay(req: Request, res: Response) {
    const signature = req.header("x-razorpay-signature");
    if (!signature) {
      const error = createErrorResponse("Missing webhook signature", HttpStatus.BAD_REQUEST);
      return res.status(error.statusCode).json(error.toJSON());
    }

    if (!req.rawBody) {
      // Should never happen — express.json()'s verify callback in app.ts
      // always sets this — but fail closed rather than skip verification.
      logger.error({ type: "webhook_missing_raw_body" });
      const error = createErrorResponse("Unable to verify request", HttpStatus.BAD_REQUEST);
      return res.status(error.statusCode).json(error.toJSON());
    }

    if (!config.razorpay.webhookSecret) {
      logger.error({ type: "webhook_secret_not_configured" });
      const error = createErrorResponse("Webhooks are not configured", HttpStatus.SERVICE_UNAVAILABLE);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const isValid = Razorpay.validateWebhookSignature(
      req.rawBody.toString(),
      signature,
      config.razorpay.webhookSecret,
    );
    if (!isValid) {
      logger.warn({ type: "webhook_invalid_signature", event: req.body?.event });
      const error = createErrorResponse("Invalid webhook signature", HttpStatus.UNAUTHORIZED);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const event = req.body?.event as string | undefined;
    const payload = req.body?.payload ?? {};

    try {
      if (event && SUBSCRIPTION_EVENTS.has(event)) {
        const subscriptionEntity = payload.subscription?.entity;
        const paymentEntity = payload.payment?.entity;
        if (subscriptionEntity && paymentEntity) {
          await this.billingService.handleSubscriptionCharged(subscriptionEntity, paymentEntity);
        }
      } else if (event && event in SUBSCRIPTION_END_EVENTS) {
        const subscriptionEntity = payload.subscription?.entity;
        if (subscriptionEntity) {
          await this.billingService.handleSubscriptionEnded(
            subscriptionEntity,
            SUBSCRIPTION_END_EVENTS[event],
          );
        }
      } else if (event === "payment.captured") {
        const paymentEntity = payload.payment?.entity;
        if (paymentEntity) {
          await this.billingService.handlePaymentCaptured(paymentEntity);
        }
      } else if (event === "payment.failed") {
        const paymentEntity = payload.payment?.entity;
        if (paymentEntity) {
          await this.billingService.handlePaymentFailed(paymentEntity);
        }
      } else {
        logger.info({ type: "webhook_event_ignored", event });
      }
    } catch (err) {
      // Don't propagate to the global error handler / a 5xx — a permanent
      // local bug here shouldn't put Razorpay into an endless retry loop.
      // Ack the delivery and rely on our own logs/alerting to catch it.
      logger.error({
        type: "webhook_processing_failed",
        event,
        error: (err as Error).message,
      });
    }

    const response = createSuccessResponse(null, "Webhook received");
    return res.status(response.statusCode).json(response.toJSON());
  }
}
