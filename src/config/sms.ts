// src/config/sms.ts
import twilio from "twilio";
import { logger } from "./logger";
import { config } from "./environment";

export interface SmsOptions {
  to: string;
  body: string;
  from?: string;
}

export interface SendSmsResult {
  success: boolean;
  messageSid?: string;
  error?: string;
}

let twilioClient: twilio.Twilio | null = null;

export const getTwilioClient = (): twilio.Twilio => {
  if (!twilioClient) {
    if (!config.sms.accountSid || !config.sms.authToken) {
      throw new Error("Twilio not configured");
    }
    twilioClient = twilio(config.sms.accountSid, config.sms.authToken);
  }
  return twilioClient;
};

const validatePhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone.replace(/[\s-()]/g, ""));
};

export const sendSms = async (options: SmsOptions): Promise<SendSmsResult> => {
  if (!options.to || !validatePhoneNumber(options.to)) {
    return { success: false, error: "Invalid phone number" };
  }

  if (!config.sms.accountSid || !config.sms.authToken) {
    logger.warn("Twilio not configured, SMS sending disabled");
    return { success: false, error: "Twilio not configured" };
  }

  try {
    const client = getTwilioClient();
    const message = await client.messages.create({
      body: options.body,
      from: options.from || config.sms.phoneNumber,
      to: options.to,
    });

    logger.info(`SMS sent: ${message.sid}`);
    return { success: true, messageSid: message.sid };
  } catch (err: any) {
    logger.error("Failed to send SMS:", err.message);
    return { success: false, error: err.message };
  }
};

export const sendVerificationSms = async (
  phone: string,
  code: string,
): Promise<SendSmsResult> => {
  return sendSms({
    to: phone,
    body: `Your verification code is: ${code}. Valid for 10 minutes.`,
  });
};

export const sendBookingNotification = async (
  phone: string,
  serviceName: string,
  dateTime: string,
): Promise<SendSmsResult> => {
  return sendSms({
    to: phone,
    body: `Your ${serviceName} appointment is confirmed for ${dateTime}.`,
  });
};

export const sendAppointmentReminder = async (
  phone: string,
  serviceName: string,
): Promise<SendSmsResult> => {
  return sendSms({
    to: phone,
    body: `Reminder: Your ${serviceName} appointment is coming up tomorrow.`,
  });
};

export const checkSmsHealth = async (): Promise<{
  status: string;
  message: string;
}> => {
  if (!config.sms.accountSid || !config.sms.authToken) {
    return { status: "unhealthy", message: "Twilio not configured" };
  }

  try {
    const client = getTwilioClient();
    await client.api.accounts(config.sms.accountSid).fetch();
    return { status: "healthy", message: "SMS service ready" };
  } catch (err: any) {
    return { status: "unhealthy", message: err.message };
  }
};
