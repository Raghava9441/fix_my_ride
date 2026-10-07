import { Request, Response } from "express";
import { config } from "../config/environment";
import { logger } from "../config/logger";
import { verifyWhatsAppSignature } from "../config/whatsapp";
import { applyDeliveryStatus, handleInboundMessage } from "../services/whatsapp.service";

export class WhatsAppWebhookController {
  /** GET — Meta's one-time subscription handshake. */
  verify(req: Request, res: Response) {
    const { "hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge } = req.query;
    if (
      config.whatsapp.webhookVerifyToken &&
      mode === "subscribe" &&
      token === config.whatsapp.webhookVerifyToken
    ) {
      return res.status(200).type("text/plain").send(String(challenge));
    }
    return res.sendStatus(403);
  }

  /** POST — delivery receipts and inbound customer messages. */
  async receive(req: Request, res: Response) {
    if (!config.whatsapp.appSecret) {
      logger.error({ type: "whatsapp_webhook_secret_not_configured" });
      return res.sendStatus(503);
    }
    if (!req.rawBody || !verifyWhatsAppSignature(req.rawBody, req.header("x-hub-signature-256"))) {
      logger.warn({ type: "whatsapp_webhook_invalid_signature" });
      return res.sendStatus(401);
    }

    // Acknowledge first: Meta retries aggressively on slow/non-200 responses.
    res.sendStatus(200);

    try {
      for (const entry of req.body?.entry ?? []) {
        for (const change of entry.changes ?? []) {
          const value = change.value ?? {};
          for (const status of value.statuses ?? []) {
            await applyDeliveryStatus(status.id, status.status, status.errors?.[0]?.title);
          }
          for (const message of value.messages ?? []) {
            if (message.type === "text" && message.text?.body) {
              await handleInboundMessage(message.from, message.text.body);
            }
          }
        }
      }
    } catch (err) {
      logger.error({ type: "whatsapp_webhook_processing_failed", error: (err as Error).message });
    }
  }
}
