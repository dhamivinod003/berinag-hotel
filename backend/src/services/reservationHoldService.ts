// Soft-hold service. Holds reserve inventory during checkout.
// Separate ReservationHold table; the availability engine counts ACTIVE holds.

import crypto from "node:crypto";
import { prisma } from "../config/database.js";
import { env } from "../config/env.js";
import { addMinutes } from "../utils/dates.js";
import { InventoryUnavailableError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { holdExpired } from "../utils/metrics.js";

const HOLD_STATUSES = ["ACTIVE"];

export interface CreateHoldOpts {
  resortId: string;
  roomTypeId: string;
  quantity: number;
  checkIn: Date;
  checkOut: Date;
  sessionId: string;
}

export async function createHold(opts: CreateHoldOpts) {
  // Reuse an active hold for the same session + room type + dates.
  const existing = await prisma.reservationHold.findFirst({
    where: {
      resortId: opts.resortId,
      roomTypeId: opts.roomTypeId,
      sessionId: opts.sessionId,
      quantity: opts.quantity,
      checkIn: opts.checkIn,
      checkOut: opts.checkOut,
      status: "ACTIVE",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    return refreshHold(existing.id);
  }

  // Verify availability for the requested quantity, then create the hold —
  // all inside a serializable transaction so concurrent calls can't both pass
  // the inventory check.
  const result = await prisma.$transaction(
    async (tx) => {
      const roomType = await tx.roomType.findFirst({
        where: { id: opts.roomTypeId, resortId: opts.resortId, status: "ACTIVE" },
      });
      if (!roomType) {
        throw new InventoryUnavailableError({ reason: "room_type_not_found" });
      }

      const ci = toUtc(opts.checkIn);
      const co = toUtc(opts.checkOut);

      const blocking = ["HELD", "PENDING", "PENDING_PAYMENT", "CONFIRMED", "CHECKED_IN"];

      const reservedAgg = await tx.reservation.aggregate({
        where: {
          resortId: opts.resortId,
          roomTypeId: opts.roomTypeId,
          status: { in: blocking },
          checkIn: { lt: co },
          checkOut: { gt: ci },
        },
        _sum: { roomCount: true },
      });
      const reserved = reservedAgg._sum.roomCount ?? 0;

      const holdsAgg = await tx.reservationHold.aggregate({
        where: {
          resortId: opts.resortId,
          roomTypeId: opts.roomTypeId,
          status: "ACTIVE",
          expiresAt: { gt: new Date() },
          checkIn: { lt: co },
          checkOut: { gt: ci },
        },
        _sum: { quantity: true },
      });
      const held = holdsAgg._sum.quantity ?? 0;

      const available = Math.max(0, roomType.totalUnits - reserved - held);
      if (available < opts.quantity) {
        throw new InventoryUnavailableError({ available, requested: opts.quantity });
      }

      const nights = Math.max(
        1,
        Math.round((co.getTime() - ci.getTime()) / 86_400_000)
      );
      const totalAmount = roomType.basePrice * opts.quantity * nights;
      const expiresAt = addMinutes(new Date(), env.HOLD_DURATION_MINUTES);

      return tx.reservationHold.create({
        data: {
          resortId: opts.resortId,
          roomTypeId: opts.roomTypeId,
          quantity: opts.quantity,
          checkIn: ci,
          checkOut: co,
          sessionId: opts.sessionId,
          status: "ACTIVE",
          expiresAt,
          nightlyRate: roomType.basePrice,
          totalAmount,
        },
      });
    },
    { isolationLevel: "Serializable", timeout: 15_000, maxWait: 10_000 }
  );

  return result;
}

export async function refreshHold(holdId: string) {
  const hold = await prisma.reservationHold.findUnique({ where: { id: holdId } });
  if (!hold || hold.status !== "ACTIVE") {
    throw new InventoryUnavailableError({ reason: "hold_not_active" });
  }
  const expiresAt = addMinutes(new Date(), env.HOLD_DURATION_MINUTES);
  const updated = await prisma.reservationHold.update({
    where: { id: holdId },
    data: { expiresAt },
  });
  return updated;
}

export async function releaseHold(holdId: string, reason: string) {
  await prisma.reservationHold.update({
    where: { id: holdId },
    data: { status: "RELEASED", releasedAt: new Date(), releaseReason: reason },
  });
}

export async function getHold(holdId: string) {
  return prisma.reservationHold.findUnique({ where: { id: holdId } });
}

/**
 * Sweep: expire any ACTIVE holds whose expiresAt is in the past.
 * Called periodically by the worker (see jobs/holdExpiry.ts).
 */
export async function expireDueHolds(): Promise<number> {
  const now = new Date();
  const due = await prisma.reservationHold.findMany({
    where: { status: "ACTIVE", expiresAt: { lte: now } },
    take: 100,
  });
  if (due.length === 0) return 0;

  await prisma.reservationHold.updateMany({
    where: { id: { in: due.map((h) => h.id) } },
    data: { status: "EXPIRED" },
  });
  holdExpired.inc(due.length);
  logger.info({ count: due.length }, "Expired holds");
  return due.length;
}

export async function markHoldConverted(holdId: string, reservationId: string) {
  await prisma.reservationHold.update({
    where: { id: holdId },
    data: {
      status: "CONVERTED",
      convertedReservationId: reservationId,
    },
  });
}

async function countAvailable(
  resortId: string,
  roomTypeId: string,
  checkIn: Date,
  checkOut: Date
): Promise<number> {
  const ci = toUtc(checkIn);
  const co = toUtc(checkOut);
  const roomType = await prisma.roomType.findFirst({
    where: { id: roomTypeId, resortId: resortId, status: "ACTIVE", deletedAt: null },
  });
  if (!roomType) return 0;
  const blocking = ["HELD", "PENDING", "CONFIRMED", "CHECKED_IN"];
  const reservedAgg = await prisma.reservation.aggregate({
    where: {
      resortId,
      roomTypeId,
      status: { in: blocking },
      checkIn: { lt: co },
      checkOut: { gt: ci },
    },
    _sum: { roomCount: true },
  });
  const reserved = reservedAgg._sum.roomCount ?? 0;
  const holdsAgg = await prisma.reservationHold.aggregate({
    where: {
      resortId,
      roomTypeId,
      status: "ACTIVE",
      expiresAt: { gt: new Date() },
      checkIn: { lt: co },
      checkOut: { gt: ci },
    },
    _sum: { quantity: true },
  });
  const held = holdsAgg._sum.quantity ?? 0;
  return Math.max(0, roomType.totalUnits - reserved - held);
}

function toUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function generateSessionId(): string {
  return crypto.randomBytes(24).toString("base64url");
}
