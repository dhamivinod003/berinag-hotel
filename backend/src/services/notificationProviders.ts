// Notification provider abstractions.
// Email + WhatsApp are split out so a future SMS provider can plug in
// without touching business logic. All providers implement the same
// `send` contract and are NEVER trusted to throw — failures are returned
// as `{ ok: false, error }` and logged.

import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { sendEmail, type EmailMessage } from "./emailService.js";

export type Channel = "EMAIL" | "WHATSAPP" | "SMS";

export interface SendResult {
  ok: boolean;
  channel: Channel;
  error?: string;
  messageId?: string;
  devLogged?: boolean;
}

export interface NotificationPayload {
  to: string;            // email OR phone-with-country-code OR phone-with-@
  subject?: string;      // email only
  body: string;          // text body
  htmlBody?: string;     // email only
  meta?: Record<string, unknown>;
}

// ─── Email provider (delegates to emailService) ───────────────────────────

export const emailProvider = {
  channel: "EMAIL" as const,
  isConfigured: () => Boolean(env.SMTP_HOST && env.SMTP_FROM),
  async send(payload: NotificationPayload): Promise<SendResult> {
    if (!payload.to.includes("@")) {
      return { ok: false, channel: "EMAIL", error: "Not an email address" };
    }
    const msg: EmailMessage = {
      to: payload.to,
      subject: payload.subject ?? "(no subject)",
      html: payload.htmlBody ?? `<p>${payload.body}</p>`,
      text: payload.body,
    };
    const r = await sendEmail(msg);
    return {
      ok: r.ok,
      channel: "EMAIL",
      error: r.error,
      messageId: r.messageId,
      devLogged: r.devLogged,
    };
  },
};

// ─── WhatsApp provider (Cloud API ready, dev stub by default) ─────────────

interface WhatsAppProvider {
  channel: "WHATSAPP";
  isConfigured: () => boolean;
  send: (payload: NotificationPayload) => Promise<SendResult>;
}

/**
 * Real WhatsApp Cloud API provider.
 * Activates when WHATSAPP_PHONE_NUMBER_ID + WHATSAPP_ACCESS_TOKEN are set.
 * Endpoint: https://graph.facebook.com/v19.0/<PHONE_ID>/messages
 */
function makeWhatsAppProvider(): WhatsAppProvider {
  return {
    channel: "WHATSAPP",
    isConfigured: () => Boolean(env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_ACCESS_TOKEN),
    async send(payload: NotificationPayload): Promise<SendResult> {
      if (!this.isConfigured()) {
        logger.info(
          { to: payload.to, body: payload.body.slice(0, 200) },
          "💬 [DEV WHATSAPP — not sent] "
        );
        return { ok: true, channel: "WHATSAPP", devLogged: true };
      }
      try {
        // Normalize phone: strip non-digits, ensure country code, no leading +
        const phone = payload.to.replace(/[^0-9]/g, "");
        const url = `https://graph.facebook.com/v19.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: phone,
            type: "text",
            text: { body: payload.body },
          }),
        });
        if (!res.ok) {
          const text = await res.text();
          return { ok: false, channel: "WHATSAPP", error: `${res.status} ${text}` };
        }
        const data = (await res.json()) as { messages?: Array<{ id: string }> };
        return {
          ok: true,
          channel: "WHATSAPP",
          messageId: data.messages?.[0]?.id,
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        logger.error({ err, to: payload.to }, "💬 Failed to send WhatsApp");
        return { ok: false, channel: "WHATSAPP", error };
      }
    },
  };
}

export const whatsappProvider = makeWhatsAppProvider();

// ─── Unified send (best-effort, never throws) ────────────────────────────

export async function notify(channel: Channel, payload: NotificationPayload): Promise<SendResult> {
  try {
    if (channel === "EMAIL") return await emailProvider.send(payload);
    if (channel === "WHATSAPP") return await whatsappProvider.send(payload);
    return { ok: false, channel, error: `Unsupported channel: ${channel}` };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error({ err, channel, payload }, "Notification failed unexpectedly");
    return { ok: false, channel, error };
  }
}
