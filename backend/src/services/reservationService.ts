// Reservation lifecycle. State machine (see backend-spec.md §7.2).
//
// States: PENDING → HELD → CONFIRMED → CHECKED_IN → CHECKED_OUT
//         PENDING → CANCELLED
//         HELD → EXPIRED | CONFIRMED | CANCELLED
//         CONFIRMED → CHECKED_IN | CANCELLED | NO_SHOW
//
// All mutations run inside transactions and write ReservationEvent rows.

import crypto from "node:crypto";
import { prisma } from "../config/database.js";
import {
  BadRequestError,
  ConflictError,
  InventoryUnavailableError,
  NotFoundError,
  PolicyViolationError,
} from "../utils/errors.js";
import { addDays, nightsBetween, toDateOnly } from "../utils/dates.js";
import { markHoldConverted, releaseHold, getHold } from "./reservationHoldService.js";
import { isPhysicalRoomAvailable } from "./availabilityService.js";
import { audit } from "../middleware/audit.js";
import { bookingConflict, bookingSuccess } from "../utils/metrics.js";
import { eventBus } from "../realtime/events.js";
import { sendBookingConfirmation, sendCancellation } from "./emailService.js";
import { notify } from "./notificationProviders.js";
import { logger } from "../utils/logger.js";

const ACTIVE_STATUSES = ["PENDING", "HELD", "PENDING_PAYMENT", "CONFIRMED", "CHECKED_IN"];

async function getReservationInResort(reservationId: string, resortId: string) {
  const r = await prisma.reservation.findFirst({ where: { id: reservationId, resortId } });
  if (!r) throw new NotFoundError("Reservation not found");
  return r;
}

// ─── Reference ─────────────────────────────────────────────────────

const BOOKING_REF_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export async function getTaxRate(resortId: string): Promise<number> {
  const row = await prisma.websiteSetting.findUnique({
    where: { resortId_key: { resortId, key: "tax.gst_pct" } },
  });
  if (!row) return 0.12;
  try {
    const n = Number(JSON.parse(row.value));
    if (!Number.isFinite(n) || n < 0 || n > 100) return 0.12;
    return n / 100;
  } catch {
    return 0.12;
  }
}

export function generateBookingReference(): string {
  let out = "BK";
  for (let i = 0; i < 8; i++) {
    out += BOOKING_REF_ALPHABET[crypto.randomInt(BOOKING_REF_ALPHABET.length)];
  }
  return out;
}

// ─── Create (from hold) ────────────────────────────────────────────

export interface CreateReservationOpts {
  resortId: string;
  holdId: string;
  guest: {
    fullName: string;
    phone: string;
    countryCode?: string;
    email?: string;
    address?: string;
    idType?: string;
    idNumber?: string;
  };
  specialRequests?: string;
  arrivalTime?: string;
  adults?: number;
  children?: number;
  source: string; // WEBSITE | WALK_IN | PHONE | WHATSAPP | ADMIN | OTA
  createdById?: string;
  ip?: string;
  userAgent?: string;
}

