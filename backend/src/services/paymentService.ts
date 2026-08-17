// Razorpay payment integration.
//
// Flow:
//   1. Guest completes booking from hold → reservation in CONFIRMED state, amountDue=total
//   2. Frontend POSTs /api/public/payments/orders with { reservationId }
//   3. Backend creates a Razorpay order (or returns an existing CREATED one for the
//      reservation — idempotent), stores a Payment row (status: CREATED), returns
//      { orderId, amount, currency, keyId } for the frontend checkout
//   4. Frontend opens Razorpay checkout with the order; user pays
//   5. On success, Razorpay returns { razorpay_order_id, razorpay_payment_id, razorpay_signature }
//   6. Frontend POSTs /api/public/payments/verify with those three values + reservationId
//   7. Backend verifies HMAC-SHA256(order_id|payment_id, key_secret), marks the Payment as
//      CAPTURED, updates Reservation.amountPaid / amountDue
//   8. Webhook at /api/webhooks/razorpay also handles payment.captured as a fallback
//      (covers network drops between client and server)
//
// Security:
//   - All amounts are server-derived from the reservation. The client never sends amount.
//   - HMAC verification uses crypto.timingSafeEqual.
//   - Replay protection: signature includes the payment ID, which is unique per Razorpay call.

import crypto from "node:crypto";
import Razorpay from "razorpay";
import { prisma } from "../config/database.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { sendPaymentReceipt } from "./emailService.js";
import { sendGuestConfirmationIfConfirmed } from "./reservationService.js";
import {
  BadRequestError,
  NotFoundError,
  PaymentError,
  PolicyViolationError,
} from "../utils/errors.js";

let _razorpay: Razorpay | null = null;

function getRazorpay(): Razorpay {
  if (_razorpay) return _razorpay;
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new PaymentError(
      "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env"
    );
  }
  _razorpay = new Razorpay({
    key_id: env.RAZORPAY_KEY_ID,
    key_secret: env.RAZORPAY_KEY_SECRET,
  });
  return _razorpay;
}

export function isRazorpayConfigured(): boolean {
  return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}

export function getPublicKeyId(): string {
  return env.RAZORPAY_KEY_ID || "";
}

// ─── Create order ───────────────────────────────────────────────────

export interface CreateOrderResult {
  // The razorpay order id (rzp_...)
  orderId: string;
  // Amount in paise (server-derived from reservation)
  amount: number;
  currency: string;
  // Public key id the frontend uses to open the checkout
  keyId: string;
  // The reservation we attached this order to
  reservationId: string;
  // The internal Payment row id (so verify can find it directly)
  paymentId: string;
  // Guest name + email prefill
  prefill: { name: string; email?: string; contact: string };
}

