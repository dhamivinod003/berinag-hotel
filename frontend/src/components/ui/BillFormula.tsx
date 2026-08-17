"use client";

import { Calculator, Info } from "lucide-react";
import { formatINR } from "@/lib/format";

/**
 * Visible bill formula for the payment page.
 *
 * Walks the guest through exactly how the balance due is derived from the
 * nightly rate. Each line is computed from the numbers above it, so the
 * guest can verify the math by following the chain.
 *
 *   (nightly rate × nights × rooms) − discount  →  after-discount subtotal
 *   after-discount × GST%                     →  tax
 *   after-discount + tax                       →  total
 *   total − already paid                        →  balance due
 *
 * All amounts are integer paise on the server. We divide by 100 for display.
 * Compact: shows just the result + a one-line "tap to expand" hint. Full:
 * shows the whole chain.
 */

export interface BillFormulaProps {
  nightlyRate: number; // paise per room per night
  nights: number;
  roomCount: number;
  subtotal: number;
  discount: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  /** Optional labels shown in the formula ("Deluxe Room", "EARLY20"). */
  roomLabel?: string;
  offerLabel?: string;
  /** taxRatePct is read from the relationship subtotal/taxAmount and shown
      alongside the GST line, e.g. "GST (12%)". If the server returns 0% or
      an unexpected ratio, we still display whatever we got. */
  variant?: "full" | "compact";
}

