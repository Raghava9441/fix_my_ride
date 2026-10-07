// src/config/whatsapp.ts
import crypto from "crypto";
import { logger } from "./logger";
import { config } from "./environment";

export interface SendWhatsAppResult {
  success: boolean;
  messageId?: string;
  error?: string;
  /** True when retrying can't help (bad number, not configured). */
  permanent?: boolean;
}

export const isWhatsAppEnabled = (): boolean =>
  Boolean(config.whatsapp.accessToken && config.whatsapp.phoneNumberId);

/**
 * Normalises a stored phone number to the digits-only international format
 * the Cloud API expects (no "+", no spaces). Numbers without a country code
 * get WHATSAPP_DEFAULT_COUNTRY_CODE prepended; a leading "0" trunk prefix is
 * dropped first. Returns null when the result isn't a plausible E.164 number.
 */
export const normalizeWhatsAppNumber = (raw?: string | null): string | null => {
  if (!raw) return null;
  const trimmed = raw.trim();
  const hadPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  if (!hadPlus) {
    if (trimmed.startsWith("00")) {
      digits = digits.slice(2);
    } else {
      digits = digits.replace(/^0+/, "");
      // A bare national number (e.g. 10 digits) gets the default country code.
      if (digits.length <= 10) digits = `${config.whatsapp.defaultCountryCode}${digits}`;
    }
  }
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
};

async function postMessage(payload: Record<string, unknown>): Promise<SendWhatsAppResult> {
  if (!isWhatsAppEnabled()) {
    return { success: false, error: "WhatsApp not configured", permanent: true };
  }

  const url = `https://graph.facebook.com/${config.whatsapp.apiVersion}/${config.whatsapp.phoneNumberId}/messages`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.whatsapp.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
      signal: AbortSignal.timeout(10000),
    });
    const body: any = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message = body?.error?.message ?? `HTTP ${res.status}`;
      logger.error({ type: "whatsapp_send_failed", status: res.status, error: message });
      // 4xx (other than rate limiting) won't succeed on retry.
      return { success: false, error: message, permanent: res.status < 500 && res.status !== 429 };
    }

    return { success: true, messageId: body?.messages?.[0]?.id };
  } catch (err: any) {
    logger.error({ type: "whatsapp_send_error", error: err.message });
    return { success: false, error: err.message };
  }
}

export const sendWhatsAppText = (to: string, body: string): Promise<SendWhatsAppResult> =>
  postMessage({ to, type: "text", text: { body, preview_url: true } });

export const sendWhatsAppTemplate = (
  to: string,
  templateName: string,
  language: string,
  params: string[],
): Promise<SendWhatsAppResult> =>
  postMessage({
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: language },
      components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }],
    },
  });

/**
 * Sends a notification using the approved template when one is configured,
 * otherwise as free-form text. Template params can't contain newlines/tabs
 * or 4+ consecutive spaces, so they're flattened.
 */
export const sendWhatsAppNotification = (
  to: string,
  title: string,
  content: string,
): Promise<SendWhatsAppResult> => {
  if (config.whatsapp.templateName) {
    const flat = (s: string) => s.replace(/[\r\n\t]+/g, " ").replace(/ {4,}/g, "   ").trim();
    return sendWhatsAppTemplate(to, config.whatsapp.templateName, config.whatsapp.templateLanguage, [
      flat(title),
      flat(content),
    ]);
  }
  return sendWhatsAppText(to, `*${title}*\n${content}`);
};

/** Verifies Meta's X-Hub-Signature-256 header against the raw request body. */
export const verifyWhatsAppSignature = (rawBody: Buffer, header?: string): boolean => {
  if (!config.whatsapp.appSecret || !header?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", config.whatsapp.appSecret).update(rawBody).digest("hex");
  const given = header.slice("sha256=".length);
  return (
    given.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))
  );
};

export const checkWhatsAppHealth = async (): Promise<{ status: string; message: string }> => {
  if (!isWhatsAppEnabled()) {
    return { status: "disabled", message: "WhatsApp not configured" };
  }
  try {
    const res = await fetch(
      `https://graph.facebook.com/${config.whatsapp.apiVersion}/${config.whatsapp.phoneNumberId}`,
      {
        headers: { Authorization: `Bearer ${config.whatsapp.accessToken}` },
        signal: AbortSignal.timeout(5000),
      },
    );
    return res.ok
      ? { status: "healthy", message: "WhatsApp service ready" }
      : { status: "unhealthy", message: `HTTP ${res.status}` };
  } catch (err: any) {
    return { status: "unhealthy", message: err.message };
  }
};