export async function createFromHold(opts: CreateReservationOpts) {
  const hold = await getHold(opts.holdId);
  if (!hold) throw new NotFoundError("Hold not found");
  if (hold.resortId !== opts.resortId) throw new NotFoundError("Hold not found");
  if (hold.status !== "ACTIVE" || hold.expiresAt.getTime() <= Date.now()) {
    throw new ConflictError("Hold has expired. Please search again.");
  }

  // Find or create guest.
  const guest = await prisma.guest.upsert({
    where: {
      resortId_phone_countryCode: {
        resortId: opts.resortId,
        phone: opts.guest.phone,
        countryCode: opts.guest.countryCode ?? "+91",
      },
    },
    update: {
      fullName: opts.guest.fullName,
      email: opts.guest.email ?? undefined,
      address: opts.guest.address ?? undefined,
      idType: opts.guest.idType ?? undefined,
      idNumber: opts.guest.idNumber ?? undefined,
    },
    create: {
      resortId: opts.resortId,
      fullName: opts.guest.fullName,
      phone: opts.guest.phone,
      countryCode: opts.guest.countryCode ?? "+91",
      email: opts.guest.email,
      address: opts.guest.address,
      idType: opts.guest.idType,
      idNumber: opts.guest.idNumber,
    },
  });

  const nights = nightsBetween(hold.checkIn, hold.checkOut);
  const subtotal = hold.nightlyRate * hold.quantity * nights;
  const taxRate = await getTaxRate(opts.resortId);
  const taxAmount = Math.round(subtotal * taxRate);
  const totalAmount = subtotal + taxAmount;

  let result;
  let lastCreateErr: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      result = await prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.create({
      data: {
        resortId: opts.resortId,
        bookingReference: generateBookingReference(),
        guestId: guest.id,
        roomTypeId: hold.roomTypeId,
        checkIn: hold.checkIn,
        checkOut: hold.checkOut,
        nights,
        adults: opts.adults && opts.adults > 0 ? opts.adults : 1,
        children: opts.children && opts.children > 0 ? opts.children : 0,
        roomCount: hold.quantity,
        status: opts.createdById ? "CONFIRMED" : "PENDING_PAYMENT",
        source: opts.source,
        nightlyRate: hold.nightlyRate,
        subtotal,
        taxAmount,
        totalAmount,
        amountPaid: 0,
        amountDue: totalAmount,
        specialRequests: opts.specialRequests,
        arrivalTime: opts.arrivalTime,
        holdExpiresAt: opts.createdById ? null : hold.expiresAt ?? new Date(Date.now() + 15 * 60 * 1000),
        createdById: opts.createdById,
        confirmedAt: opts.createdById ? new Date() : null,
      },
    });
    await tx.reservationHold.update({
      where: { id: hold.id },
      data: { status: "CONVERTED", convertedReservationId: reservation.id },
    });
    await tx.reservationEvent.create({
      data: {
        resortId: opts.resortId,
        reservationId: reservation.id,
        type: "created",
        actorType: opts.createdById ? "staff" : "guest",
        actorId: opts.createdById ?? null,
        payload: JSON.stringify({ from: "HELD", to: "CONFIRMED" }),
      },
    });
    return reservation;
  }, { timeout: 15_000, maxWait: 10_000 });
      lastCreateErr = undefined;
      break;
    } catch (err) {
      lastCreateErr = err;
      const code = (err as { code?: string }).code;
      if (code !== "P2002") throw err;
    }
  }
  if (!result) throw lastCreateErr;

  bookingSuccess.inc();
  eventBus.emitEvent(opts.resortId, { type: "BOOKING_CREATED", data: { reservation: result } });
  await audit({
    resortId: opts.resortId,
    actorType: opts.createdById ? "staff" : "guest",
    actorId: opts.createdById ?? null,
    action: "BOOKING_CREATE",
    entity: "reservation",
    entityId: result.id,
    after: { bookingReference: result.bookingReference, totalAmount, source: opts.source },
    ip: opts.ip,
    userAgent: opts.userAgent,
  });

  // Staff in-app notice only. Guest "confirmed" email/WhatsApp wait until CONFIRMED.
  void sendStaffBookingCreatedNotice(result.id, opts.resortId, guest.fullName);
  void sendGuestConfirmationIfConfirmed(result.id);

  return result;
}

async function sendStaffBookingCreatedNotice(
  reservationId: string,
  resortId: string,
  guestName: string
): Promise<void> {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { roomType: { select: { name: true } } },
    });
    if (!reservation) return;
    await prisma.notification.create({
      data: {
        resortId,
        audience: "staff",
        type: "BOOKING_CREATED",
        channel: "INAPP",
        title: `New booking: ${reservation.bookingReference}`,
        body: `${guestName} — ${reservation.roomType.name} • ${reservation.nights} night(s) • ₹${(reservation.totalAmount / 100).toFixed(0)}`,
        link: `/admin/bookings?id=${reservationId}`,
      },
    });
  } catch (err) {
    logger.error({ err, reservationId }, "Failed to send staff booking notice");
  }
}

/**
 * Send guest confirmation email + WhatsApp only when the reservation is CONFIRMED.
 * Returns true if a confirmation was dispatched. Never throws.
 */
