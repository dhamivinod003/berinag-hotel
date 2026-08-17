import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../config/database.js";
import { env } from "../config/env.js";
import { NotFoundError, BadRequestError, ConflictError } from "../utils/errors.js";
import {
  assignRoom,
  cancelReservation,
  checkIn,
  checkOut,
  confirmReservation,
  decideExtension,
  moveRoom,
  requestExtension,
} from "../services/reservationService.js";
import { refundPayment } from "../services/paymentService.js";
import { getCalendarView } from "../services/calendarService.js";
import { sanitizeInput, sanitizeOptional } from "../utils/sanitize.js";
import { eventBus } from "../realtime/events.js";

// ─── Dashboard ─────────────────────────────────────────────────────

export async function getCalendarViewHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const from = req.query.from ? new Date(String(req.query.from)) : new Date();
    const to = req.query.to ? new Date(String(req.query.to)) : new Date(from.getTime() + 6 * 86400_000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      res.status(400).json({ error: { code: "BAD_DATE", message: "Invalid from/to" } });
      return;
    }
    if (to.getTime() - from.getTime() > 92 * 86400_000) {
      res.status(400).json({ error: { code: "RANGE_TOO_WIDE", message: "Max 92 days" } });
      return;
    }
    from.setHours(0, 0, 0, 0);
    to.setHours(0, 0, 0, 0);
    const view = await getCalendarView(req.staff!.resortId, from, to);
    res.json(view);
  } catch (err) {
    next(err);
  }
}

