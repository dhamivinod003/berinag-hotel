// Reports service. All metrics derived from real DB queries — no caching
// for the dynamic data (occupancy, revenue) since staleness here is a
// business problem. Static data (room types, room count) is read from the
// DB each call but it's a single indexed query.
//
// All money in integer paise. Half-open date math: [start, end) — a booking
// that ends 2024-01-15 does NOT occupy the room on 2024-01-15.

import { prisma } from "../config/database.js";

export interface DateRange {
  from: Date; // inclusive
  to: Date;   // inclusive (we convert to exclusive in the queries)
}

function toPrismaRange(r: DateRange): { gte: Date; lt: Date } {
  // "to" is inclusive in the API; convert to exclusive for Prisma `lt`
  const endExclusive = new Date(r.to.getTime() + 24 * 60 * 60 * 1000);
  return { gte: r.from, lt: endExclusive };
}

function daysBetween(a: Date, b: Date): number {
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000)));
}

// ─── Occupancy ───────────────────────────────────────────────────────

export interface OccupancyPoint {
  date: string; // YYYY-MM-DD
  totalRooms: number;
  occupiedRoomNights: number;
  occupancyPct: number; // 0..100
}

export async function occupancyByDay(
  resortId: string,
  range: DateRange
): Promise<OccupancyPoint[]> {
  const roomCount = await prisma.room.count({
    where: { resortId, isActive: true },
  });
  if (roomCount === 0) return [];

  // For each day in the range, count room-nights occupied by CONFIRMED/CHECKED_IN/CHECKED_OUT.
  // We compute this in one query using overlapping window logic.
  // A reservation occupies a room on day D if reservation.checkIn <= D < reservation.checkOut.
  const reservations = await prisma.reservation.findMany({
    where: {
      resortId,
      status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
      checkIn: { lt: new Date(range.to.getTime() + 2 * 86400_000) },
      checkOut: { gt: range.from },
    },
    select: { checkIn: true, checkOut: true },
  });

  // Bucket per day
  const byDate = new Map<string, number>();
  for (let t = range.from.getTime(); t <= range.to.getTime(); t += 86400_000) {
    const d = new Date(t).toISOString().slice(0, 10);
    byDate.set(d, 0);
  }
  for (const r of reservations) {
    const start = r.checkIn.getTime() < range.from.getTime() ? range.from.getTime() : r.checkIn.getTime();
    const end = r.checkOut.getTime() > range.to.getTime() + 86400_000 ? range.to.getTime() + 86400_000 : r.checkOut.getTime();
    for (let t = start; t < end; t += 86400_000) {
      const d = new Date(t).toISOString().slice(0, 10);
      byDate.set(d, (byDate.get(d) ?? 0) + 1);
    }
  }

  const out: OccupancyPoint[] = [];
  for (const [date, occupied] of byDate.entries()) {
    out.push({
      date,
      totalRooms: roomCount,
      occupiedRoomNights: occupied,
      occupancyPct: roomCount > 0 ? Math.round((occupied / roomCount) * 1000) / 10 : 0,
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export async function occupancyByRoomType(
  resortId: string,
  range: DateRange
): Promise<Array<{ roomTypeId: string; roomTypeName: string; occupancyPct: number; nights: number; totalNights: number }>> {
  const rts = await prisma.roomType.findMany({
    where: { resortId, deletedAt: null, status: { in: ["ACTIVE"] } },
    select: { id: true, name: true },
  });
  const totalRoomNights = rts.length * daysBetween(range.from, range.to);

  const reservations = await prisma.reservation.findMany({
    where: {
      resortId,
      roomTypeId: { in: rts.map((r) => r.id) },
      status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
      checkIn: { lt: new Date(range.to.getTime() + 2 * 86400_000) },
      checkOut: { gt: range.from },
    },
    select: { roomTypeId: true, checkIn: true, checkOut: true },
  });

  // Sum room-nights per type
  const nights = new Map<string, number>();
  for (const r of reservations) {
    const start = r.checkIn.getTime() < range.from.getTime() ? range.from.getTime() : r.checkIn.getTime();
    const end = r.checkOut.getTime() > range.to.getTime() + 86400_000 ? range.to.getTime() + 86400_000 : r.checkOut.getTime();
    const n = Math.max(0, Math.round((end - start) / 86400_000));
    nights.set(r.roomTypeId, (nights.get(r.roomTypeId) ?? 0) + n);
  }
  return rts.map((rt) => {
    const used = nights.get(rt.id) ?? 0;
    return {
      roomTypeId: rt.id,
      roomTypeName: rt.name,
      occupancyPct: totalRoomNights > 0 ? Math.round((used / totalRoomNights) * 1000) / 10 : 0,
      nights: used,
      totalNights: totalRoomNights,
    };
  });
}

// ─── Revenue ────────────────────────────────────────────────────────

export interface RevenueSummary {
  totalRevenue: number;       // paise — sum of totalAmount for reservations overlapping the range
  collected: number;          // paise — sum of amountPaid
  outstanding: number;        // paise — totalAmount - amountPaid
  refunded: number;           // paise — sum of refunds
  netRevenue: number;         // paise — collected - refunded
  byRoomType: Array<{ roomTypeId: string; roomTypeName: string; revenue: number }>;
  bySource: Array<{ source: string; revenue: number; count: number }>;
  byDate: Array<{ date: string; revenue: number; count: number }>;
}

export async function revenueSummary(
  resortId: string,
  range: DateRange
): Promise<RevenueSummary> {
  const r = toPrismaRange(range);
  // Reservations that overlap the range (use checkIn for the bucket)
  const reservations = await prisma.reservation.findMany({
    where: {
      resortId,
      checkIn: { gte: r.gte, lt: r.lt },
    },
    include: { payments: true, roomType: { select: { id: true, name: true } } },
  });

  let total = 0;
  let collected = 0;
  let refunded = 0;
  const byRoomType = new Map<string, { name: string; revenue: number }>();
  const bySource = new Map<string, { revenue: number; count: number }>();
  const byDate = new Map<string, { revenue: number; count: number }>();

  for (const r of reservations) {
    total += r.totalAmount;
    collected += r.amountPaid;
    if (r.status === "CANCELLED") continue; // don't count cancelled toward revenue
    const key = r.roomTypeId;
    const cur = byRoomType.get(key) ?? { name: r.roomType.name, revenue: 0 };
    cur.revenue += r.totalAmount;
    byRoomType.set(key, cur);
    const sk = r.source || "UNKNOWN";
    const scur = bySource.get(sk) ?? { revenue: 0, count: 0 };
    scur.revenue += r.totalAmount;
    scur.count += 1;
    bySource.set(sk, scur);
    const dk = r.checkIn.toISOString().slice(0, 10);
    const dcur = byDate.get(dk) ?? { revenue: 0, count: 0 };
    dcur.revenue += r.totalAmount;
    dcur.count += 1;
    byDate.set(dk, dcur);
  }
  // Refunds: payments with status REFUNDED or PARTIALLY_REFUNDED
  const payments = await prisma.payment.findMany({
    where: {
      resortId,
      status: { in: ["REFUNDED", "PARTIALLY_REFUNDED"] },
      updatedAt: { gte: r.gte, lt: r.lt },
    },
  });
  for (const p of payments) {
    refunded += p.amount;
  }

  return {
    totalRevenue: total,
    collected,
    outstanding: Math.max(0, total - collected),
    refunded,
    netRevenue: collected - refunded,
    byRoomType: Array.from(byRoomType.entries()).map(([id, v]) => ({ roomTypeId: id, roomTypeName: v.name, revenue: v.revenue })),
    bySource: Array.from(bySource.entries()).map(([source, v]) => ({ source, revenue: v.revenue, count: v.count })),
    byDate: Array.from(byDate.entries())
      .map(([date, v]) => ({ date, revenue: v.revenue, count: v.count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}

// ─── Bookings ───────────────────────────────────────────────────────

export interface BookingsSummary {
  total: number;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
  averageStayNights: number;
  averageLeadTimeDays: number;
  noShowRatePct: number;
  cancellationRatePct: number;
}

export async function bookingsSummary(
  resortId: string,
  range: DateRange
): Promise<BookingsSummary> {
  const r = toPrismaRange(range);
  const reservations = await prisma.reservation.findMany({
    where: { resortId, createdAt: { gte: r.gte, lt: r.lt } },
    select: { status: true, source: true, nights: true, checkIn: true, createdAt: true },
  });

  const byStatus: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  let totalNights = 0;
  let totalLead = 0;
  let noShow = 0;
  let cancelled = 0;
  for (const r of reservations) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    bySource[r.source] = (bySource[r.source] ?? 0) + 1;
    totalNights += r.nights;
    const lead = Math.max(0, Math.round((r.checkIn.getTime() - r.createdAt.getTime()) / 86400_000));
    totalLead += lead;
    if (r.status === "NO_SHOW") noShow += 1;
    if (r.status === "CANCELLED") cancelled += 1;
  }
  const n = reservations.length;
  return {
    total: n,
    byStatus,
    bySource,
    averageStayNights: n > 0 ? Math.round((totalNights / n) * 10) / 10 : 0,
    averageLeadTimeDays: n > 0 ? Math.round((totalLead / n) * 10) / 10 : 0,
    noShowRatePct: n > 0 ? Math.round((noShow / n) * 1000) / 10 : 0,
    cancellationRatePct: n > 0 ? Math.round((cancelled / n) * 1000) / 10 : 0,
  };
}

// ─── Room performance ──────────────────────────────────────────────

export async function roomPerformance(
  resortId: string,
  range: DateRange
): Promise<
  Array<{
    roomTypeId: string;
    roomTypeName: string;
    bookings: number;
    revenue: number;
    avgValue: number;
  }>
> {
  const r = toPrismaRange(range);
  const rows = await prisma.reservation.groupBy({
    by: ["roomTypeId"],
    where: {
      resortId,
      checkIn: { gte: r.gte, lt: r.lt },
      status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
    },
    _sum: { totalAmount: true },
    _count: { _all: true },
  });
  const rts = await prisma.roomType.findMany({
    where: { id: { in: rows.map((r) => r.roomTypeId) } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(rts.map((rt) => [rt.id, rt.name]));
  return rows
    .map((row) => {
      const rev = row._sum.totalAmount ?? 0;
      const cnt = row._count._all;
      return {
        roomTypeId: row.roomTypeId,
        roomTypeName: nameMap.get(row.roomTypeId) ?? "—",
        bookings: cnt,
        revenue: rev,
        avgValue: cnt > 0 ? Math.round(rev / cnt) : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

// ─── Enquiry funnel ─────────────────────────────────────────────────

export interface EnquiryFunnel {
  total: number;
  byStatus: Record<string, number>;
  conversionRatePct: number; // converted / total
  contactRatePct: number;    // (contacted + converted) / total
}

export async function enquiryFunnel(
  resortId: string,
  range: DateRange
): Promise<EnquiryFunnel> {
  const r = toPrismaRange(range);
  const enquiries = await prisma.enquiry.groupBy({
    by: ["status"],
    where: { resortId, createdAt: { gte: r.gte, lt: r.lt } },
    _count: { _all: true },
  });
  const byStatus: Record<string, number> = {};
  let total = 0;
  let converted = 0;
  let contacted = 0;
  for (const e of enquiries) {
    byStatus[e.status] = e._count._all;
    total += e._count._all;
    if (e.status === "CONVERTED") converted += e._count._all;
    if (e.status === "CONTACTED" || e.status === "CONVERTED") contacted += e._count._all;
  }
  return {
    total,
    byStatus,
    conversionRatePct: total > 0 ? Math.round((converted / total) * 1000) / 10 : 0,
    contactRatePct: total > 0 ? Math.round((contacted / total) * 1000) / 10 : 0,
  };
}

// ─── Top-level rollup ──────────────────────────────────────────────

export interface ReportBundle {
  range: { from: string; to: string };
  occupancy: {
    averagePct: number;
    byDay: OccupancyPoint[];
    byRoomType: Array<{ roomTypeId: string; roomTypeName: string; occupancyPct: number }>;
  };
  revenue: RevenueSummary;
  bookings: BookingsSummary;
  roomPerformance: Awaited<ReturnType<typeof roomPerformance>>;
  enquiries: EnquiryFunnel;
  guests: { total: number; new: number };
}

export async function getReportBundle(
  resortId: string,
  range: DateRange
): Promise<ReportBundle> {
  const [occDay, occByType, rev, book, perf, enq, guests] = await Promise.all([
    occupancyByDay(resortId, range),
    occupancyByRoomType(resortId, range),
    revenueSummary(resortId, range),
    bookingsSummary(resortId, range),
    roomPerformance(resortId, range),
    enquiryFunnel(resortId, range),
    guestStats(resortId, range),
  ]);
  const avgOcc = occDay.length > 0
    ? Math.round((occDay.reduce((s, p) => s + p.occupancyPct, 0) / occDay.length) * 10) / 10
    : 0;
  return {
    range: { from: range.from.toISOString().slice(0, 10), to: range.to.toISOString().slice(0, 10) },
    occupancy: {
      averagePct: avgOcc,
      byDay: occDay,
      byRoomType: occByType.map(({ roomTypeId, roomTypeName, occupancyPct }) => ({ roomTypeId, roomTypeName, occupancyPct })),
    },
    revenue: rev,
    bookings: book,
    roomPerformance: perf,
    enquiries: enq,
    guests,
  };
}

async function guestStats(
  resortId: string,
  range: DateRange
): Promise<{ total: number; new: number }> {
  const r = toPrismaRange(range);
  const [total, fresh] = await Promise.all([
    prisma.guest.count({ where: { resortId } }),
    prisma.guest.count({ where: { resortId, createdAt: { gte: r.gte, lt: r.lt } } }),
  ]);
  return { total, new: fresh };
}
