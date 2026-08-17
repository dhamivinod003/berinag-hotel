// Background sweeper service for expired PENDING_PAYMENT reservations.

import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";
import { eventBus } from "../realtime/events.js";

/**
 * Sweeps the database for any PENDING_PAYMENT reservations where the hold window has passed.
 * Transitions their status to EXPIRED, releases their inventory, and logs the expiration.
 * @returns Count of expired reservations during this sweep.
 */
export async function expirePendingPaymentReservations(): Promise<number> {
  const now = new Date();

  // Find all PENDING_PAYMENT reservations where holdExpiresAt is past
  // (or created more than 15 minutes ago if holdExpiresAt is null).
  const fifteenMinsAgo = new Date(now.getTime() - 15 * 60 * 1000);

  const expiredReservations = await prisma.reservation.findMany({
    where: {
      status: "PENDING_PAYMENT",
      OR: [
        { holdExpiresAt: { lte: now } },
        { holdExpiresAt: null, createdAt: { lte: fifteenMinsAgo } },
      ],
    },
    select: {
      id: true,
      resortId: true,
      bookingReference: true,
    },
    take: 100,
  });

  if (expiredReservations.length === 0) {
    return 0;
  }

  const ids = expiredReservations.map((r) => r.id);

  await prisma.reservation.updateMany({
    where: { id: { in: ids }, status: "PENDING_PAYMENT" },
    data: {
      status: "EXPIRED",
      cancellationReason: "Payment window expired",
    },
  });

  for (const res of expiredReservations) {
    logger.info(
      { reservationId: res.id, bookingReference: res.bookingReference, resortId: res.resortId },
      "⏰ PENDING_PAYMENT reservation expired and inventory released"
    );

    eventBus.emitEvent(res.resortId, {
      type: "BOOKING_UPDATED",
      data: { reservation: { id: res.id, status: "EXPIRED" } },
    });
  }

  return expiredReservations.length;
}