export async function sendGuestConfirmationIfConfirmed(reservationId: string): Promise<boolean> {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        roomType: { select: { name: true } },
        guest: { select: { email: true, fullName: true, phone: true, countryCode: true } },
      },
    });
    if (!reservation || reservation.status !== "CONFIRMED") return false;

    const resort = await prisma.resort.findUnique({
      where: { id: reservation.resortId },
      select: { name: true, phone: true, email: true },
    });
    if (!resort) return false;

    const guestName = reservation.guest.fullName;
    if (reservation.guest.email) {
      sendBookingConfirmation(
        {
          guestName,
          bookingReference: reservation.bookingReference,
          roomTypeName: reservation.roomType.name,
          checkIn: reservation.checkIn.toISOString(),
          checkOut: reservation.checkOut.toISOString(),
          nights: reservation.nights,
          roomsCount: reservation.roomCount,
          guests: reservation.adults + reservation.children,
          totalPaise: reservation.totalAmount,
          resortName: resort.name,
          resortPhone: resort.phone ?? "",
          resortEmail: resort.email ?? "",
        },
        reservation.guest.email
      );
    }
    if (reservation.guest.phone) {
      const phone = `${reservation.guest.countryCode || "+91"}${reservation.guest.phone}`.replace(/[^0-9+]/g, "");
      void notify("WHATSAPP", {
        to: phone,
        body: `Hi ${guestName}, your booking ${reservation.bookingReference} at ${reservation.roomType.name} is confirmed for ${reservation.nights} night(s). Total: ₹${(reservation.totalAmount / 100).toFixed(0)}. — Sun & Water Resort`,
      });
    }
    return true;
  } catch (err) {
    logger.error({ err, reservationId }, "Failed to send guest confirmation");
    return false;
  }
}

// ─── Cancel ────────────────────────────────────────────────────────

export interface CancelOpts {
  reservationId: string;
  resortId: string;
  reason: string;
  actorType: "staff" | "guest" | "system";
  actorId?: string;
  ip?: string;
  userAgent?: string;
}

export async function cancelReservation(opts: CancelOpts) {
  const r = await getReservationInResort(opts.reservationId, opts.resortId);
  if (r.status === "CANCELLED") return r;
  if (!["PENDING", "HELD", "PENDING_PAYMENT", "CONFIRMED", "CHECKED_IN"].includes(r.status)) {
    throw new PolicyViolationError(
      `Cannot cancel a reservation in status ${r.status}.`
    );
  }

  // Cancellation policy (free until 7 days before check-in).
  const now = new Date();
  const hoursUntilCheckIn = (r.checkIn.getTime() - now.getTime()) / 3_600_000;
  let refundPct = 0;
  if (hoursUntilCheckIn >= 24 * 7) refundPct = 100;
  else if (hoursUntilCheckIn >= 24) refundPct = 50;
  else refundPct = 0;

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.reservation.update({
      where: { id: r.id },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
        cancelledById: opts.actorType === "staff" ? (opts.actorId ?? null) : r.cancelledById,
        cancellationReason: opts.reason,
      },
    });
    await tx.reservationEvent.create({
      data: {
        resortId: r.resortId,
        reservationId: r.id,
        type: "cancelled",
        actorType: opts.actorType,
        actorId: opts.actorId ?? null,
        payload: JSON.stringify({ from: r.status, to: "CANCELLED", refundPct, reason: opts.reason }),
      },
    });
    return updated;
  });

  eventBus.emitEvent(r.resortId, { type: "BOOKING_CANCELLED", data: { id: r.id } });

  await audit({
    resortId: r.resortId,
    actorType: opts.actorType,
    actorId: opts.actorId ?? null,
    action: "BOOKING_CANCEL",
    entity: "reservation",
    entityId: r.id,
    before: { status: r.status },
    after: { status: "CANCELLED", refundPct, reason: opts.reason },
    ip: opts.ip,
    userAgent: opts.userAgent,
  });

  // Best-effort notifications (never blocks, never throws)
  void (async () => {
    try {
      const guest = await prisma.guest.findUnique({ where: { id: r.guestId }, select: { email: true, fullName: true, phone: true, countryCode: true } });
      const resort = await prisma.resort.findUnique({ where: { id: r.resortId }, select: { name: true } });
      if (!resort) return;
      const refundPaise = Math.round((r.amountPaid ?? 0) * (refundPct / 100));

      // In-app staff notification
      await prisma.notification.create({
        data: {
          resortId: r.resortId,
          audience: "staff",
          type: "BOOKING_CANCELLED",
          channel: "INAPP",
          title: `Booking cancelled: ${r.bookingReference}`,
          body: `${guest?.fullName ?? "Guest"} • Refund ${refundPct}%`,
          link: `/admin/bookings?id=${r.id}`,
        },
      });

      if (guest?.email) {
        sendCancellation(
          {
            guestName: guest.fullName,
            bookingReference: r.bookingReference,
            cancelledAt: now.toISOString(),
            refundPaise,
            resortName: resort.name,
          },
          guest.email
        );
      }
    } catch (err) {
      logger.error({ err, reservationId: r.id }, "Failed to send cancellation notifications");
    }
  })();

  return { reservation: result, refundPct };
}