const BOOKED_STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN"];
const COUNTED_STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT"];
const OCCUPYING_STATUSES = ["CONFIRMED", "CHECKED_IN"];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDaysLocal(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function weekdayLabel(d: Date): string {
  return d.toLocaleDateString("en-IN", { weekday: "short" });
}

function relativeTime(d: Date): string {
  const sec = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) {
    const h = Math.floor(sec / 3600);
    return h === 1 ? "1 hour ago" : `${h} hours ago`;
  }
  const days = Math.floor(sec / 86400);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

function roomsOccupiedOn(reservations: Array<{ checkIn: Date; checkOut: Date; roomCount: number }>, day: Date): number {
  const start = day.getTime();
  const end = addDaysLocal(day, 1).getTime();
  let n = 0;
  for (const r of reservations) {
    if (r.checkIn.getTime() < end && r.checkOut.getTime() > start) {
      n += r.roomCount || 1;
    }
  }
  return n;
}

const reservationListSelect = {
  id: true,
  bookingReference: true,
  status: true,
  checkIn: true,
  checkOut: true,
  nights: true,
  adults: true,
  children: true,
  roomCount: true,
  arrivalTime: true,
  createdAt: true,
  totalAmount: true,
  guest: { select: { fullName: true, phone: true } },
  roomType: { select: { name: true } },
  assignments: {
    where: { releasedAt: null },
    include: { room: { select: { roomNumber: true } } },
  },
} as const;

export async function dashboardSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resortId = req.staff!.resortId;
    const today = startOfDay(new Date());
    const tomorrow = addDaysLocal(today, 1);
    const weekEnd = addDaysLocal(today, 7);

    const [
      totalRooms,
      maintenanceRooms,
      dirtyRooms,
      cleaningRooms,
      readyRooms,
      occupiedPhysical,
      outOfOrderRooms,
      totalBookings,
      todaysBookings,
      pendingBookings,
      pendingEnquiries,
      cancelledCount,
      todaysBookingValue,
      todaysCollected,
      overlappingToday,
      weekReservations,
      arrivalRows,
      departureRows,
      recentRows,
      enquiryRows,
    ] = await Promise.all([
      prisma.room.count({ where: { resortId, isActive: true } }),
      prisma.room.count({
        where: { resortId, isActive: true, status: { in: ["MAINTENANCE", "OUT_OF_ORDER"] } },
      }),
      prisma.room.count({ where: { resortId, isActive: true, status: "CLEANING" } }),
      prisma.room.count({ where: { resortId, isActive: true, status: "DIRTY" } }),
      prisma.room.count({ where: { resortId, isActive: true, status: "READY" } }),
      prisma.room.count({ where: { resortId, isActive: true, status: "OCCUPIED" } }),
      prisma.room.count({ where: { resortId, isActive: true, status: "OUT_OF_ORDER" } }),
      prisma.reservation.count({
        where: { resortId, status: { in: COUNTED_STATUSES } },
      }),
      prisma.reservation.count({
        where: {
          resortId,
          status: { in: COUNTED_STATUSES },
          createdAt: { gte: today, lt: tomorrow },
        },
      }),
      prisma.reservation.count({ where: { resortId, status: "PENDING" } }),
      prisma.enquiry.count({ where: { resortId, status: "NEW" } }),
      prisma.reservation.count({
        where: { resortId, status: "CANCELLED", cancelledAt: { gte: today, lt: tomorrow } },
      }),
      prisma.reservation.aggregate({
        where: {
          resortId,
          status: { in: COUNTED_STATUSES },
          createdAt: { gte: today, lt: tomorrow },
        },
        _sum: { totalAmount: true },
      }),
      prisma.payment.aggregate({
        where: {
          resortId,
          status: "CAPTURED",
          createdAt: { gte: today, lt: tomorrow },
        },
        _sum: { amount: true },
      }),
      prisma.reservation.findMany({
        where: {
          resortId,
          status: { in: OCCUPYING_STATUSES },
          checkIn: { lt: tomorrow },
          checkOut: { gt: today },
        },
        select: { roomCount: true },
      }),
      prisma.reservation.findMany({
        where: {
          resortId,
          status: { in: [...OCCUPYING_STATUSES, "CHECKED_OUT"] },
          checkIn: { lt: weekEnd },
          checkOut: { gt: today },
        },
        select: { checkIn: true, checkOut: true, roomCount: true },
      }),
      prisma.reservation.findMany({
        where: {
          resortId,
          status: { in: BOOKED_STATUSES },
          checkIn: { gte: today, lt: tomorrow },
        },
        select: reservationListSelect,
        orderBy: { arrivalTime: "asc" },
        take: 8,
      }),
      prisma.reservation.findMany({
        where: {
          resortId,
          status: { in: ["CONFIRMED", "CHECKED_IN"] },
          checkOut: { gte: today, lt: tomorrow },
        },
        select: reservationListSelect,
        orderBy: { checkOut: "asc" },
        take: 8,
      }),
      prisma.reservation.findMany({
        where: { resortId, status: { in: COUNTED_STATUSES } },
        select: reservationListSelect,
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      prisma.enquiry.findMany({
        where: { resortId, status: "NEW" },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          name: true,
          message: true,
          requestedCheckIn: true,
          requestedCheckOut: true,
          createdAt: true,
        },
      }),
    ]);

    const occupiedRooms = overlappingToday.reduce((sum, r) => sum + (r.roomCount || 1), 0);
    const availableCount = Math.max(0, totalRooms - occupiedRooms - maintenanceRooms);
    const occupancyPct = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

    const occupancyTrend = Array.from({ length: 7 }, (_, i) => {
      const day = addDaysLocal(today, i);
      const occupied = roomsOccupiedOn(weekReservations, day);
      return {
        day: weekdayLabel(day),
        date: isoDate(day),
        occupied,
        total: totalRooms,
        value: totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0,
      };
    });

    const mapStay = (r: (typeof arrivalRows)[number]) => ({
      id: r.id,
      bookingReference: r.bookingReference,
      guestName: r.guest?.fullName ?? "Guest",
      roomType: r.roomType?.name ?? "Room",
      roomNumber: r.assignments[0]?.room?.roomNumber ?? null,
      guests: (r.adults ?? 0) + (r.children ?? 0),
      rooms: r.roomCount,
      time: r.arrivalTime ?? null,
      checkIn: r.checkIn.toISOString(),
      checkOut: r.checkOut.toISOString(),
      status: r.status,
    });

    res.json({
      occupancy: { total: totalRooms, occupied: occupiedRooms, percentage: occupancyPct },
      availableRooms: { count: availableCount },
      maintenanceRooms: { count: maintenanceRooms },
      bookings: { total: totalBookings, today: todaysBookings, pending: pendingBookings },
      checkIns: { today: arrivalRows.length },
      checkOuts: { today: departureRows.length },
      pendingBookings: { count: pendingBookings },
      pendingEnquiries: { count: pendingEnquiries },
      cancelledToday: { count: cancelledCount },
      revenue: {
        todayPaise: todaysBookingValue._sum.totalAmount ?? 0,
        collectedPaise: todaysCollected._sum.amount ?? 0,
      },
      occupancyTrend,
      arrivals: arrivalRows.map(mapStay),
      departures: departureRows.map(mapStay),
      recentBookings: recentRows.map((r) => ({
        id: r.id,
        bookingReference: r.bookingReference,
        guestName: r.guest?.fullName ?? "Guest",
        roomType: r.roomType?.name ?? "Room",
        checkIn: r.checkIn.toISOString(),
        checkOut: r.checkOut.toISOString(),
        status: r.status,
        rooms: r.roomCount,
        totalAmount: r.totalAmount,
      })),
      enquiries: enquiryRows.map((e) => ({
        id: e.id,
        name: e.name,
        detail: e.message?.trim() || "Website enquiry",
        time: relativeTime(e.createdAt),
        requestedCheckIn: e.requestedCheckIn?.toISOString() ?? null,
        requestedCheckOut: e.requestedCheckOut?.toISOString() ?? null,
      })),
      housekeeping: {
        dirty: dirtyRooms + cleaningRooms,
        cleaning: cleaningRooms,
        ready: readyRooms,
        occupied: occupiedPhysical,
        maintenance: maintenanceRooms,
        outOfOrder: outOfOrderRooms,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── Staff ─────────────────────────────────────────────────────────

export async function listStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resortId = req.staff!.resortId;
    const staff = await prisma.staff.findMany({
      where: { resortId, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        roleKey: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
    res.json({ items: staff });
  } catch (err) {
    next(err);
  }
}

export const createStaffSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  phone: z.string().optional(),
  roleKey: z.string(),
  password: z.string().min(8),
});

export async function createStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resortId = req.staff!.resortId;
    const body = req.body as z.infer<typeof createStaffSchema>;
    const existing = await prisma.staff.findFirst({
      where: { resortId, email: body.email.toLowerCase() },
    });
    if (existing) throw new ConflictError("Staff with this email already exists");
    const passwordHash = await bcrypt.hash(body.password, env.BCRYPT_COST);
    const s = await prisma.staff.create({
      data: {
        resortId,
        email: body.email.toLowerCase(),
        name: body.name,
        phone: body.phone,
        roleKey: body.roleKey,
        passwordHash,
        status: "ACTIVE",
      },
      select: { id: true, email: true, name: true, roleKey: true, status: true, createdAt: true },
    });
    res.status(201).json(s);
  } catch (err) {
    next(err);
  }
}

export const updateStaffSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  roleKey: z.string().optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "INACTIVE"]).optional(),
});

