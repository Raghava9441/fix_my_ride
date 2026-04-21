// src/config/email.ts
import nodemailer from "nodemailer";
import { logger } from "./logger";
import { config } from "./environment";

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

const createTransporter = () => {
  if (!config.email.host) {
    logger.warn("SMTP host not configured, email sending disabled");
    return null;
  }

  return nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.port === 465,
    auth: config.email.user
      ? {
          user: config.email.user,
          pass: config.email.password,
        }
      : undefined,
    connectionTimeout: 10000,
    socketTimeout: 10000,
  });
};

let emailTransporter = createTransporter();

export const getEmailTransporter = () => {
  if (!emailTransporter) {
    throw new Error("Email transporter not configured");
  }
  return emailTransporter;
};

export const setEmailTransporter = (transporter: nodemailer.Transporter) => {
  emailTransporter = transporter;
};

const validateEmailOptions = (options: EmailOptions): string[] => {
  const errors: string[] = [];
  if (!options.to || (Array.isArray(options.to) && options.to.length === 0)) {
    errors.push("At least one recipient is required");
  }
  if (!options.subject) {
    errors.push("Subject is required");
  }
  if (!options.html && !options.text) {
    errors.push("Either html or text body is required");
  }
  return errors;
};

const normalizeEmails = (emails: string | string[]): string[] => {
  if (typeof emails === "string") {
    return [emails];
  }
  return emails;
};

export const sendEmail = async (
  options: EmailOptions,
): Promise<SendEmailResult> => {
  const errors = validateEmailOptions(options);
  if (errors.length > 0) {
    logger.error("Email validation failed:", errors);
    return { success: false, error: errors.join(", ") };
  }

  if (!emailTransporter) {
    logger.warn("Email transporter not configured, skipping email");
    return { success: false, error: "Email transporter not configured" };
  }

  try {
    const mailOptions = {
      from: options.from || config.email.from,
      to: normalizeEmails(options.to),
      subject: options.subject,
      html: options.html,
      text: options.text,
      cc: options.cc ? normalizeEmails(options.cc) : undefined,
      bcc: options.bcc ? normalizeEmails(options.bcc) : undefined,
      attachments: options.attachments,
    };

    const info = await emailTransporter.sendMail(mailOptions);
    logger.info(`Email sent: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    logger.error("Failed to send email:", err.message);
    return { success: false, error: err.message };
  }
};

export const sendTemplatedEmail = async (
  templateName: string,
  options: EmailOptions,
  templateData: Record<string, any>,
): Promise<SendEmailResult> => {
  const templates: Record<
    string,
    (data: Record<string, any>) => { html: string; text: string }
  > = {
    welcome: (data) => ({
      html: `<h1>Welcome ${data.name}!</h1><p>Thank you for joining us.</p>`,
      text: `Welcome ${data.name}! Thank you for joining us.`,
    }),
    passwordReset: (data) => ({
      html: `<h1>Password Reset</h1><p>Click <a href="${data.resetUrl}">here</a> to reset your password.</p>`,
      text: `Click ${data.resetUrl} to reset your password.`,
    }),
    bookingConfirmation: (data) => ({
      html: `<h1>Booking Confirmed</h1><p>Your appointment is scheduled for ${data.date}.</p>`,
      text: `Your appointment is scheduled for ${data.date}.`,
    }),
  };

  const template = templates[templateName];
  if (!template) {
    return { success: false, error: `Template '${templateName}' not found` };
  }

  const { html, text } = template(templateData);
  return sendEmail({ ...options, html, text });
};

export const checkEmailHealth = async (): Promise<{
  status: string;
  message: string;
}> => {
  if (!emailTransporter) {
    return { status: "unhealthy", message: "Email transporter not configured" };
  }

  try {
    await emailTransporter.verify();
    return { status: "healthy", message: "Email service ready" };
  } catch (err: any) {
    return { status: "unhealthy", message: err.message };
  }
};
