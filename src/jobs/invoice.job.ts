// src/jobs/invoice.job.ts
import { Invoice } from "../models/Invoice";
import { notificationService } from "../services/notification.service";
import { enqueue } from "../services/queue.service";
import { logger } from "../config/logger";

// Matches EMAIL_QUEUE in src/workers/index.ts — kept as a literal to avoid a
// circular import (same reasoning as reminder.job.ts).
const EMAIL_QUEUE = "emails";

/**
 * Flips sent/viewed/partially-paid invoices past their due date to
 * "overdue" and emails the billed account once. Invoice.pre("save") only
 * performs this transition lazily when a document happens to be saved, so
 * without this sweep an untouched invoice would stay "sent" forever.
 * Cross-tenant by design (no request context on a cron tick).
 */
export async function markOverdueInvoices(): Promise<{ checked: number; marked: number }> {
  const overdue = await Invoice.findOverdue();
  let marked = 0;

  for (const invoice of overdue) {
    try {
      invoice.status = "overdue";
      await invoice.save();

      const notification = await notificationService.create({
        tenantId: invoice.tenantId ? String(invoice.tenantId) : undefined,
        recipientId: String(invoice.accountId),
        recipientModel: "Account",
        title: `Invoice ${invoice.invoiceNumber} is overdue`,
        content: `Invoice ${invoice.invoiceNumber} was due on ${invoice.dueDate.toDateString()}. Outstanding balance: ${invoice.amountDue} ${invoice.currency}.`,
        channel: "email",
        type: "payment_overdue",
        priority: "high",
        status: "queued",
      });

      await enqueue(EMAIL_QUEUE, {
        type: "notification_email",
        data: { notificationId: String(notification._id) },
      });

      marked += 1;
    } catch (err) {
      logger.error({
        type: "invoice_overdue_failed",
        invoiceId: String(invoice._id),
        error: (err as Error).message,
      });
    }
  }

  logger.info({ type: "invoice_overdue_check_complete", checked: overdue.length, marked });
  return { checked: overdue.length, marked };
}
