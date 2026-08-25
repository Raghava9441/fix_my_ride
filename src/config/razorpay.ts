// src/config/razorpay.ts
import Razorpay from "razorpay";
import { logger } from "./logger";
import { config } from "./environment";

let client: Razorpay | null = null;
let attempted = false;

/**
 * Lazily-constructed singleton, mirroring config/email.ts's
 * createTransporter() pattern: returns null (rather than throwing) when
 * keys aren't configured, so local dev without real Razorpay test keys
 * doesn't crash — callers decide how to degrade (skip provider
 * registration, log a warning, etc).
 */
export function getRazorpayClient(): Razorpay | null {
  if (!attempted) {
    attempted = true;
    if (!config.razorpay.keyId || !config.razorpay.keySecret) {
      logger.warn("Razorpay key_id/key_secret not configured, payment provider calls disabled");
    } else {
      client = new Razorpay({
        key_id: config.razorpay.keyId,
        key_secret: config.razorpay.keySecret,
      });
    }
  }
  return client;
}
