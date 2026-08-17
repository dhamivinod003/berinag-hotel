// Webhooks (Razorpay, WhatsApp). HMAC-verified; never trusted from the browser.

import { Router, raw } from "express";
import crypto from "node:crypto";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { handleRazorpayWebhook } from "../services/paymentService.js";

export const webhookRouter = Router();

// Maximum age of an incoming webhook event (seconds). Razorpay's docs recommend
// rejecting events older than 5 minutes; we also reject events with a future
// `created_at` to defend against clock skew exploitation.
const REPLAY_WINDOW_SECONDS = 5 * 60;

function verifyRazorpaySignature(rawBody: Buffer, signature: string): boolean {
  if (!env.RAZORPAY_WEBHOOK_SECRET) return false;
  const expected = crypto
    .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

function isWithinReplayWindow(createdAtSec: number | undefined): boolean {
  if (typeof createdAtSec !== "number" || !Number.isFinite(createdAtSec)) {
    // If the event has no timestamp, we can't defend against replay — reject.
    return false;
  }
  const nowSec = Math.floor(Date.now() / 1000);
  const age = nowSec - createdAtSec;
  // Accept events that are at most REPLAY_WINDOW_SECONDS old, and not from
  // the future (allow 60s of clock skew).
  return age <= REPLAY_WINDOW_SECONDS && age >= -60;
}

webhookRouter.post(
  "/razorpay",
  raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.header("x-razorpay-signature") ?? "";
    if (!verifyRazorpaySignature(req.body as Buffer, signature)) {
      res.status(401).json({ error: { code: "INVALID_SIGNATURE" } });
      return;
    }
    const event = JSON.parse((req.body as Buffer).toString("utf8"));

    // Replay protection: reject stale or future-dated events.
    if (!isWithinReplayWindow(event.created_at)) {
      logger.warn(
        { event: event.event, id: event.id, created_at: event.created_at },
        "Razorpay webhook rejected: outside replay window"
      );
      res.status(401).json({ error: { code: "REPLAY_WINDOW_EXCEEDED" } });
      return;
    }

    logger.info({ event: event.event, id: event.id }, "Razorpay webhook");

    // All event handling lives in paymentService.handleRazorpayWebhook so the
    // same logic can be unit-tested.
    await handleRazorpayWebhook(event).catch((err) =>
      logger.error({ err, event: event.event }, "Razorpay webhook handler error")
    );

    res.json({ received: true });
  }
);

webhookRouter.post("/whatsapp", async (req, res) => {
  // Stub: in real life, verify X-Hub-Signature-256 and parse the Meta payload
  // to create Enquiry rows. For v1 we just acknowledge.
  logger.info({ body: req.body }, "WhatsApp webhook (stub)");
  res.json({ received: true });
});
