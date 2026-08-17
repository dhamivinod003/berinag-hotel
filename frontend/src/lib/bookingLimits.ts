/** Public booking UI caps. Backend still enforces inventory and stay rules. */
export const MAX_GUESTS_PER_BOOKING = 20;
export const MAX_ROOMS_PER_BOOKING = 10;

export function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

export function rangeOptions(max: number): number[] {
  return Array.from({ length: Math.max(1, max) }, (_, i) => i + 1);
}

export function maxGuestsForRoom(
  room: { maxAdults: number; maxChildren?: number | null; maxOccupancy?: number | null },
  rooms: number
): number {
  const perRoom =
    room.maxOccupancy ?? room.maxAdults + (room.maxChildren ?? 0);
  return Math.min(
    MAX_GUESTS_PER_BOOKING,
    Math.max(1, perRoom * Math.max(1, rooms))
  );
}

export function maxRoomsForType(room: { totalUnits: number }): number {
  return Math.min(MAX_ROOMS_PER_BOOKING, Math.max(1, room.totalUnits));
}
