// INR currency formatter — takes integer paise.
export function formatINR(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

// Compact "from ₹X" for cards.
export function formatFromINR(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const ci = new Date(checkIn);
  const co = new Date(checkOut);
  return Math.max(
    1,
    Math.round((co.getTime() - ci.getTime()) / (1000 * 60 * 60 * 24))
  );
}

export function todayPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
