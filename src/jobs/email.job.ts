// src/jobs/email.job.ts
import { sendEmail } from "../config/email";
import { config } from "../config/environment";
import { logger } from "../config/logger";
import { Account } from "../models/Account";
import { invoiceService } from "../services/invoice.service";
import { notificationService } from "../services/notification.service";

export type EmailJobType =
  | "email_verification"
  | "password_reset"
  | "org_submitted_for_review"
  | "org_approved"
  | "org_rejected"
  | "invitation"
  | "invoice_email";

/**
 * Handlers consumed by the queue worker. Each handler is idempotent and
 * safe to retry. Email delivery failures are thrown so the worker retries.
 */
export const emailHandlers: Record<EmailJobType, (data: Record<string, any>) => Promise<void>> = {
  async email_verification(data) {
    const token = data.token;
    if (!token || !data.email) {
      throw new Error("email_verification job missing token or email");
    }
    const url = `${config.appUrl}/verify-email?token=${encodeURIComponent(token)}`;
    const result = await sendEmail({
      to: data.email,
      subject: "Verify your email - Fix My Ride",
      html: `<p>Please verify your email by clicking <a href="${url}">here</a>.</p>`,
      text: `Verify your email: ${url}`,
    });
    if (!result.success) throw new Error(result.error || "Email send failed");
  },

  async password_reset(data) {
    const token = data.token;
    if (!token || !data.email) {
      throw new Error("password_reset job missing token or email");
    }
    const url = `${config.appUrl}/reset-password?token=${encodeURIComponent(token)}`;
    const result = await sendEmail({
      to: data.email,
      subject: "Reset your password - Fix My Ride",
      html: `<p>Reset your password by clicking <a href="${url}">here</a>. This link expires in 1 hour.</p>`,
      text: `Reset your password: ${url}`,
    });
    if (!result.success) throw new Error(result.error || "Email send failed");
  },

  async org_submitted_for_review(data) {
    if (!data.email || !data.organizationName) {
      throw new Error("org_submitted_for_review job missing email or organizationName");
    }
    const result = await sendEmail({
      to: data.email,
      subject: "We've received your application - Fix My Ride",
      html: `<p>Thanks for signing up ${data.organizationName}! We're reviewing your application and will email you once it's approved — usually within one business day.</p>`,
      text: `Thanks for signing up ${data.organizationName}! We're reviewing your application and will email you once it's approved.`,
    });
    if (!result.success) throw new Error(result.error || "Email send failed");
  },

  async org_approved(data) {
    if (!data.email || !data.organizationName) {
      throw new Error("org_approved job missing email or organizationName");
    }
    const url = `${config.appUrl}/login`;
    const result = await sendEmail({
      to: data.email,
      subject: "You're approved! - Fix My Ride",
      html: `<p>${data.organizationName} is approved and ready to go. <a href="${url}">Log in</a> to get started.</p>`,
      text: `${data.organizationName} is approved and ready to go. Log in: ${url}`,
    });
    if (!result.success) throw new Error(result.error || "Email send failed");
  },

  async org_rejected(data) {
    if (!data.email || !data.organizationName) {
      throw new Error("org_rejected job missing email or organizationName");
    }
    const reasonText = data.reason ? ` Reason: ${data.reason}` : "";
    const result = await sendEmail({
      to: data.email,
      subject: "Update on your application - Fix My Ride",
      html: `<p>We were unable to approve ${data.organizationName}'s application at this time.${reasonText ? ` ${reasonText}` : ""}</p>`,
      text: `We were unable to approve ${data.organizationName}'s application at this time.${reasonText}`,
    });
    if (!result.success) throw new Error(result.error || "Email send failed");
  },

  async invitation(data) {
    if (!data.email || !data.token) {
      throw new Error("invitation job missing email or token");
    }
    const url = `${config.appUrl}/invitations/accept?token=${encodeURIComponent(data.token)}`;
    const inviterText = data.inviterName ? `${data.inviterName} invited you` : "You've been invited";
    const messageText = data.message ? `<p>${data.message}</p>` : "";
    const result = await sendEmail({
      to: data.email,
      subject: "You've been invited - Fix My Ride",
      html: `<p>${inviterText} to Fix My Ride.</p>${messageText}<p><a href="${url}">Accept invitation</a></p>`,
      text: `${inviterText} to Fix My Ride. Accept: ${url}`,
    });
    if (!result.success) throw new Error(result.error || "Email send failed");
  },

  async invoice_email(data) {
    if (!data.invoiceId) {
      throw new Error("invoice_email job missing invoiceId");
    }

    // Re-renders (and re-stores) the PDF so the attachment matches the
    // invoice's current state even if it was edited since being queued.
    const { invoice, buffer } = await invoiceService.generatePdf(data.invoiceId);
    if (["void", "cancelled"].includes(invoice.status)) return;

    const to =
      invoice.billingEmail ?? (await Account.findById(invoice.accountId).select("email"))?.email;
    if (!to) {
      throw new Error(`Invoice ${invoice.invoiceNumber} has no billing email`);
    }

    const link = invoice.pdf?.url?.startsWith("/")
      ? `${config.appUrl}${invoice.pdf.url}`
      : invoice.pdf?.url;
    const due = new Date(invoice.dueDate).toISOString().slice(0, 10);
    const amount = `${invoice.currency} ${invoice.amountDue.toFixed(2)}`;

    const result = await sendEmail({
      to,
      subject: `Invoice ${invoice.invoiceNumber} - Fix My Ride`,
      html: `<p>Hi${invoice.billingName ? ` ${invoice.billingName}` : ""},</p><p>Your invoice <b>${invoice.invoiceNumber}</b> for <b>${amount}</b> is due on ${due}. It is attached as a PDF.</p>${link ? `<p><a href="${link}">View invoice online</a></p>` : ""}`,
      text: `Your invoice ${invoice.invoiceNumber} for ${amount} is due on ${due}.${link ? ` View: ${link}` : ""}`,
      attachments: [
        { filename: `${invoice.invoiceNumber}.pdf`, content: buffer, contentType: "application/pdf" },
      ],
    });
    if (!result.success) throw new Error(result.error || "Email send failed");

    invoice.emailedAt = new Date();
    await invoice.save();

    // In-app notice so the owner also sees it in /notifications. Failure here
    // must not fail the job — that would re-send the email on retry.
    try {
      await notificationService.create({
        tenantId: invoice.tenantId ? String(invoice.tenantId) : undefined,
        recipientId: String(invoice.accountId),
        recipientModel: "Account",
        title: `New invoice ${invoice.invoiceNumber}`,
        content: `Invoice ${invoice.invoiceNumber} for ${amount} is due on ${due}.${link ? ` View/download: ${link}` : ""}`,
        channel: "in_app",
        type: "invoice_generated",
        data: { customData: { invoiceId: String(invoice._id), pdfUrl: invoice.pdf?.url } },
        priority: "medium",
        status: "sent",
      });
    } catch (err) {
      logger.error({
        type: "invoice_notification_failed",
        invoiceId: String(invoice._id),
        error: (err as Error).message,
      });
    }
  },
};
