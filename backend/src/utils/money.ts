// Money helpers. All amounts in the system are integer paise.
// Never use floats for money.

export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function toRupees(paise: number): number {
  return paise / 100;
}

export function formatINR(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export function applyPercent(value: number, basisPoints: number): number {
  // basisPoints: 1500 = 15%
  return Math.round((value * basisPoints) / 10000);
}
