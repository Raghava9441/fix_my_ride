// src/services/whatsapp.service.ts
import { Account } from "../models/Account";
import { Notification } from "../models/Notification";
import { enqueue } from "./queue.service";
import { isWhatsAppEnabled, sendWhatsAppText } from "../config/whatsapp";
import { logger } from "../config/logger";

// Matches WHATSAPP_QUEUE in src/workers/index.ts — literal to avoid a
// circular import (same reasoning as the other jobs).
const WHATSAPP_QUEUE = "whatsapp";

const STOP_WORDS = new Set(["STOP", "STOP ALL", "UNSUBSCRIBE", "CANCEL"]);
const START_WORDS = new Set(["START", "UNSTOP", "SUBSCRIBE", "YES"]);

/**
 * Mirrors a just-created Notification to the recipient's WhatsApp. Called
 * from notificationService.create(), so every update that produces a
 * notification for an Account reaches WhatsApp without each call site
 * knowing about it. Never throws — a WhatsApp/queue problem must not fail
 * the business operation that triggered the notification.
 */
export async function queueWhatsAppForNotification(notificationId: string): Promise<void> {
  if (!isWhatsAppEnabled()) return;
  try {
    await enqueue(WHATSAPP_QUEUE, {
      type: "whatsapp_message",
      data: { notificationId },
      options: { dedupeKey: `wa:${notificationId}` },
    });
  } catch (err) {
    logger.error({
      type: "whatsapp_enqueue_failed",
      notificationId,
      error: (err as Error).message,
    });
  }
}

/** Applies a delivery-status callback from Meta to the originating Notification. */
export async function applyDeliveryStatus(
  messageId: string,
  status: string,
  errorText?: string,
): Promise<void> {
  const set: Record<string, unknown> = {
    "metadata.whatsapp.status": status,
    "metadata.whatsapp.updatedAt": new Date(),
  };
  if (errorText) set["metadata.whatsapp.error"] = errorText;
  await Notification.updateOne({ "metadata.whatsapp.messageId": messageId }, { $set: set });
}

/**
 * Handles an inbound text from a customer. STOP/START toggle the opt-in
 * flag on every account whose stored phone ends in the sender's number
 * (stored numbers may contain spaces/dashes, so match digits loosely).
 */
export async function handleInboundMessage(from: string, text: string): Promise<void> {
  const word = text.trim().toUpperCase();
  const optOut = STOP_WORDS.has(word);
  if (!optOut && !START_WORDS.has(word)) return;

  const tail = from.replace(/\D/g, "").slice(-10);
  if (tail.length < 7) return;
  const loose = new RegExp(`${tail.split("").join("\\D*")}\\D*$`);

  const result = await Account.updateMany(
    { phone: loose },
    { $set: { "preferences.notificationPreferences.whatsapp.enabled": !optOut } },
  );
  logger.info({ type: "whatsapp_opt_change", optedOut: optOut, matched: result.matchedCount });

  // We're inside the 24h customer-service window here, so free text is allowed.
  await sendWhatsAppText(
    from,
    optOut
      ? "You've been unsubscribed from Fix My Ride WhatsApp updates. Reply START to resume."
      : "Welcome back! You'll receive Fix My Ride updates on WhatsApp again.",
  );
}