// ─── Confirm (admin) ───────────────────────────────────────────────

export async function confirmReservation(opts: {
  reservationId: string;
  resortId: string;
  actorId: string;
  ip?: string;
  userAgent?: string;
}) {
  const r = await getReservationInResort(opts.reservationId, opts.resortId);
  if (r.status !== "PENDING" && r.status !== "HELD") {
    throw new PolicyViolationError(`Cannot confirm from status ${r.status}.`);
  }
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.reservation.update({
      where: { id: r.id },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
    });
    await tx.reservationEvent.create({
      data: {
        resortId: r.resortId,
        reservationId: r.id,
        type: "confirmed",
        actorType: "staff",
        actorId: opts.actorId,
        payload: JSON.stringify({ from: r.status, to: "CONFIRMED" }),
      },
    });
    return u;
  });
  await audit({
    resortId: r.resortId,
    actorType: "staff",
    actorId: opts.actorId,
    action: "BOOKING_CONFIRM",
    entity: "reservation",
    entityId: r.id,
    before: { status: r.status },
    after: { status: "CONFIRMED" },
  });
  eventBus.emitEvent(r.resortId, { type: "BOOKING_UPDATED", data: { reservation: updated } });
  void sendGuestConfirmationIfConfirmed(updated.id);
  return updated;
}

// ─── Assign / move room ────────────────────────────────────────────

export async function assignRoom(opts: {
  reservationId: string;
  resortId: string;
  roomId: string;
  actorId: string;
  ip?: string;
  userAgent?: string;
}) {
  const r = await getReservationInResort(opts.reservationId, opts.resortId);
  if (!["CONFIRMED", "CHECKED_IN"].includes(r.status)) {
    throw new PolicyViolationError(`Cannot assign room from status ${r.status}.`);
  }
  const ok = await isPhysicalRoomAvailable({
    resortId: r.resortId,
    roomId: opts.roomId,
    checkIn: r.checkIn,
    checkOut: r.checkOut,
    excludeReservationId: r.id,
  });
  if (!ok) {
    bookingConflict.inc();
    throw new ConflictError("ROOM_UNAVAILABLE");
  }
  const assignment = await prisma.roomAssignment.create({
    data: {
      resortId: r.resortId,
      reservationId: r.id,
      roomId: opts.roomId,
      assignedById: opts.actorId,
    },
  });
  await prisma.reservationEvent.create({
    data: {
      resortId: r.resortId,
      reservationId: r.id,
      type: "room_assigned",
      actorType: "staff",
      actorId: opts.actorId,
      payload: JSON.stringify({ roomId: opts.roomId }),
    },
  });
  await audit({
    resortId: r.resortId,
    actorType: "staff",
    actorId: opts.actorId,
    action: "BOOKING_ASSIGN_ROOM",
    entity: "reservation",
    entityId: r.id,
    after: { roomId: opts.roomId, assignmentId: assignment.id },
  });
  eventBus.emitEvent(r.resortId, { type: "ROOM_ASSIGNED", data: { reservationId: r.id, roomId: opts.roomId } });
  return assignment;
}