export async function updateStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resortId = req.staff!.resortId;
    const id = req.params.id;
    const body = req.body as z.infer<typeof updateStaffSchema>;
    const existing = await prisma.staff.findFirst({
      where: { id, resortId, deletedAt: null },
    });
    if (!existing) throw new NotFoundError("Staff not found");

    if (body.status && body.status !== "ACTIVE" && existing.status === "ACTIVE") {
      const { revokeAllForStaff } = await import("../services/tokenService.js");
      await revokeAllForStaff(existing.id, "staff_suspended");
    }

    const s = await prisma.staff.update({
      where: { id: existing.id },
      data: body,
      select: { id: true, email: true, name: true, roleKey: true, status: true, createdAt: true },
    });
    res.json(s);
  } catch (err) {
    next(err);
  }
}

// ─── Roles ─────────────────────────────────────────────────────────

export async function listRoles(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resortId = req.staff!.resortId;
    const roles = await prisma.role.findMany({
      where: { OR: [{ resortId: null }, { resortId }] },
      include: { permissions: { include: { permission: true } } },
      orderBy: { key: "asc" },
    });
    res.json({
      items: roles.map((r) => ({
        id: r.id,
        key: r.key,
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
        permissions: r.permissions.map((rp) => rp.permission.key),
      })),
    });
  } catch (err) {
    next(err);
  }
}

// ─── Reservations ──────────────────────────────────────────────────

