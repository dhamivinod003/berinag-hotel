// Guest management controller.
// All endpoints are resort-scoped via req.staff!.resortId (never trust the client).
// Sensitive fields (idNumber, internal notes) are gated by permissions at the route layer.

import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../config/database.js";
import { NotFoundError } from "../utils/errors.js";
import { audit } from "../middleware/audit.js";
import { sanitizeInput } from "../utils/sanitize.js";

// ─── List / search ─────────────────────────────────────────────────────────

export async function listGuests(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resortId = req.staff!.resortId;
    const { q, email, phone, limit, offset } = req.query as Record<string, string | undefined>;

    const where: Record<string, unknown> = { resortId };

    if (q && q.trim().length > 0) {
      const term = q.trim();
      // SQLite is case-insensitive by default for ASCII LIKE; Prisma's `contains` works.
      where.OR = [
        { fullName: { contains: term } },
        { email: { contains: term } },
        { phone: { contains: term } },
      ];
    } else {
      if (email) where.email = { contains: email };
      if (phone) where.phone = { contains: phone };
    }

    const take = Math.min(parseInt(limit ?? "50", 10) || 50, 200);
    const skip = Math.max(parseInt(offset ?? "0", 10) || 0, 0);

    const [items, total] = await Promise.all([
      prisma.guest.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take,
        skip,
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          countryCode: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { reservations: true } },
        },
      }),
      prisma.guest.count({ where }),
    ]);

    res.json({ items, total, limit: take, offset: skip });
  } catch (err) {
    next(err);
  }
}

// ─── Single profile ────────────────────────────────────────────────────────

export async function getGuest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resortId = req.staff!.resortId;
    const id = req.params.id;
    const guest = await prisma.guest.findFirst({
      where: { id, resortId },
    });
    if (!guest) throw new NotFoundError("Guest not found");

    const [reservations, paymentsAgg, currentReservation, upcomingReservations] = await Promise.all([
      prisma.reservation.findMany({
        where: { resortId, guestId: id },
        orderBy: { checkIn: "desc" },
        take: 50,
        include: {
          roomType: { select: { name: true, slug: true } },
          assignments: {
            where: { releasedAt: null },
            include: { room: { select: { roomNumber: true } } },
          },
          payments: { select: { amount: true, status: true, createdAt: true } },
        },
      }),
      // Total amount captured across all payments for this guest (only if REVENUE_VIEW).
      req.staff!.permissions.includes("REVENUE_VIEW")
        ? prisma.payment.aggregate({
            where: { resortId, reservation: { guestId: id }, status: "CAPTURED" },
            _sum: { amount: true },
            _count: { _all: true },
          })
        : Promise.resolve({ _sum: { amount: 0 }, _count: { _all: 0 } }),
      prisma.reservation.findFirst({
        where: {
          resortId,
          guestId: id,
          status: { in: ["CONFIRMED", "CHECKED_IN"] },
          checkOut: { gte: new Date() },
        },
        orderBy: { checkIn: "asc" },
        include: {
          roomType: { select: { name: true } },
          assignments: { include: { room: { select: { roomNumber: true } } } },
        },
      }),
      prisma.reservation.count({
        where: {
          resortId,
          guestId: id,
          status: { in: ["PENDING", "CONFIRMED"] },
          checkIn: { gte: new Date() },
        },
      }),
    ]);

    const pastReservations = reservations.filter((r) => r.status === "CHECKED_OUT" || r.status === "CANCELLED" || r.status === "NO_SHOW");
    const totalBookings = reservations.length;
    const totalSpentPaise = paymentsAgg._sum.amount ?? 0;

    // Strip sensitive internal fields unless GUEST_EDIT or owner role.
    const canSeeSensitive = req.staff!.permissions.includes("GUEST_EDIT") || req.staff!.roleKey === "OWNER";

    res.json({
      guest: {
        id: guest.id,
        fullName: guest.fullName,
        email: guest.email,
        phone: guest.phone,
        countryCode: guest.countryCode,
        address: canSeeSensitive ? guest.address : null,
        idType: canSeeSensitive ? guest.idType : null,
        idNumber: canSeeSensitive ? guest.idNumber : null,
        notes: canSeeSensitive ? guest.notes : null,
        preferences: canSeeSensitive ? guest.preferences : null,
        createdAt: guest.createdAt,
        updatedAt: guest.updatedAt,
      },
      stats: {
        totalBookings,
        pastReservations: pastReservations.length,
        upcomingReservations,
        hasCurrentStay: Boolean(currentReservation),
        totalSpentPaise,
        canSeeRevenue: req.staff!.permissions.includes("REVENUE_VIEW"),
      },
      currentReservation: currentReservation ?? null,
      reservations,
    });
  } catch (err) {
    next(err);
  }
}

// ─── Update internal notes / preferences (GUEST_EDIT) ──────────────────────

export const updateGuestSchema = z.object({
  fullName: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().min(5).optional(),
  countryCode: z.string().optional(),
  address: z.string().nullable().optional(),
  idType: z.string().nullable().optional(),
  idNumber: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  preferences: z.string().nullable().optional(),
});

export async function updateGuest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resortId = req.staff!.resortId;
    const id = req.params.id;
    const body = req.body as z.infer<typeof updateGuestSchema>;

    const before = await prisma.guest.findFirst({ where: { id, resortId } });
    if (!before) throw new NotFoundError("Guest not found");

    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      if (v === undefined) continue;
      if (typeof v === "string") data[k] = sanitizeInput(v);
      else data[k] = v;
    }

    const guest = await prisma.guest.update({
      where: { id: before.id },
      data,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        countryCode: true,
        address: true,
        idType: true,
        idNumber: true,
        notes: true,
        preferences: true,
        updatedAt: true,
      },
    });

    await audit({
      resortId,
      actorType: "staff",
      actorId: req.staff!.id,
      action: "GUEST_UPDATED",
      entity: "Guest",
      entityId: id,
      before: { fullName: before.fullName, email: before.email, phone: before.phone },
      after: data,
      ip: req.ip,
      userAgent: req.get("user-agent") ?? undefined,
    });

    res.json({ guest });
  } catch (err) {
    next(err);
  }
}

// ─── Export (GUEST_EXPORT) ─────────────────────────────────────────────────

export async function exportGuests(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resortId = req.staff!.resortId;
    const guests = await prisma.guest.findMany({
      where: { resortId },
      orderBy: { fullName: "asc" },
      select: {
        fullName: true,
        email: true,
        phone: true,
        countryCode: true,
        createdAt: true,
        _count: { select: { reservations: true } },
      },
    });

    // Generate CSV
    const header = "Full Name,Email,Phone,Country,Joined,Total Bookings\n";
    const rows = guests
      .map((g) => {
        const escape = (v: unknown) => {
          if (v === null || v === undefined) return "";
          let s = String(v);
          // CSV Formula Injection mitigation
          if (/^[=+\-@\t\r]/.test(s)) {
            s = `'${s}`;
          }
          if (s.includes(",") || s.includes('"') || s.includes("\n")) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        };
        return [escape(g.fullName), escape(g.email), escape(g.phone), escape(g.countryCode), escape(g.createdAt.toISOString()), escape(g._count.reservations)].join(",");
      })
      .join("\n");

    await audit({
      resortId,
      actorType: "staff",
      actorId: req.staff!.id,
      action: "GUEST_EXPORTED",
      entity: "Guest",
      ip: req.ip,
      userAgent: req.get("user-agent") ?? undefined,
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="guests-${new Date().toISOString().split("T")[0]}.csv"`);
    res.send(header + rows);
  } catch (err) {
    next(err);
  }
}