export async function moveRoom(opts: {
  reservationId: string;
  resortId: string;
  toRoomId: string;
  reason: string;
  actorId: string;
  notes?: string;
  ip?: string;
  userAgent?: string;
}) {
  const r = await prisma.reservation.findFirst({
    where: { id: opts.reservationId, resortId: opts.resortId },
    include: { assignments: { where: { releasedAt: null } } },
  });
  if (!r) throw new NotFoundError("Reservation not found");
  const from = r.assignments[0];
  if (!from) throw new BadRequestError("No active room assignment to move from.");
  if (from.roomId === opts.toRoomId) {
    return { noOp: true };
  }
  const ok = await isPhysicalRoomAvailable({
    resortId: r.resortId,
    roomId: opts.toRoomId,
    checkIn: r.checkIn,
    checkOut: r.checkOut,
    excludeReservationId: r.id,
  });
  if (!ok) {
    bookingConflict.inc();
    throw new ConflictError("ROOM_UNAVAILABLE");
  }

  const movement = await prisma.$transaction(async (tx) => {
    await tx.roomAssignment.update({
      where: { id: from.id },
      data: { releasedAt: new Date(), releaseReason: opts.reason },
    });
    const newAssign = await tx.roomAssignment.create({
      data: {
        resortId: r.resortId,
        reservationId: r.id,
        roomId: opts.toRoomId,
        assignedById: opts.actorId,
      },
    });
    const m = await tx.roomMovement.create({
      data: {
        resortId: r.resortId,
        reservationId: r.id,
        fromRoomId: from.roomId,
        toRoomId: opts.toRoomId,
        reason: opts.reason,
        performedById: opts.actorId,
        notes: opts.notes,
      },
    });
    await tx.reservationEvent.create({
      data: {
        resortId: r.resortId,
        reservationId: r.id,
        type: "moved",
        actorType: "staff",
        actorId: opts.actorId,
        payload: JSON.stringify({ fromRoomId: from.roomId, toRoomId: opts.toRoomId, reason: opts.reason }),
      },
    });
    return { movement: m, newAssign };
  });
  await audit({
    resortId: r.resortId,
    actorType: "staff",
    actorId: opts.actorId,
    action: "BOOKING_MOVE_ROOM",
    entity: "reservation",
    entityId: r.id,
    before: { roomId: from.roomId },
    after: { roomId: opts.toRoomId, reason: opts.reason },
  });
  eventBus.emitEvent(r.resortId, { type: "ROOM_MOVED", data: { reservationId: r.id, fromRoomId: from.roomId, toRoomId: opts.toRoomId } });
  return movement;
}

// ─── Check-in / Check-out ──────────────────────────────────────────

export async function checkIn(opts: { reservationId: string; resortId: string; actorId: string }) {
  const r = await getReservationInResort(opts.reservationId, opts.resortId);
  if (r.status !== "CONFIRMED") {
    throw new PolicyViolationError(`Cannot check-in from status ${r.status}.`);
  }
  const assignment = await prisma.roomAssignment.findFirst({
    where: { reservationId: r.id, releasedAt: null },
  });
  if (!assignment) {
    throw new PolicyViolationError("No room assigned to this reservation.");
  }
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.reservation.update({
      where: { id: r.id },
      data: { status: "CHECKED_IN", checkedInAt: new Date() },
    });
    await tx.room.update({
      where: { id: assignment.roomId },
      data: { status: "OCCUPIED" },
    });
    await tx.reservationEvent.create({
      data: {
        resortId: r.resortId,
        reservationId: r.id,
        type: "checked_in",
        actorType: "staff",
        actorId: opts.actorId,
        payload: JSON.stringify({ roomId: assignment.roomId }),
      },
    });
    return u;
  });
  await audit({
    resortId: r.resortId,
    actorType: "staff",
    actorId: opts.actorId,
    action: "BOOKING_CHECKIN",
    entity: "reservation",
    entityId: r.id,
    before: { status: "CONFIRMED" },
    after: { status: "CHECKED_IN" },
  });
  eventBus.emitEvent(r.resortId, { type: "BOOKING_CHECKED_IN", data: { id: r.id } });
  eventBus.emitEvent(r.resortId, { type: "ROOM_STATUS_CHANGED", data: { roomId: assignment.roomId, status: "OCCUPIED" } });
  return updated;
}

