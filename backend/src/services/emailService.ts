// Email service — Nodemailer-backed, provider-agnostic.
// All email sending is fire-and-forget at the call site. Failures are logged but
// never throw, so a broken SMTP server can NEVER roll back a confirmed booking.
//
// To plug in a real provider in production: set SMTP_HOST/SMTP_USER/SMTP_PASS/SMTP_FROM.
// To disable in dev: leave SMTP_HOST empty → emails are logged to console.

import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

let transporter: Transporter | null = null;
let verifiedOnce = false;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;
  if (!env.SMTP_HOST) return null;
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth:
      env.SMTP_USER && env.SMTP_PASS
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
        : undefined,
  });
  return transporter;
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface EmailResult {
  ok: boolean;
  messageId?: string;
  previewUrl?: string;
  error?: string;
  devLogged?: boolean;
}

/** Send an email. NEVER throws — always resolves with a result. */
export async function sendEmail(msg: EmailMessage): Promise<EmailResult> {
  const from = msg.from ?? env.SMTP_FROM ?? "no-reply@sunandwaterresort.com";
  const t = getTransporter();
  if (!t) {
    // Dev mode: log to console and return a fake success. Nodemailer would normally
    // give us Ethereal preview URLs here, but we keep things dependency-free in dev.
    logger.info(
      {
        from,
        to: msg.to,
        subject: msg.subject,
        preview: msg.text ?? msg.html.replace(/<[^>]+>/g, "").slice(0, 200),
      },
      "📧 [DEV EMAIL — not sent] "
    );
    return { ok: true, devLogged: true };
  }

  try {
    const info = await t.sendMail({ from, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text });
    if (!verifiedOnce) {
      verifiedOnce = true;
      logger.info({ host: env.SMTP_HOST, user: env.SMTP_USER }, "📧 SMTP transport verified");
    }
    return {
      ok: true,
      messageId: info.messageId,
      previewUrl: typeof nodemailer.getTestMessageUrl(info) === "string" ? (nodemailer.getTestMessageUrl(info) as string) : undefined,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error({ err, to: msg.to, subject: msg.subject }, "📧 Failed to send email");
    return { ok: false, error };
  }
}

// ─── Templates ────────────────────────────────────────────────────────────

export interface BookingConfirmationData {
  guestName: string;
  bookingReference: string;
  roomTypeName: string;
  checkIn: string; // ISO
  checkOut: string; // ISO
  nights: number;
  roomsCount: number;
  guests: number;
  totalPaise: number;
  resortName: string;
  resortPhone: string;
  resortEmail: string;
}

function formatINR(paise: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function bookingConfirmationTemplate(d: BookingConfirmationData): { subject: string; html: string; text: string } {
  const subject = `Booking confirmed — ${d.bookingReference} at ${d.resortName}`;
  const text = `Hi ${d.guestName},

Your booking at ${d.resortName} is confirmed.

Reference: ${d.bookingReference}
Room: ${d.roomTypeName}
Check-in: ${formatDate(d.checkIn)}
Check-out: ${formatDate(d.checkOut)}
Nights: ${d.nights}
Rooms: ${d.roomsCount}
Guests: ${d.guests}
Total: ${formatINR(d.totalPaise)}

We can't wait to host you. If you have any questions, reach us at ${d.resortPhone} or ${d.resortEmail}.

— ${d.resortName}`;

  const html = `<!doctype html>
<html><head><meta charset="utf-8" /><title>${subject}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1d1d1f;">
  <div style="border-bottom: 1px solid #e5e5e7; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="margin: 0; font-size: 22px; font-weight: 600; color: #1d1d1f;">${d.resortName}</h1>
  </div>
  <p style="font-size: 16px;">Hi ${d.guestName},</p>
  <p style="font-size: 16px;">Your booking is confirmed. We can't wait to host you.</p>
  <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
    <tr><td style="padding: 8px 0; color: #6e6e73;">Reference</td><td style="padding: 8px 0; font-weight: 600;">${d.bookingReference}</td></tr>
    <tr><td style="padding: 8px 0; color: #6e6e73;">Room</td><td style="padding: 8px 0; font-weight: 600;">${d.roomTypeName}</td></tr>
    <tr><td style="padding: 8px 0; color: #6e6e73;">Check-in</td><td style="padding: 8px 0; font-weight: 600;">${formatDate(d.checkIn)}</td></tr>
    <tr><td style="padding: 8px 0; color: #6e6e73;">Check-out</td><td style="padding: 8px 0; font-weight: 600;">${formatDate(d.checkOut)}</td></tr>
    <tr><td style="padding: 8px 0; color: #6e6e73;">Nights</td><td style="padding: 8px 0;">${d.nights}</td></tr>
    <tr><td style="padding: 8px 0; color: #6e6e73;">Rooms</td><td style="padding: 8px 0;">${d.roomsCount}</td></tr>
    <tr><td style="padding: 8px 0; color: #6e6e73;">Guests</td><td style="padding: 8px 0;">${d.guests}</td></tr>
    <tr><td style="padding: 8px 0; color: #6e6e73; border-top: 1px solid #e5e5e7;">Total</td><td style="padding: 8px 0; font-weight: 600; font-size: 18px; border-top: 1px solid #e5e5e7;">${formatINR(d.totalPaise)}</td></tr>
  </table>
  <p style="font-size: 14px; color: #6e6e73;">Questions? Reach us at <a href="tel:${d.resortPhone}">${d.resortPhone}</a> or <a href="mailto:${d.resortEmail}">${d.resortEmail}</a>.</p>
  <p style="font-size: 14px; color: #6e6e73; margin-top: 32px;">— ${d.resortName}</p>
</body></html>`;

  return { subject, html, text };
}

export interface PaymentReceiptData {
  guestName: string;
  bookingReference: string;
  amountPaise: number;
  paymentId: string;
  paidAt: string;
  method: string;
  resortName: string;
}

export function paymentReceiptTemplate(d: PaymentReceiptData): { subject: string; html: string; text: string } {
  const subject = `Payment received — ${d.bookingReference}`;
  const text = `Hi ${d.guestName},

We've received your payment of ${formatINR(d.amountPaise)} for booking ${d.bookingReference}.
Payment ID: ${d.paymentId}
Method: ${d.method}
Date: ${formatDate(d.paidAt)}

Thank you,
— ${d.resortName}`;
  const html = `<!doctype html><html><body style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1d1d1f;">
  <h1 style="font-size: 22px;">Payment received</h1>
  <p>Hi ${d.guestName},</p>
  <p>We've received your payment of <strong>${formatINR(d.amountPaise)}</strong> for booking <strong>${d.bookingReference}</strong>.</p>
  <p style="color: #6e6e73; font-size: 14px;">Payment ID: ${d.paymentId}<br/>Method: ${d.method}<br/>Date: ${formatDate(d.paidAt)}</p>
  <p style="margin-top: 32px;">— ${d.resortName}</p>
</body></html>`;
  return { subject, html, text };
}

export interface CancellationData {
  guestName: string;
  bookingReference: string;
  cancelledAt: string;
  refundPaise: number;
  resortName: string;
}

export function cancellationTemplate(d: CancellationData): { subject: string; html: string; text: string } {
  const subject = `Booking cancelled — ${d.bookingReference}`;
  const text = `Hi ${d.guestName},

Your booking ${d.bookingReference} has been cancelled on ${formatDate(d.cancelledAt)}.
${d.refundPaise > 0 ? `A refund of ${formatINR(d.refundPaise)} will be processed per our policy.` : ""}

— ${d.resortName}`;
  const html = `<!doctype html><html><body style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1d1d1f;">
  <h1 style="font-size: 22px;">Booking cancelled</h1>
  <p>Hi ${d.guestName},</p>
  <p>Your booking <strong>${d.bookingReference}</strong> has been cancelled on ${formatDate(d.cancelledAt)}.</p>
  ${d.refundPaise > 0 ? `<p>A refund of <strong>${formatINR(d.refundPaise)}</strong> will be processed per our policy.</p>` : ""}
  <p style="margin-top: 32px;">— ${d.resortName}</p>
</body></html>`;
  return { subject, html, text };
}

// ─── High-level helpers used by services ──────────────────────────────────

/** Observable in tests: confirmation emails dispatched this process. */
export const confirmationEmailsSent: Array<{ to: string; bookingReference: string }> = [];

/** Fire-and-forget. Caller does NOT await. */
export function sendBookingConfirmation(d: BookingConfirmationData, toEmail: string): void {
  confirmationEmailsSent.push({ to: toEmail, bookingReference: d.bookingReference });
  const t = bookingConfirmationTemplate(d);
  void sendEmail({ to: toEmail, ...t });
}

export function sendPaymentReceipt(d: PaymentReceiptData, toEmail: string): void {
  const t = paymentReceiptTemplate(d);
  void sendEmail({ to: toEmail, ...t });
}

export function sendCancellation(d: CancellationData, toEmail: string): void {
  const t = cancellationTemplate(d);
  void sendEmail({ to: toEmail, ...t });
}