export async function listReservations(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const resortId = req.staff!.resortId;
    const { status, source, roomTypeId, q, from, to } = req.query as Record<string, string | undefined>;
    const where: Record<string, unknown> = { resortId };
    if (status) where.status = status;
    if (source) where.source = source;
    if (roomTypeId) where.roomTypeId = roomTypeId;
    if (q) {
      where.OR = [
        { bookingReference: { contains: q } },
        { guest: { fullName: { contains: q } } },
        { guest: { phone: { contains: q } } },
      ];
    }
    if (from || to) {
      where.checkIn = {};
      if (from) (where.checkIn as Record<string, Date>).gte = new Date(from);
      if (to) (where.checkIn as Record<string, Date>).lte = new Date(to);
    }
    const items = await prisma.reservation.findMany({
      where,
      include: {
        guest: { select: { fullName: true, phone: true, email: true } },
        roomType: { select: { name: true, slug: true } },
        assignments: { where: { releasedAt: null }, include: { room: { select: { roomNumber: true } } } },
      },
      orderBy: { checkIn: "desc" },
      take: 50,
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function getReservation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const resortId = req.staff!.resortId;
    const r = await prisma.reservation.findFirst({
      where: { id: req.params.id, resortId },
      include: {
        guest: true,
        roomType: true,
        assignments: { include: { room: true } },
        payments: { orderBy: { createdAt: "asc" } },
        events: { orderBy: { createdAt: "desc" }, take: 50 },
        notes: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      },
    });
    if (!r) throw new NotFoundError();
    res.json(r);
  } catch (err) {
    next(err);
  }
}

export const confirmReservationSchema = z.object({ note: z.string().optional() });
export async function confirmReservationHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const r = await confirmReservation({
      reservationId: req.params.id,
      resortId: req.staff!.resortId,
      actorId: req.staff!.id,
    });
    res.json(r);
  } catch (err) {
    next(err);
  }
}

export const cancelReservationSchema = z.object({ reason: z.string().min(1) });
export async function cancelReservationHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as z.infer<typeof cancelReservationSchema>;
    const result = await cancelReservation({
      reservationId: req.params.id,
      resortId: req.staff!.resortId,
      reason: body.reason,
      actorType: "staff",
      actorId: req.staff!.id,
      ip: req.ip,
      userAgent: req.header("user-agent") ?? undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function checkInHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const r = await checkIn({
      reservationId: req.params.id,
      resortId: req.staff!.resortId,
      actorId: req.staff!.id,
    });
    res.json(r);
  } catch (err) {
    next(err);
  }
}

export async function checkOutHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const r = await checkOut({
      reservationId: req.params.id,
      resortId: req.staff!.resortId,
      actorId: req.staff!.id,
    });
    res.json(r);
  } catch (err) {
    next(err);
  }
}

export const assignRoomSchema = z.object({ roomId: z.string() });
export async function assignRoomHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as z.infer<typeof assignRoomSchema>;
    const a = await assignRoom({
      reservationId: req.params.id,
      resortId: req.staff!.resortId,
      roomId: body.roomId,
      actorId: req.staff!.id,
    });
    res.json(a);
  } catch (err) {
    next(err);
  }
}

export const moveRoomSchema = z.object({
  toRoomId: z.string(),
  reason: z.string().min(1),
  notes: z.string().optional(),
});
export async function moveRoomHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as z.infer<typeof moveRoomSchema>;
    const r = await moveRoom({
      reservationId: req.params.id,
      resortId: req.staff!.resortId,
      toRoomId: body.toRoomId,
      reason: body.reason,
      notes: body.notes,
      actorId: req.staff!.id,
    });
    res.json(r);
  } catch (err) {
    next(err);
  }
}

