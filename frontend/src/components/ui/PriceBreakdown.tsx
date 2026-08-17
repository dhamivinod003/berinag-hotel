"use client";

import { Sparkles, Receipt, Tag } from "lucide-react";
import { formatINR } from "@/lib/format";

/**
 * Price breakdown for a booking.
 *
 * Accepts the same fields the backend returns on a Reservation payload
 * (nightlyRate, nights, roomCount, subtotal, discount, taxAmount, totalAmount,
 * amountPaid, amountDue, currency) and renders a clean line-by-line receipt:
 *
 *   Room rate (× nights × rooms) = Subtotal
 *   - Discount (offer / promo)   = After discount
 *   + GST (12%)                  = Total
 *   - Already paid               = Balance due
 *
 * All amounts are integer paise from the server; we divide by 100 for display.
 * `variant="compact"` hides the meta and shows just the bottom line.
 */

export interface PriceBreakdownProps {
  nightlyRate: number; // paise per room per night
  nights: number;
  roomCount: number;
  subtotal: number;
  discount: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  currency?: string; // "INR" — currently ignored for formatting, always ₹
  // Optional labels
  roomLabel?: string; // e.g. "Deluxe Room"
  offerLabel?: string; // e.g. "Early Bird 20% off"
  variant?: "full" | "compact";
}

export function PriceBreakdown(props: PriceBreakdownProps) {
  const {
    nightlyRate,
    nights,
    roomCount,
    subtotal,
    discount,
    taxAmount,
    totalAmount,
    amountPaid,
    amountDue,
    currency = "INR",
    roomLabel,
    offerLabel,
    variant = "full",
  } = props;

  const afterDiscount = subtotal - discount;
  const taxRate = subtotal > 0 ? taxAmount / subtotal : 0.12;
  const taxPct = `${(taxRate * 100).toFixed(0)}%`;
  const isFullyPaid = amountDue <= 0;
  const isPartial = amountPaid > 0 && !isFullyPaid;

  if (variant === "compact") {
    return (
      <div className="space-y-2 text-sm">
        <div className="flex items-baseline justify-between">
          <span className="text-ink-muted">Total</span>
          <span className="font-mono text-base font-semibold text-ink">
            {formatINR(totalAmount)}
          </span>
        </div>
        {isPartial && (
          <div className="flex items-baseline justify-between text-forest-700">
            <span>Paid so far</span>
            <span className="font-mono">− {formatINR(amountPaid)}</span>
          </div>
        )}
        <div className="flex items-baseline justify-between border-t border-border-soft pt-2">
          <span className="font-medium text-ink">Balance due</span>
          <span className="font-mono text-lg font-semibold text-forest-800">
            {formatINR(amountDue)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border-soft bg-card p-5 shadow-soft sm:p-6">
      <div className="mb-4 flex items-center gap-2 text-ink">
        <Receipt className="h-4 w-4 text-forest-800" />
        <h3 className="font-display text-base text-ink">Price breakdown</h3>
        <span className="ml-auto text-xs text-ink-muted">{currency}</span>
      </div>

      <dl className="space-y-2.5 text-sm">
        <Row
          label={
            roomLabel
              ? `${roomLabel} · ${formatINR(nightlyRate)} × ${nights} night${nights === 1 ? "" : "s"}${roomCount > 1 ? ` × ${roomCount} rooms` : ""}`
              : `Room rate · ${formatINR(nightlyRate)} × ${nights} night${nights === 1 ? "" : "s"}${roomCount > 1 ? ` × ${roomCount} rooms` : ""}`
          }
          value={formatINR(subtotal)}
        />

        {discount > 0 && (
          <Row
            label={offerLabel ? `Discount · ${offerLabel}` : "Discount"}
            value={`− ${formatINR(discount)}`}
            tone="positive"
            icon={<Tag className="h-3.5 w-3.5" />}
          />
        )}

        {afterDiscount !== subtotal && (
          <Row
            label="Subtotal after discount"
            value={formatINR(afterDiscount)}
            subtle
          />
        )}

        <Row
          label={`GST / taxes (${taxPct})`}
          value={`+ ${formatINR(taxAmount)}`}
        />
      </dl>

      <div className="my-3 border-t border-border-soft" />

      <div className="flex items-baseline justify-between">
        <dt className="text-base font-medium text-ink">Total</dt>
        <dd className="font-mono text-xl font-semibold text-ink">
          {formatINR(totalAmount)}
        </dd>
      </div>

      {amountPaid > 0 && (
        <>
          <div className="my-3 border-t border-border-soft" />
          <div className="flex items-baseline justify-between text-sm">
            <dt className="text-ink-muted">Already paid</dt>
            <dd className="font-mono text-forest-700">− {formatINR(amountPaid)}</dd>
          </div>
        </>
      )}

      <div
        className={
          isFullyPaid
            ? "mt-4 flex items-center gap-2 rounded-xl border border-forest-200 bg-forest-50 p-3 text-sm text-forest-900"
            : "mt-4 flex items-baseline justify-between rounded-xl border border-forest-200 bg-forest-50 p-3"
        }
      >
        {isFullyPaid ? (
          <>
            <Sparkles className="h-4 w-4 text-forest-800" />
            <span className="font-medium">Fully paid — no balance due</span>
          </>
        ) : (
          <>
            <dt className="text-sm font-medium text-forest-900">Balance due</dt>
            <dd className="font-mono text-2xl font-semibold text-forest-800">
              {formatINR(amountDue)}
            </dd>
          </>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
  subtle,
  icon,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
  subtle?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt
        className={
          subtle
            ? "text-xs italic text-ink-muted"
            : tone === "positive"
            ? "inline-flex items-center gap-1.5 text-forest-700"
            : "text-ink-muted"
        }
      >
        {icon}
        {label}
      </dt>
      <dd
        className={
          tone === "positive"
            ? "font-mono text-forest-700"
            : subtle
            ? "font-mono text-xs italic text-ink-muted"
            : "font-mono text-ink"
        }
      >
        {value}
      </dd>
    </div>
  );
}
