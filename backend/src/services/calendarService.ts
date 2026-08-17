// Calendar service — returns reservation + room assignment data shaped
// for the admin calendar view. Half-open date math [checkIn, checkOut) so
// check-out day is not counted as occupied.

import { prisma } from "../config/database.js";

export interface CalendarBlock {
  reservationId: string;
  bookingReference: string;
  guestName: string;
  guestPhone: string;
  status: string;
  source: string;
  checkIn: Date;
  checkOut: Date;
  adults: number;
  children: number;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  roomTypeId: string;
  roomTypeName: string;
  roomId: string | null;       // physical room currently assigned
  roomNumber: string | null;   // denormalized for display
  roomTypeColor: string;       // for the calendar block
}

export interface CalendarView {
  range: { from: Date; to: Date };
  rooms: Array<{
    id: string;
    roomNumber: string;
    roomTypeId: string;
    roomTypeName: string;
    status: string;
  }>;
  blocks: CalendarBlock[];
}

const ROOM_TYPE_COLORS = [
  "#2D5F3F", // forest
  "#E8895C", // sun
  "#0EA5E9", // wave
  "#9A9A95", // cream
  "#B85B3A", // sun-dark
  "#36573F", // forest-dark
];

export async function getCalendarView(
  resortId: string,
  from: Date,
  to: Date
): Promise<CalendarView> {
  // 1. All physical rooms in this resort, ordered by room type then number.
  const rooms = await prisma.room.findMany({
    where: { resortId, isActive: true },
    include: { roomType: { select: { id: true, name: true, displayOrder: true } } },
    orderBy: [{ roomType: { displayOrder: "asc" } }, { roomNumber: "asc" }],
  });
  // 2. Room types for color assignment
  const rts = await prisma.roomType.findMany({
    where: { resortId, deletedAt: null },
    orderBy: { displayOrder: "asc" },
    select: { id: true, name: true },
  });
  const colorByType = new Map<string, string>();
  rts.forEach((rt, i) => colorByType.set(rt.id, ROOM_TYPE_COLORS[i % ROOM_TYPE_COLORS.length]));

  // 3. Reservations overlapping [from, to+1 day)
  const endExclusive = new Date(to.getTime() + 86400_000);
  const reservations = await prisma.reservation.findMany({
    where: {
      resortId,
      status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "HELD"] },
      checkIn: { lt: endExclusive },
      checkOut: { gt: from },
    },
    include: {
      guest: { select: { fullName: true, phone: true } },
      roomType: { select: { id: true, name: true } },
      assignments: {
        where: { releasedAt: null },
        include: { room: { select: { id: true, roomNumber: true } } },
        orderBy: { assignedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { checkIn: "asc" },
  });

  const blocks: CalendarBlock[] = reservations.map((r) => {
    const a = r.assignments[0];
    return {
      reservationId: r.id,
      bookingReference: r.bookingReference,
      guestName: r.guest.fullName,
      guestPhone: r.guest.phone,
      status: r.status,
      source: r.source,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      adults: r.adults,
      children: r.children,
      totalAmount: r.totalAmount,
      amountPaid: r.amountPaid,
      amountDue: r.amountDue,
      roomTypeId: r.roomType.id,
      roomTypeName: r.roomType.name,
      roomId: a?.roomId ?? null,
      roomNumber: a?.room.roomNumber ?? null,
      roomTypeColor: colorByType.get(r.roomType.id) ?? "#6B6B6B",
    };
  });

  return {
    range: { from, to },
    rooms: rooms.map((r) => ({
      id: r.id,
      roomNumber: r.roomNumber,
      roomTypeId: r.roomTypeId,
      roomTypeName: r.roomType.name,
      status: r.status,
    })),
    blocks,
  };
}
