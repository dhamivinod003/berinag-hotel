// Date helpers. All comparisons use UTC half-open [start, end) semantics
// matching the availability engine in the spec.

export function toDateOnly(d: Date | string): Date {
  const x = typeof d === "string" ? new Date(d) : d;
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
}

export function nightsBetween(checkIn: Date | string, checkOut: Date | string): number {
  const ci = toDateOnly(checkIn).getTime();
  const co = toDateOnly(checkOut).getTime();
  return Math.max(1, Math.round((co - ci) / (1000 * 60 * 60 * 24)));
}

export function eachNight(checkIn: Date | string, checkOut: Date | string): Date[] {
  const nights = nightsBetween(checkIn, checkOut);
  const start = toDateOnly(checkIn);
  return Array.from({ length: nights }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    return d;
  });
}

export function isFuture(d: Date | string): boolean {
  return toDateOnly(d).getTime() >= toDateOnly(new Date()).getTime();
}

export function dayOfWeek(d: Date | string): number {
  // 0 = Sunday ... 6 = Saturday
  return toDateOnly(d).getUTCDay();
}

export function addMinutes(d: Date, mins: number): Date {
  return new Date(d.getTime() + mins * 60_000);
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}