export async function checkOut(opts: { reservationId: string; resortId: string; actorId: string }) {
  const r = await getReservationInResort(opts.reservationId, opts.resortId);
  if (r.status !== "CHECKED_IN") {
    throw new PolicyViolationError(`Cannot check-out from status ${r.status}.`);
  }
  const assignment = await prisma.roomAssignment.findFirst({
    where: { reservationId: r.id, releasedAt: null },
  });
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.reservation.update({
      where: { id: r.id },
      data: { status: "CHECKED_OUT", checkedOutAt: new Date() },
    });
    if (assignment) {
      await tx.room.update({
        where: { id: assignment.roomId },
        data: { status: "CLEANING" },
      });
      // Auto-create housekeeping task.
      await tx.housekeepingTask.create({
        data: {
          resortId: r.resortId,
          roomId: assignment.roomId,
          type: "CHECKOUT_CLEAN",
          priority: "NORMAL",
          status: "PENDING",
          reservationId: r.id,
        },
      });
    }
    await tx.reservationEvent.create({
      data: {
        resortId: r.resortId,
        reservationId: r.id,
        type: "checked_out",
        actorType: "staff",
        actorId: opts.actorId,
        payload: JSON.stringify({ roomId: assignment?.roomId }),
      },
    });
    return u;
  });
  await audit({
    resortId: r.resortId,
    actorType: "staff",
    actorId: opts.actorId,
    action: "BOOKING_CHECKOUT",
    entity: "reservation",
    entityId: r.id,
    before: { status: "CHECKED_IN" },
    after: { status: "CHECKED_OUT" },
  });
  eventBus.emitEvent(r.resortId, { type: "BOOKING_CHECKED_OUT", data: { id: r.id } });
  if (assignment) {
    eventBus.emitEvent(r.resortId, { type: "HOUSEKEEPING_TASK_CREATED", data: { task: { roomId: assignment.roomId } } });
    eventBus.emitEvent(r.resortId, { type: "ROOM_STATUS_CHANGED", data: { roomId: assignment.roomId, status: "CLEANING" } });
  }
  return updated;
}

// ─── Extension ─────────────────────────────────────────────────────

export async function requestExtension(opts: {
  reservationId: string;
  resortId: string;
  newCheckOut: Date;
  actorType: "guest" | "staff";
  actorId?: string;
}) {
  const r = await getReservationInResort(opts.reservationId, opts.resortId);
  if (!["CONFIRMED", "CHECKED_IN"].includes(r.status)) {
    throw new PolicyViolationError("Cannot extend from current status.");
  }
  if (opts.newCheckOut.getTime() <= r.checkOut.getTime()) {
    throw new BadRequestError("New check-out must be after the current check-out.");
  }

  // Try same-room extension first.
  const assignment = await prisma.roomAssignment.findFirst({
    where: { reservationId: r.id, releasedAt: null },
  });
  let outcome: "EXTENDED_SAME_ROOM" | "EXTENSION_REQUIRES_ROOM_CHANGE" | "EXTENSION_UNAVAILABLE" =
    "EXTENSION_UNAVAILABLE";
  let suggestedRoomId: string | undefined;

  if (assignment) {
    const ok = await isPhysicalRoomAvailable({
      resortId: r.resortId,
      roomId: assignment.roomId,
      checkIn: r.checkOut, // from current check-out
      checkOut: opts.newCheckOut,
      excludeReservationId: r.id,
    });
    if (ok) {
      outcome = "EXTENDED_SAME_ROOM";
    } else {
      // Look for an alternative in the same type.
      const candidates = await prisma.room.findMany({
        where: {
          resortId: r.resortId,
          roomTypeId: r.roomTypeId,
          isActive: true,
          status: { in: ["READY", "CLEANING"] },
          id: { not: assignment.roomId },
        },
        take: 5,
      });
      for (const cand of candidates) {
        const candOk = await isPhysicalRoomAvailable({
          resortId: r.resortId,
          roomId: cand.id,
          checkIn: r.checkOut,
          checkOut: opts.newCheckOut,
          excludeReservationId: r.id,
        });
        if (candOk) {
          outcome = "EXTENSION_REQUIRES_ROOM_CHANGE";
          suggestedRoomId = cand.id;
          break;
        }
      }
    }
  }

  const extensionRequest = await prisma.extensionRequest.create({
    data: {
      resortId: r.resortId,
      reservationId: r.id,
      currentCheckOut: r.checkOut,
      requestedCheckOut: opts.newCheckOut,
    },
  });

  return { outcome, suggestedRoomId, extensionRequest };
}

