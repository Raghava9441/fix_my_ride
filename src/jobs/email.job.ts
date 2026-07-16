// src/jobs/email.job.ts
import { sendEmail } from "../config/email";
import { config } from "../config/environment";
import { logger } from "../config/logger";

export type EmailJobType = "email_verification" | "password_reset";

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
};