export async function createOrderForReservation(opts: {
  reservationId: string;
  phone: string; // for guest verification — must match the reservation
}): Promise<CreateOrderResult> {
  const r = await prisma.reservation.findUnique({
    where: { id: opts.reservationId },
    include: { guest: true },
  });
  if (!r) throw new NotFoundError("Reservation not found");
  // Phone check: same model as the lookup endpoint
  if (
    r.guest.phone.replace(/\D/g, "").slice(-10) !==
    opts.phone.replace(/\D/g, "").slice(-10)
  ) {
    throw new NotFoundError("Reservation not found");
  }
  if (r.status === "CANCELLED" || r.status === "CHECKED_OUT" || r.status === "NO_SHOW") {
    throw new PolicyViolationError(`Cannot pay a ${r.status} reservation.`);
  }
  if (r.amountDue <= 0) {
    throw new BadRequestError("Reservation is already fully paid.");
  }

  // Idempotency: if a CREATED payment row already exists for this reservation,
  // reuse it instead of creating a new Razorpay order.
  const existing = await prisma.payment.findFirst({
    where: {
      reservationId: r.id,
      provider: "razorpay",
      status: "CREATED",
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing && existing.providerOrderId) {
    return {
      orderId: existing.providerOrderId,
      amount: existing.amount,
      currency: existing.currency,
      keyId: getPublicKeyId(),
      reservationId: r.id,
      paymentId: existing.id,
      prefill: {
        name: r.guest.fullName,
        email: r.guest.email ?? undefined,
        contact: r.guest.phone,
      },
    };
  }

  // Create a fresh Razorpay order for the full amountDue.
  const rzp = getRazorpay();
  const order = await rzp.orders.create({
    amount: r.amountDue, // paise
    currency: r.currency || "INR",
    receipt: r.bookingReference.slice(0, 40), // Razorpay's max length is 40
    notes: {
      reservationId: r.id,
      bookingReference: r.bookingReference,
      guestPhone: r.guest.phone,
    },
  });

  // Persist a Payment row in CREATED state. The webhook + /verify will flip it.
  const payment = await prisma.payment.create({
    data: {
      resortId: r.resortId,
      reservationId: r.id,
      amount: r.amountDue,
      currency: r.currency || "INR",
      method: "RAZORPAY",
      status: "CREATED",
      provider: "razorpay",
      providerOrderId: order.id,
      reference: r.bookingReference,
    },
  });

  logger.info(
    { reservationId: r.id, orderId: order.id, amount: r.amountDue },
    "Razorpay order created"
  );

  return {
    orderId: order.id,
    amount: r.amountDue,
    currency: r.currency || "INR",
    keyId: getPublicKeyId(),
    reservationId: r.id,
    paymentId: payment.id,
    prefill: {
      name: r.guest.fullName,
      email: r.guest.email ?? undefined,
      contact: r.guest.phone,
    },
  };
}

// ─── Verify signature (client-side callback) ───────────────────────

export interface VerifyOpts {
  reservationId: string;
  phone: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface VerifyResult {
  paymentId: string;
  status: "CAPTURED" | "FAILED";
  amountPaid: number;
  amountDue: number;
  bookingReference: string;
}

export function verifyRazorpaySignature(opts: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): boolean {
  if (!env.RAZORPAY_KEY_SECRET) {
    throw new PaymentError("Razorpay is not configured");
  }
  const body = `${opts.razorpayOrderId}|${opts.razorpayPaymentId}`;
  const expected = crypto
    .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");
  if (expected.length !== opts.razorpaySignature.length) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(opts.razorpaySignature, "hex")
    );
  } catch {
    return false;
  }
}

export async function verifyAndCapture(opts: VerifyOpts): Promise<VerifyResult> {
  if (!verifyRazorpaySignature(opts)) {
    throw new PaymentError("Invalid payment signature");
  }

  // Atomic update of the Payment + Reservation. If the Payment is already CAPTURED
  // (e.g. webhook arrived first), we still return success — Razorpay is the source of truth.
  const payment = await prisma.payment.findFirst({
    where: {
      provider: "razorpay",
      providerOrderId: opts.razorpayOrderId,
    },
  });
  if (!payment) {
    throw new NotFoundError("Payment not found for this order");
  }

  // Optional: verify the reservation + phone match (defense in depth — the order
  // notes already include the reservationId, but this double-checks).
  const r = await prisma.reservation.findUnique({
    where: { id: payment.reservationId },
    include: { guest: true },
  });
  if (!r) throw new NotFoundError("Reservation not found");
  if (r.id !== opts.reservationId) {
    throw new BadRequestError("Payment order does not match reservation");
  }
  if (
    r.guest.phone.replace(/\D/g, "").slice(-10) !==
    opts.phone.replace(/\D/g, "").slice(-10)
  ) {
    throw new NotFoundError("Reservation not found");
  }

  const result = await prisma.$transaction(async (tx) => {
    // Idempotent: if already CAPTURED, no-op
    const current = await tx.payment.findUnique({ where: { id: payment.id } });
    if (current?.status === "CAPTURED") {
      return { paymentId: payment.id, alreadyCaptured: true };
    }

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "CAPTURED",
        providerPaymentId: opts.razorpayPaymentId,
        providerSignature: opts.razorpaySignature,
      },
    });

    // Update the reservation's running totals & state transition.
    const newAmountPaid = Math.min(r.amountPaid + payment.amount, r.totalAmount);
    const newAmountDue = Math.max(r.totalAmount - newAmountPaid, 0);
    const shouldConfirm = r.status === "PENDING_PAYMENT";
    await tx.reservation.update({
      where: { id: r.id },
      data: {
        amountPaid: newAmountPaid,
        amountDue: newAmountDue,
        ...(shouldConfirm ? { status: "CONFIRMED", confirmedAt: new Date() } : {}),
      },
    });

    return { paymentId: payment.id, alreadyCaptured: false };
  });

  if (!result.alreadyCaptured && r.status === "PENDING_PAYMENT") {
    void sendGuestConfirmationIfConfirmed(r.id);
  }

  // Read back the final state for the response.
  const finalRes = await prisma.reservation.findUnique({ where: { id: r.id } });
  logger.info(
    {
      paymentId: result.paymentId,
      reservationId: r.id,
      alreadyCaptured: result.alreadyCaptured,
      amount: payment.amount,
    },
    "Payment verified"
  );

  return {
    paymentId: payment.id,
    status: "CAPTURED",
    amountPaid: finalRes?.amountPaid ?? r.amountPaid,
    amountDue: finalRes?.amountDue ?? 0,
    bookingReference: r.bookingReference,
  };
}