export function BillFormula(props: BillFormulaProps) {
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
    roomLabel,
    offerLabel,
    variant = "full",
  } = props;

  // The server returns integer paise. Tax rate is derived from the
  // after-discount subtotal so the math shown below is exact.
  const afterDiscount = Math.max(0, subtotal - discount);
  const taxRate = afterDiscount > 0 ? taxAmount / afterDiscount : 0;
  const taxPct = `${(taxRate * 100).toFixed(Math.abs(taxRate) >= 0.01 ? 1 : 2)}%`;
  const isFullyPaid = amountDue <= 0;
  const isPartial = amountPaid > 0 && !isFullyPaid;

  // ── Compact: one-line "Total = … · Balance due = …" teaser ──
  if (variant === "compact") {
    return (
      <div className="flex items-center gap-2 text-xs text-ink-muted">
        <Info className="h-3.5 w-3.5 shrink-0" />
        <span>
          Balance due = (₹{formatINR(nightlyRate).replace("₹", "")} × {nights} night{nights === 1 ? "" : "s"} × {roomCount}
          {discount > 0 ? ` − ${formatINR(discount).replace("₹", "₹")}` : ""}) × (1 + {taxPct}) −{" "}
          {formatINR(amountPaid)} = <span className="font-mono font-semibold text-ink">{formatINR(amountDue)}</span>
        </span>
      </div>
    );
  }

  // ── Full: step-by-step formula ──
  return (
    <div
      className="rounded-2xl border border-border-soft bg-card/60 p-5 shadow-soft sm:p-6"
      aria-label="Bill formula"
    >
      <header className="mb-4 flex items-center gap-2 text-ink">
        <Calculator className="h-4 w-4 text-forest-800" />
        <h3 className="font-display text-base text-ink">How we calculate your bill</h3>
      </header>

      {/* Two-column layout: left = expression, right = value (monospace).
          `align-right tabular-nums` makes the numbers line up perfectly. */}
      <div className="space-y-1.5 font-mono text-sm">
        {/* Step 1: room rate × nights × rooms */}
        <Line label={roomLabel ?? "Room rate"} value={formatINR(nightlyRate)} />
        <SubLine label="× nights">
          {nights} night{nights === 1 ? "" : "s"}
        </SubLine>
        <SubLine label="× rooms">
          {roomCount} room{roomCount === 1 ? "" : "s"}
        </SubLine>
        <Divider />
        <Line
          label="Subtotal (rate × nights × rooms)"
          value={formatINR(subtotal)}
          emphasize
        />

        {/* Step 2: discount */}
        {discount > 0 && (
          <>
            <SubLine
              label={`− Discount ${offerLabel ? `· ${offerLabel}` : ""}`}
              tone="positive"
            >
              {formatINR(discount)}
            </SubLine>
            <Divider />
            <Line
              label="After discount"
              value={formatINR(afterDiscount)}
              emphasize
            />
          </>
        )}

        {/* Step 3: tax */}
        <SubLine label={`+ GST (${taxPct})`} tone="muted">
          {formatINR(taxAmount)}
        </SubLine>
        <Divider />
        <Line label="Total" value={formatINR(totalAmount)} emphasize />

        {/* Step 4: already paid */}
        {amountPaid > 0 && (
          <>
            <SubLine label="− Already paid" tone="positive">
              {formatINR(amountPaid)}
            </SubLine>
            <Divider />
          </>
        )}

        {/* Final: balance due — the headline of the formula. */}
        <div
          className={
            isFullyPaid
              ? "mt-3 flex items-center gap-2 rounded-xl border border-forest-200 bg-forest-50 px-4 py-3"
              : "mt-3 flex items-baseline justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
          }
        >
          <dt className="font-display text-base font-semibold text-ink">
            {isFullyPaid ? "Fully paid" : "Balance due"}
          </dt>
          <dd
            className={
              isFullyPaid
                ? "font-mono text-xl font-semibold text-forest-700"
                : "font-mono text-2xl font-semibold text-sun-600"
            }
          >
            {formatINR(amountDue)}
          </dd>
        </div>

        {/* Single-line equation summary, monospaced, so the guest can copy it.
            Note: React does not decode HTML entities inside text children, so we
            use the actual NBSP character ( ) instead of &nbsp; — otherwise the
            formula prints "&nbsp;" literally. */}
        <p className="mt-4 break-words rounded-lg border border-border-soft bg-cream-50 px-3 py-2 text-[12px] text-ink-muted">
          <span className="font-semibold text-ink">Formula:</span>{" "}
          Balance{" "}due{" "}={" "}₹{formatINR(nightlyRate).replace("₹", "")}{" "}×{" "}{nights}{" "}×{" "}{roomCount}
          {discount > 0 ? ` − ${formatINR(discount).replace("₹", "₹")}` : ""}
          {" "}×{" "}(1{" "}+{" "}{taxPct})
          {amountPaid > 0 ? ` − ${formatINR(amountPaid).replace("₹", "₹")}` : ""}
          {" "}={" "}
          <span className="font-semibold text-ink">{formatINR(amountDue)}</span>
          {isPartial && (
            <span className="ml-1 italic">
              {" "}(pay {formatINR(amountDue)} now of {formatINR(totalAmount)} total)
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

/* ── Small presentational helpers, kept local so the file is self-contained. */

function Line({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={emphasize ? "font-semibold text-ink" : "text-ink-muted"}>
        {label}
      </dt>
      <dd
        className={
          emphasize
            ? "font-mono text-base font-semibold tabular-nums text-ink"
            : "font-mono tabular-nums text-ink"
        }
      >
        {value}
      </dd>
    </div>
  );
}

function SubLine({
  label,
  tone = "muted",
  children,
}: {
  label: React.ReactNode;
  tone?: "muted" | "positive" | "negative";
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 pl-4">
      <dt
        className={
          tone === "positive"
            ? "text-forest-700"
            : tone === "negative"
            ? "text-red-600"
            : "text-ink-muted"
        }
      >
        {label}
      </dt>
      <dd
        className={
          tone === "positive"
            ? "font-mono tabular-nums text-forest-700"
            : tone === "negative"
            ? "font-mono tabular-nums text-red-600"
            : "font-mono tabular-nums text-ink"
        }
      >
        {children}
      </dd>
    </div>
  );
}

function Divider() {
  return <div className="my-1.5 h-px w-full bg-border-soft" aria-hidden="true" />;
}
