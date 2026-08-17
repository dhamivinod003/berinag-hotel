// Availability engine. Two questions:
//   1. How many of room type X are available for [checkIn, checkOut)?
//   2. Can a specific physical room be assigned for [checkIn, checkOut)?
//
// Half-open date ranges. Counts reservations in HELD/PENDING/CONFIRMED/CHECKED_IN.
// Excludes OUT_OF_ORDER rooms. Active maintenance covers the range → excluded.

import { prisma } from "../config/database.js";
import { toDateOnly } from "../utils/dates.js";

export interface RoomTypeAvailability {
  id: string;
  slug: string;
  name: string;
  shortDesc: string | null;
  description: string | null;
  maxAdults: number;
  maxChildren: number;
  bedConfiguration: string | null;
  areaSqft: number | null;
  view: string | null;
  basePrice: number;
  totalUnits: number;
  coverImage: string | null;
  galleryImages: string[];
  amenities: string[];
  available: number;
  soldOut: boolean;
  nightlyRate: number;
  totalForStay: number;
}

export interface AvailabilityResult {
  stay: { checkIn: string; checkOut: string; nights: number };
  roomTypes: RoomTypeAvailability[];
}

export async function getAvailability(opts: {
  resortId: string;
  checkIn: Date | string;
  checkOut: Date | string;
  adults?: number;
  children?: number;
  rooms?: number;
}): Promise<AvailabilityResult> {
  const ci = toDateOnly(opts.checkIn);
  const co = toDateOnly(opts.checkOut);
  const nights = Math.max(
    1,
    Math.round((co.getTime() - ci.getTime()) / (1000 * 60 * 60 * 24))
  );

  const roomTypes = await prisma.roomType.findMany({
    where: {
      resortId: opts.resortId,
      status: "ACTIVE",
      deletedAt: null,
    },
    include: {
      photos: { where: { isCover: true }, take: 1 },
      amenities: { include: { amenity: true } },
    },
    orderBy: { displayOrder: "asc" },
  });

  // Count overlapping reservations + holds per room type.
  // Statuses that consume inventory:
  // HELD, PENDING, PENDING_PAYMENT, CONFIRMED, CHECKED_IN.
  const blockingStatuses = ["HELD", "PENDING", "PENDING_PAYMENT", "CONFIRMED", "CHECKED_IN"];

  const roomTypeIds = roomTypes.map((rt) => rt.id);

  // Reservation counts (CONFIRMED/CHECKED_IN/PENDING + HELD).
  const reservationGroups = await prisma.reservation.groupBy({
    by: ["roomTypeId"],
    where: {
      resortId: opts.resortId,
      roomTypeId: { in: roomTypeIds },
      status: { in: blockingStatuses },
      checkIn: { lt: co },
      checkOut: { gt: ci },
    },
    _sum: { roomCount: true },
  });
  const reservedByType = new Map<string, number>();
  for (const g of reservationGroups) {
    reservedByType.set(g.roomTypeId, g._sum.roomCount ?? 0);
  }

  // OOO rooms by type.
  const oooRooms = await prisma.room.findMany({
    where: {
      resortId: opts.resortId,
      roomTypeId: { in: roomTypeIds },
      isActive: true,
      status: "OUT_OF_ORDER",
    },
    select: { roomTypeId: true },
  });
  const oooByType = new Map<string, number>();
  for (const r of oooRooms) {
    oooByType.set(r.roomTypeId, (oooByType.get(r.roomTypeId) ?? 0) + 1);
  }

  // Active maintenance that covers any night in the range.
  const maintenance = await prisma.maintenanceRecord.findMany({
    where: {
      room: { resortId: opts.resortId, roomTypeId: { in: roomTypeIds } },
      status: { in: ["OPEN", "IN_PROGRESS"] },
      resolvedAt: null,
    },
    include: { room: { select: { roomTypeId: true } } },
  });
  const maintByType = new Map<string, number>();
  for (const m of maintenance) {
    if (!m.startedAt) continue;
    const opened = toDateOnly(m.startedAt);
    const ready = m.expectedReadyAt ? toDateOnly(m.expectedReadyAt) : null;
    if (ready && ready.getTime() <= ci.getTime()) continue; // ready before check-in
    if (opened.getTime() >= co.getTime()) continue; // opens after check-out
    const k = m.room.roomTypeId;
    maintByType.set(k, (maintByType.get(k) ?? 0) + 1);
  }

  const adults = opts.adults ?? 2;
  const children = opts.children ?? 0;
  const requested = (opts.rooms ?? 1) * 1;
  void adults; void children; void requested;

  const result: RoomTypeAvailability[] = roomTypes.map((rt) => {
    const reserved = reservedByType.get(rt.id) ?? 0;
    const ooo = oooByType.get(rt.id) ?? 0;
    const maint = maintByType.get(rt.id) ?? 0;
    const available = Math.max(0, rt.totalUnits - reserved - ooo - maint);
    const cover = rt.photos[0]?.url ?? null;
    return {
      id: rt.id,
      slug: rt.slug,
      name: rt.name,
      shortDesc: rt.shortDesc,
      description: rt.description,
      maxAdults: rt.maxAdults,
      maxChildren: rt.maxChildren,
      bedConfiguration: rt.bedConfiguration,
      areaSqft: rt.areaSqft,
      view: rt.view,
      basePrice: rt.basePrice,
      totalUnits: rt.totalUnits,
      coverImage: cover,
      galleryImages: [],
      amenities: rt.amenities.map((a) => a.amenity.key),
      available,
      soldOut: available === 0,
      nightlyRate: rt.basePrice,
      totalForStay: rt.basePrice * nights,
    };
  });

  return {
    stay: {
      checkIn: ci.toISOString().slice(0, 10),
      checkOut: co.toISOString().slice(0, 10),
      nights,
    },
    roomTypes: result,
  };
}

export async function isPhysicalRoomAvailable(opts: {
  resortId: string;
  roomId: string;
  checkIn: Date | string;
  checkOut: Date | string;
  excludeReservationId?: string;
}): Promise<boolean> {
  const ci = toDateOnly(opts.checkIn);
  const co = toDateOnly(opts.checkOut);

  const room = await prisma.room.findFirst({
    where: { id: opts.roomId, resortId: opts.resortId, isActive: true },
  });
  if (!room) return false;
  if (room.status === "OUT_OF_ORDER" || room.status === "MAINTENANCE") return false;

  // Active maintenance that covers any night in the range.
  const activeMaint = await prisma.maintenanceRecord.findFirst({
    where: {
      roomId: room.id,
      status: { in: ["OPEN", "IN_PROGRESS"] },
      resolvedAt: null,
    },
  });
  if (activeMaint) {
    const opened = activeMaint.startedAt;
    const ready = activeMaint.expectedReadyAt;
    if (opened && opened.getTime() < co.getTime()) {
      if (!ready || ready.getTime() > ci.getTime()) return false;
    }
  }

  // Overlapping assignment to a confirmed/checked-in reservation.
  const conflict = await prisma.roomAssignment.findFirst({
    where: {
      roomId: room.id,
      releasedAt: null,
      reservation: {
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
        checkIn: { lt: co },
        checkOut: { gt: ci },
        ...(opts.excludeReservationId
          ? { id: { not: opts.excludeReservationId } }
          : {}),
      },
    },
  });
  return !conflict;
}