export const extensionRequestSchema = z.object({
  newCheckOut: z.string(),
});
export async function requestExtensionHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as z.infer<typeof extensionRequestSchema>;
    const result = await requestExtension({
      reservationId: req.params.id,
      resortId: req.staff!.resortId,
      newCheckOut: new Date(body.newCheckOut),
      actorType: "staff",
      actorId: req.staff!.id,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export const extensionDecisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().optional(),
});
export async function decideExtensionHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as z.infer<typeof extensionDecisionSchema>;
    const result = await decideExtension({
      extensionId: req.params.extId,
      resortId: req.staff!.resortId,
      decision: body.decision,
      note: body.note,
      actorId: req.staff!.id,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ─── Room types ────────────────────────────────────────────────────

export async function listRoomTypes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resortId = req.staff!.resortId;
    const items = await prisma.roomType.findMany({
      where: { resortId, deletedAt: null },
      include: { _count: { select: { rooms: true } } },
      orderBy: { displayOrder: "asc" },
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function listRooms(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resortId = req.staff!.resortId;
    const items = await prisma.room.findMany({
      where: { resortId, isActive: true },
      include: { roomType: { select: { name: true, slug: true, basePrice: true } } },
      orderBy: [{ roomTypeId: "asc" }, { roomNumber: "asc" }],
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export const roomStatusSchema = z.object({
  status: z.enum(["READY", "OCCUPIED", "CLEANING", "DIRTY", "MAINTENANCE", "OUT_OF_ORDER"]),
});
export async function updateRoomStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const resortId = req.staff!.resortId;
    const body = req.body as z.infer<typeof roomStatusSchema>;
    const existing = await prisma.room.findFirst({
      where: { id: req.params.id, resortId, isActive: true },
    });
    if (!existing) throw new NotFoundError("Room not found");
    const room = await prisma.room.update({
      where: { id: existing.id },
      data: { status: body.status },
    });
    eventBus.emitEvent(resortId, {
      type: "ROOM_STATUS_CHANGED",
      data: { roomId: room.id, status: room.status },
    });
    res.json(room);
  } catch (err) {
    next(err);
  }
}

// ─── Enquiries ─────────────────────────────────────────────────────

export async function listEnquiries(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resortId = req.staff!.resortId;
    const { status } = req.query as { status?: string };
    const items = await prisma.enquiry.findMany({
      where: { resortId, ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export const updateEnquirySchema = z.object({
  status: z.enum(["NEW", "CONTACTED", "AWAITING_RESPONSE", "CONVERTED", "LOST", "SPAM"]).optional(),
  assignedToId: z.string().optional(),
});
export async function updateEnquiry(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resortId = req.staff!.resortId;
    const body = req.body as z.infer<typeof updateEnquirySchema>;
    const existing = await prisma.enquiry.findFirst({
      where: { id: req.params.id, resortId },
    });
    if (!existing) throw new NotFoundError("Enquiry not found");
    const e = await prisma.enquiry.update({
      where: { id: existing.id },
      data: body,
    });
    res.json(e);
  } catch (err) {
    next(err);
  }
}

// ─── Offers ────────────────────────────────────────────────────────

export async function listOffers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resortId = req.staff!.resortId;
    const items = await prisma.offer.findMany({
      where: { resortId, deletedAt: null },
      include: { roomTypes: { include: { roomType: { select: { name: true, slug: true } } } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export const createOfferSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  shortDesc: z.string().optional(),
  discountType: z.enum(["PERCENT", "FLAT"]),
  discountValue: z.number().int().positive(),
  minNights: z.number().int().positive().optional(),
  promoCode: z.string().optional(),
  startDate: z.string(),
  endDate: z.string(),
  status: z.enum(["DRAFT", "PUBLISHED", "PAUSED"]).default("DRAFT"),
  roomTypeIds: z.array(z.string()).default([]),
});
export async function createOffer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resortId = req.staff!.resortId;
    const body = req.body as z.infer<typeof createOfferSchema>;
    const o = await prisma.offer.create({
      data: {
        resortId,
        slug: body.slug,
        name: body.name,
        description: body.description,
        shortDesc: body.shortDesc,
        discountType: body.discountType,
        discountValue: body.discountValue,
        minNights: body.minNights,
        promoCode: body.promoCode,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        status: body.status,
        roomTypes: {
          create: body.roomTypeIds.map((id) => ({ roomTypeId: id })),
        },
      },
    });
    res.status(201).json(o);
  } catch (err) {
    next(err);
  }
}

// ─── Housekeeping ─────────────────────────────────────────────────

export async function housekeepingBoard(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const resortId = req.staff!.resortId;
    const rooms = await prisma.room.findMany({
      where: { resortId, isActive: true },
      include: {
        roomType: { select: { name: true, basePrice: true } },
        housekeepingTasks: {
          where: { status: { in: ["PENDING", "IN_PROGRESS"] } },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: [{ roomTypeId: "asc" }, { roomNumber: "asc" }],
    });
    const summary = {
      dirty: rooms.filter((r) => r.status === "CLEANING").length,
      ready: rooms.filter((r) => r.status === "READY").length,
      occupied: rooms.filter((r) => r.status === "OCCUPIED").length,
      maintenance: rooms.filter((r) => r.status === "MAINTENANCE" || r.status === "OUT_OF_ORDER").length,
    };
    res.json({ rooms, summary });
  } catch (err) {
    next(err);
  }
}

export const updateHkTaskSchema = z.object({
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "BLOCKED", "SKIPPED"]),
  notes: z.string().optional(),
});
export async function updateHkTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resortId = req.staff!.resortId;
    const body = req.body as z.infer<typeof updateHkTaskSchema>;
    const existing = await prisma.housekeepingTask.findFirst({
      where: { id: req.params.id, resortId },
    });
    if (!existing) throw new NotFoundError("Housekeeping task not found");

    const task = await prisma.housekeepingTask.update({
      where: { id: existing.id },
      data: {
        status: body.status,
        notes: body.notes,
        startedAt: body.status === "IN_PROGRESS" ? new Date() : undefined,
        completedAt: body.status === "COMPLETED" ? new Date() : undefined,
      },
    });
    // If the task is for a room in CLEANING and is now COMPLETED, mark the room READY.
    if (body.status === "COMPLETED") {
      await prisma.room.updateMany({ where: { id: task.roomId, resortId }, data: { status: "READY" } });
    }
    res.json(task);
  } catch (err) {
    next(err);
  }
}

// ─── Audit log ─────────────────────────────────────────────────────

export async function listAuditLog(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resortId = req.staff!.resortId;
    const items = await prisma.auditLog.findMany({
      where: { resortId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

// ─── Settings ─────────────────────────────────────────────────────

export async function getSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resortId = req.staff!.resortId;
    const items = await prisma.websiteSetting.findMany({ where: { resortId } });
    const map: Record<string, unknown> = {};
    for (const it of items) {
      try {
        map[it.key] = JSON.parse(it.value);
      } catch {
        map[it.key] = it.value;
      }
    }
    res.json(map);
  } catch (err) {
    next(err);
  }
}

export const updateSettingsSchema = z.record(z.string(), z.unknown());
export async function updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resortId = req.staff!.resortId;
    const actorId = req.staff!.id;
    const body = req.body as z.infer<typeof updateSettingsSchema>;
    await Promise.all(
      Object.entries(body).map(([key, value]) =>
        prisma.websiteSetting.upsert({
          where: { resortId_key: { resortId, key } },
          create: { resortId, key, value: JSON.stringify(value), updatedById: actorId },
          update: { value: JSON.stringify(value), updatedById: actorId },
        })
      )
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ─── Payments: refund ──────────────────────────────────────────────

export const refundPaymentSchema = z.object({
  amount: z.coerce.number().int().positive().optional(), // partial refund amount in paise
  reason: z.string().max(500).optional(),
});

export async function refundPaymentHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as z.infer<typeof refundPaymentSchema>;
    const result = await refundPayment({
      paymentId: req.params.id,
      amountPaise: body.amount,
      reason: body.reason,
      staffId: req.staff!.id,
      resortId: req.staff!.resortId,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ─── CMS (hero, pages) ────────────────────────────────────────────

export async function getHero(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resortId = req.staff!.resortId;
    const section = await prisma.websiteSection.findFirst({
      where: { resortId, key: "hero" },
    });
    res.json(section ? JSON.parse(section.content) : null);
  } catch (err) {
    next(err);
  }
}

export const updateHeroSchema = z.object({
  headline: z.string().min(1),
  subheadline: z.string().optional(),
  imageUrl: z.string().url(),
  imagePublicId: z.string().optional(),
  primaryCtaLabel: z.string(),
  primaryCtaHref: z.string(),
  secondaryCtaLabel: z.string().optional(),
  secondaryCtaHref: z.string().optional(),
});
export async function updateHero(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resortId = req.staff!.resortId;
    const body = req.body as z.infer<typeof updateHeroSchema>;
    await prisma.websiteSection.upsert({
      where: { resortId_key: { resortId, key: "hero" } },
      create: {
        resortId,
        key: "hero",
        title: "Hero",
        content: JSON.stringify(body),
        updatedById: req.staff!.id,
      },
      update: { content: JSON.stringify(body), updatedById: req.staff!.id },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ─── Reviews / Testimonials ────────────────────────────────────────────────
// Distinguishes sources so internal/website testimonials can never be mis-labeled as Google.

export const REVIEW_SOURCES = ["GOOGLE", "DIRECT", "WEBSITE", "TRIPADVISOR", "MAKEMYTRIP", "OTHER"] as const;
export const REVIEW_STATUSES = ["DRAFT", "PUBLISHED"] as const;

export const reviewSchema = z.object({
  source: z.enum(REVIEW_SOURCES),
  sourceUrl: z.string().url().optional().nullable(),
  authorName: z.string().min(1).max(120),
  authorAvatar: z.string().optional().nullable(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(200).optional().nullable(),
  body: z.string().min(1).max(4000),
  stayDate: z.string().optional().nullable(),
  status: z.enum(REVIEW_STATUSES).default("DRAFT"),
  isFeatured: z.boolean().default(false),
});

export async function listReviews(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resortId = req.staff!.resortId;
    const { source, status, featured, q, limit, offset } = req.query as Record<string, string | undefined>;
    const where: Record<string, unknown> = { resortId };
    if (source) where.source = source;
    if (status) where.status = status;
    if (featured === "true") where.isFeatured = true;
    if (q) {
      where.OR = [
        { authorName: { contains: q } },
        { content: { contains: q } },
      ];
    }
    const take = Math.min(parseInt(limit ?? "50", 10) || 50, 200);
    const skip = Math.max(parseInt(offset ?? "0", 10) || 0, 0);
    const [items, total] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy: [{ isFeatured: "desc" }, { reviewDate: "desc" }, { createdAt: "desc" }],
        take,
        skip,
      }),
      prisma.review.count({ where }),
    ]);
    res.json({ items, total, limit: take, offset: skip });
  } catch (err) {
    next(err);
  }
}

export async function getReview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resortId = req.staff!.resortId;
    const id = req.params.id;
    const r = await prisma.review.findFirst({ where: { id, resortId } });
    if (!r) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Review not found" } });
      return;
    }
    res.json({ review: r });
  } catch (err) {
    next(err);
  }
}

export async function createReview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resortId = req.staff!.resortId;
    const body = req.body as z.infer<typeof reviewSchema>;
    const r = await prisma.review.create({
      data: {
        resortId,
        source: body.source,
        sourceUrl: body.sourceUrl ?? null,
        authorName: sanitizeInput(body.authorName),
        authorAvatar: sanitizeOptional(body.authorAvatar) ?? null,
        rating: body.rating,
        content: sanitizeInput(body.body),
        reviewDate: body.stayDate ? new Date(body.stayDate) : new Date(),
        status: body.status,
        isFeatured: body.isFeatured,
      },
    });
    res.status(201).json({ review: r });
  } catch (err) {
    next(err);
  }
}

export async function updateReview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resortId = req.staff!.resortId;
    const id = req.params.id;
    const body = req.body as z.infer<typeof reviewSchema>;
    const existing = await prisma.review.findFirst({ where: { id, resortId } });
    if (!existing) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Review not found" } });
      return;
    }
    const r = await prisma.review.update({
      where: { id },
      data: {
        source: body.source,
        sourceUrl: body.sourceUrl ?? null,
        authorName: sanitizeInput(body.authorName),
        authorAvatar: sanitizeOptional(body.authorAvatar) ?? null,
        rating: body.rating,
        content: sanitizeInput(body.body),
        reviewDate: body.stayDate ? new Date(body.stayDate) : existing.reviewDate,
        status: body.status,
        isFeatured: body.isFeatured,
      },
    });
    res.json({ review: r });
  } catch (err) {
    next(err);
  }
}