// ─── Webhook handler (called from routes/webhooks.ts) ──────────────

export interface WebhookEvent {
  event: string;
  payload?: { payment?: { entity?: { id: string; order_id?: string; amount?: number } } };
  created_at?: number;
}

export async function handleRazorpayWebhook(event: WebhookEvent): Promise<void> {
  if (event.event === "payment.captured") {
    const p = event.payload?.payment?.entity;
    if (!p?.id || !p?.order_id) return;

    try {
      const payment = await prisma.payment.findFirst({
        where: { provider: "razorpay", providerOrderId: p.order_id },
        include: { reservation: { include: { guest: true } } },
      });
      if (!payment) return;

      const updated = await prisma.$transaction(async (tx) => {
        const cur = await tx.payment.findUnique({ where: { id: payment.id } });
        if (!cur || cur.status === "CAPTURED") return null;

        await tx.payment.update({
          where: { id: payment.id },
          data: { status: "CAPTURED", providerPaymentId: p.id },
        });

        const r = payment.reservation;
        const newAmountPaid = Math.min(r.amountPaid + payment.amount, r.totalAmount);
        const newAmountDue = Math.max(r.totalAmount - newAmountPaid, 0);
        const shouldConfirm = r.status === "PENDING_PAYMENT";

        await tx.reservation.update({
          where: { id: r.id },
          data: {
            amountPaid: newAmountPaid,
            amountDue: newAmountDue,
            ...(shouldConfirm ? { status: "CONFIRMED", confirmedAt: new Date() } : {}),
          },
        });
        return payment;
      });

      if (!updated) return; // already captured — no-op

      const reservation = payment.reservation;
      if (reservation.status === "PENDING_PAYMENT") {
        void sendGuestConfirmationIfConfirmed(reservation.id);
      }
      if (reservation.guest.email) {
        const resort = await prisma.resort.findUnique({
          where: { id: reservation.resortId },
          select: { name: true },
        });
        if (resort) {
          sendPaymentReceipt(
            {
              guestName: reservation.guest.fullName,
              bookingReference: reservation.bookingReference,
              amountPaise: payment.amount,
              paymentId: payment.id,
              paidAt: payment.createdAt.toISOString(),
              method: "Razorpay",
              resortName: resort.name,
            },
            reservation.guest.email
          );
        }
      }

      await prisma.notification.create({
        data: {
          resortId: reservation.resortId,
          audience: "staff",
          type: "PAYMENT_RECEIVED",
          channel: "INAPP",
          title: `Payment received: ${reservation.bookingReference}`,
          body: `₹${(payment.amount / 100).toFixed(0)} from ${reservation.guest.fullName}`,
          link: `/admin/bookings?id=${reservation.id}`,
        },
      });
    } catch (err) {
      logger.error({ err }, "Webhook: payment.captured handler failed");
    }
  } else if (event.event === "payment.failed") {
    const p = event.payload?.payment?.entity;
    if (!p?.id) return;
    await prisma.payment
      .updateMany({
        where: { provider: "razorpay", providerOrderId: p.order_id ?? undefined },
        data: { status: "FAILED" },
      })
      .then(async (r) => {
        if (r.count === 0) return;
        // Notify staff of the failure
        const payment = await prisma.payment.findFirst({
          where: { provider: "razorpay", providerOrderId: p.order_id ?? undefined },
          include: { reservation: { include: { guest: true } } },
        });
        if (!payment) return;
        await prisma.notification.create({
          data: {
            resortId: payment.resortId,
            audience: "staff",
            type: "PAYMENT_FAILED",
            channel: "INAPP",
            title: `Payment failed: ${payment.reservation.bookingReference}`,
            body: `${payment.reservation.guest.fullName} — ₹${(payment.amount / 100).toFixed(0)} • ${(p as any).error_description ?? "Unknown reason"}`,
            link: `/admin/bookings?id=${payment.reservationId}`,
          },
        });
      })
      .catch((err) => logger.error({ err }, "Webhook: payment.failed handler failed"));
  } else if (event.event === "refund.processed") {
    const r = (event.payload as { refund?: { entity?: { payment_id?: string } } })?.refund
      ?.entity;
    if (!r?.payment_id) return;
    await prisma.payment
      .updateMany({
        where: { provider: "razorpay", providerPaymentId: r.payment_id },
        data: { status: "REFUNDED" },
      })
      .catch((err) => logger.error({ err }, "Webhook: refund.processed handler failed"));
  }
}