export async function decideExtension(opts: {
  extensionId: string;
  resortId: string;
  decision: "APPROVED" | "REJECTED";
  note?: string;
  actorId: string;
}) {
  const ext = await prisma.extensionRequest.findFirst({
    where: { id: opts.extensionId, resortId: opts.resortId },
  });
  if (!ext) throw new NotFoundError("Extension request not found");
  if (ext.decision) throw new PolicyViolationError("Extension already decided.");

  if (opts.decision === "REJECTED") {
    await prisma.extensionRequest.update({
      where: { id: ext.id },
      data: {
        decision: "REJECTED",
        decisionAt: new Date(),
        decisionById: opts.actorId,
        decisionNote: opts.note,
      },
    });
    return { decision: "REJECTED" as const };
  }

  // APPROVED — extend the reservation's checkOut.
  const r = await prisma.reservation.findUnique({ where: { id: ext.reservationId } });
  if (!r) throw new NotFoundError();
  const newNights = nightsBetween(r.checkIn, ext.requestedCheckOut);
  const newSubtotal = r.nightlyRate * r.roomCount * newNights;
  const taxRate = await getTaxRate(r.resortId);
  const newTax = Math.round(newSubtotal * taxRate);
  const newTotal = newSubtotal + newTax;
  const additionalAmount = newTotal - r.totalAmount;

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.reservation.update({
      where: { id: r.id },
      data: {
        checkOut: ext.requestedCheckOut,
        nights: newNights,
        subtotal: newSubtotal,
        taxAmount: newTax,
        totalAmount: newTotal,
        amountDue: newTotal - r.amountPaid,
      },
    });
    await tx.extensionRequest.update({
      where: { id: ext.id },
      data: {
        decision: "APPROVED",
        decisionAt: new Date(),
        decisionById: opts.actorId,
        decisionNote: opts.note,
        additionalAmount,
      },
    });
    await tx.reservationEvent.create({
      data: {
        resortId: r.resortId,
        reservationId: r.id,
        type: "extended",
        actorType: "staff",
        actorId: opts.actorId,
        payload: JSON.stringify({
          from: r.checkOut,
          to: ext.requestedCheckOut,
          additionalAmount,
        }),
      },
    });
    return u;
  });

  await audit({
    resortId: r.resortId,
    actorType: "staff",
    actorId: opts.actorId,
    action: "BOOKING_EXTEND",
    entity: "reservation",
    entityId: r.id,
    before: { checkOut: r.checkOut, totalAmount: r.totalAmount },
    after: { checkOut: updated.checkOut, totalAmount: updated.totalAmount, additionalAmount },
  });

  return { decision: "APPROVED" as const, reservation: updated, additionalAmount };
}

// ─── Lookup (public) ───────────────────────────────────────────────

export async function lookupReservation(opts: {
  resortId: string;
  bookingReference: string;
  phone: string;
}) {
  const r = await prisma.reservation.findFirst({
    where: { resortId: opts.resortId, bookingReference: opts.bookingReference },
    include: {
      guest: true,
      roomType: { select: { name: true, slug: true } },
      payments: true,
    },
  });
  if (!r) throw new NotFoundError("Reservation not found.");
  // Phone check (basic) — guests can only see their own booking.
  if (
    r.guest.phone.replace(/\D/g, "").slice(-10) !==
    opts.phone.replace(/\D/g, "").slice(-10)
  ) {
    throw new NotFoundError("Reservation not found."); // don't leak existence
  }
  return r;
}