export async function deleteReview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resortId = req.staff!.resortId;
    const id = req.params.id;
    const existing = await prisma.review.findFirst({ where: { id, resortId } });
    if (!existing) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Review not found" } });
      return;
    }
    await prisma.review.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// ─── Notification center ───────────────────────────────────────────────────

export async function listNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resortId = req.staff!.resortId;
    const { unread, limit, offset } = req.query as Record<string, string | undefined>;
    const where: Record<string, unknown> = { resortId };
    if (unread === "true") where.readAt = null;
    const take = Math.min(parseInt(limit ?? "50", 10) || 50, 200);
    const skip = Math.max(parseInt(offset ?? "0", 10) || 0, 0);
    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      prisma.notification.count({ where }),
    ]);
    res.json({ items, total, limit: take, offset: skip });
  } catch (err) {
    next(err);
  }
}

export async function notificationUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resortId = req.staff!.resortId;
    const count = await prisma.notification.count({ where: { resortId, readAt: null } });
    res.json({ count });
  } catch (err) {
    next(err);
  }
}

export async function markNotificationRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resortId = req.staff!.resortId;
    const id = req.params.id;
    const n = await prisma.notification.findFirst({ where: { id, resortId } });
    if (!n) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Notification not found" } });
      return;
    }
    if (n.readAt) {
      res.json({ notification: n });
      return;
    }
    const updated = await prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    res.json({ notification: updated });
  } catch (err) {
    next(err);
  }
}