// ─── Refund (admin) ────────────────────────────────────────────────

export async function refundPayment(opts: {
  paymentId: string;
  amountPaise?: number; // optional partial; defaults to full
  reason?: string;
  staffId: string;
  resortId: string;
}): Promise<{ refundId: string; amount: number; status: string }> {
  const payment = await prisma.payment.findFirst({
    where: { id: opts.paymentId, resortId: opts.resortId },
  });
  if (!payment) throw new NotFoundError("Payment not found");
  if (payment.status !== "CAPTURED") {
    throw new PolicyViolationError(`Cannot refund a ${payment.status} payment`);
  }
  if (!payment.providerPaymentId) {
    throw new BadRequestError("Payment has no provider ID; cannot refund via Razorpay");
  }
  const refundAmount = opts.amountPaise ?? payment.amount;
  if (refundAmount <= 0 || refundAmount > payment.amount) {
    throw new BadRequestError("Refund amount must be > 0 and ≤ original payment amount");
  }

  const rzp = getRazorpay();
  const refund = await rzp.payments.refund(payment.providerPaymentId, {
    amount: refundAmount,
    speed: "optimum",
    notes: { reason: opts.reason ?? "admin_refund", staffId: opts.staffId },
  });

  // Optimistically mark; webhook will reconcile to REFUNDED.
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: refundAmount === payment.amount ? "REFUNDED" : "PARTIALLY_REFUNDED",
      notes: opts.reason ?? payment.notes,
    },
  });

  // Reduce amountPaid on the reservation.
  const r = await prisma.reservation.findUnique({ where: { id: payment.reservationId } });
  if (r) {
    const newAmountPaid = Math.max(r.amountPaid - refundAmount, 0);
    const newAmountDue = Math.min(r.totalAmount - newAmountPaid, r.totalAmount);
    await prisma.reservation.update({
      where: { id: r.id },
      data: { amountPaid: newAmountPaid, amountDue: newAmountDue },
    });
  }

  logger.info(
    { paymentId: payment.id, refundId: refund.id, amount: refundAmount },
    "Refund issued"
  );

  return { refundId: refund.id, amount: refundAmount, status: "PROCESSED" };
}