export async function markAllNotificationsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resortId = req.staff!.resortId;
    const r = await prisma.notification.updateMany({
      where: { resortId, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ updated: r.count });
  } catch (err) {
    next(err);
  }
}

export async function deleteNotification(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resortId = req.staff!.resortId;
    const id = req.params.id;
    const n = await prisma.notification.findFirst({ where: { id, resortId } });
    if (!n) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Notification not found" } });
      return;
    }
    await prisma.notification.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// ─── File Upload (local dev fallback, S3-ready abstraction) ──────────────
// Uses multer if available; otherwise accepts a base64 payload as a fallback
// so we can run without extra native deps. Returns a relative URL like
// /uploads/<resortId>/<filename> that can be served by the static middleware.

import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { randomBytes } from "node:crypto";

const UPLOAD_ROOT = path.resolve(process.cwd(), "uploads");
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.UPLOAD_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(png|jpe?g|webp|gif|avif)$/i.test(file.mimetype);
    if (!ok) return cb(new Error("UNSUPPORTED_MEDIA_TYPE"));
    cb(null, true);
  },
});

export function uploadMiddleware(req: Request, res: Response, next: NextFunction): void {
  upload.single("file")(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    const message = err instanceof Error ? err.message : "Upload failed";
    if (message === "UNSUPPORTED_MEDIA_TYPE" || (err as { name?: string }).name === "MulterError") {
      next(new BadRequestError(message === "UNSUPPORTED_MEDIA_TYPE" ? "Unsupported media type" : message));
      return;
    }
    next(err);
  });
}

function getImageExtensionFromMagic(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  if (isPng) return ".png";
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (isJpeg) return ".jpg";
  const isGif = buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46;
  if (isGif) return ".gif";
  const isWebp = buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;
  if (isWebp) return ".webp";
  return null;
}

export async function uploadFile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const file = req.file;
    if (!file?.buffer) {
      res.status(400).json({ error: { code: "NO_FILE", message: "No file uploaded" } });
      return;
    }

    const ext = getImageExtensionFromMagic(file.buffer);
    if (!ext) {
      res.status(400).json({ error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Invalid image format signature" } });
      return;
    }

    const dir = path.join(UPLOAD_ROOT, req.staff!.resortId);
    fs.mkdirSync(dir, { recursive: true });
    const filename = `${Date.now()}-${randomBytes(8).toString("hex")}${ext}`;
    const dest = path.join(dir, filename);
    fs.writeFileSync(dest, file.buffer);

    const relPath = `/uploads/${req.staff!.resortId}/${filename}`;
    res.json({
      url: relPath,
      filename,
      mimetype: file.mimetype,
      size: file.size,
    });
  } catch (err) {
    next(err);
  }
}
