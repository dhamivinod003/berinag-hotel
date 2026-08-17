"use client";

import { useEffect, useState } from "react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { PriceBreakdown } from "@/components/ui/PriceBreakdown";
import Link from "next/link";
import { Check, Download, MessageCircle, ArrowRight, MapPin, Clock, AlertCircle } from "lucide-react";
import { lookupReservation, ApiError } from "@/lib/api";
import { resort } from "@/lib/mock-data";
import { whatsappHref } from "@/lib/whatsapp";
import { formatDateShort } from "@/lib/format";
import type { ReservationDto } from "@/lib/types";

export default function ConfirmationPage() {
  // Read the booking reference + phone from the URL (?ref=...&phone=...).
  // The phone is passed through from the booking details page so the lookup
  // can verify against the same number the backend stored.
  const sp = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const ref = sp?.get("ref") || "";
  const phone = sp?.get("phone") || "";

  const [reservation, setReservation] = useState<ReservationDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ref) {
      setError("No booking reference provided.");
      setLoading(false);
      return;
    }
    if (!phone) {
      setError("Phone number missing — open this page from your booking confirmation link.");
      setLoading(false);
      return;
    }
    lookupReservation({ bookingReference: ref, phone })
      .then(setReservation)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load booking."))
      .finally(() => setLoading(false));
  }, [ref, phone]);

  if (loading) {
    return (
      <section className="relative overflow-hidden bg-cream-50 pb-20 pt-24 sm:pt-28">
        <Container className="relative">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto h-16 w-16 skeleton rounded-pill" />
            <div className="mx-auto mt-8 skeleton h-10 w-2/3" />
            <div className="mx-auto mt-4 skeleton h-6 w-1/2" />
          </div>
        </Container>
      </section>
    );
  }

  if (error || !reservation) {
    return (
      <section className="relative overflow-hidden bg-cream-50 pb-20 pt-24 sm:pt-28">
        <Container className="relative">
          <div className="mx-auto max-w-2xl rounded-3xl border border-border-soft bg-card p-8 text-center shadow-soft">
            <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-pill bg-red-50 text-red-600">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h1 className="mt-6 font-display text-3xl text-ink">We couldn't find that booking</h1>
            <p className="mt-2 text-sm text-ink-muted">
              {error ?? "Double-check the booking reference in your email."}
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/contact">
                <Button size="lg" variant="outline">Contact us</Button>
              </Link>
            </div>
          </div>
        </Container>
      </section>
    );
  }

  const nights = reservation.nights;

  return (
    <section className="relative overflow-hidden bg-cream-50 pb-20 pt-24 sm:pt-28">
      <div className="pointer-events-none absolute inset-x-0 -top-40 h-80 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(45,95,63,0.1),transparent_70%)]" />

      <Container className="relative">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto inline-flex h-20 w-20 items-center justify-center rounded-pill bg-forest-800 text-white shadow-lift animate-scale-in">
            <Check className="h-9 w-9" strokeWidth={2.5} />
          </div>
          <h1 className="mt-8 font-display text-4xl font-light leading-[1.05] text-ink sm:text-5xl text-balance">
            Booking Confirmed 🎉
          </h1>
          <p className="mt-4 text-base text-ink-muted sm:text-lg">
            We can't wait to host you. A confirmation has been sent to your email and WhatsApp.
          </p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-pill border border-border-soft bg-card px-4 py-2 text-sm">
            <span className="text-ink-muted">Booking ID</span>
            <span className="font-mono font-semibold text-forest-800">#{reservation.bookingReference}</span>
          </p>
        </div>

        <div className="glass mx-auto mt-12 max-w-3xl rounded-3xl p-6 sm:p-8">
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <Detail label="Guest" value={reservation.guest?.fullName ?? "—"} />
            <Detail label="Room" value={reservation.roomType?.name ?? "—"} />
            <Detail
              label="Dates"
              value={`${formatDateShort(reservation.checkIn)} → ${formatDateShort(reservation.checkOut)}`}
            />
            <Detail
              label="Stay"
              value={`${nights} ${nights === 1 ? "night" : "nights"}, ${reservation.adults} guests`}
            />
            <Detail
              label="Check-in"
              value={`${formatDateShort(reservation.checkIn)} · ${resort.checkInTime}`}
            />
            <Detail
              label="Check-out"
              value={`${formatDateShort(reservation.checkOut)} · ${resort.checkOutTime}`}
            />
            <Detail
              label="Status"
              value={
                reservation.status === "CONFIRMED" && reservation.amountDue <= 0
                  ? "Paid · Confirmed"
                  : reservation.status === "CONFIRMED"
                  ? "Confirmed"
                  : reservation.status
              }
              badge={reservation.status === "CONFIRMED" && reservation.amountDue <= 0 ? "green" : "amber"}
            />
          </dl>

          <div className="mt-8">
            <PriceBreakdown
              nightlyRate={reservation.nightlyRate}
              nights={reservation.nights}
              roomCount={reservation.roomCount}
              subtotal={reservation.subtotal}
              discount={reservation.discount}
              taxAmount={reservation.taxAmount}
              totalAmount={reservation.totalAmount}
              amountPaid={reservation.amountPaid}
              amountDue={reservation.amountDue}
              roomLabel={reservation.roomType?.name}
              offerLabel={reservation.promoCode ?? undefined}
            />
          </div>

          <div className="mt-8 grid gap-3 border-t border-border-soft pt-6 sm:grid-cols-2">
            <div className="rounded-2xl bg-cream-50 p-4 text-sm">
              <div className="flex items-center gap-2 text-ink">
                <MapPin className="h-4 w-4 text-forest-800" />
                {resort.name}
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                {resort.address}, {resort.city}
              </p>
            </div>
            <div className="rounded-2xl bg-cream-50 p-4 text-sm">
              <div className="flex items-center gap-2 text-ink">
                <Clock className="h-4 w-4 text-forest-800" />
                Reception
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                Open 24/7 · {resort.phone}
              </p>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-10 flex max-w-3xl flex-col items-stretch justify-center gap-3 sm:flex-row">
          <Link href={`/booking/${reservation.id}`}>
            <Button variant="primary" size="lg" className="gap-2 w-full">
              View Booking
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Button variant="outline" size="lg" className="gap-2">
            <Download className="h-4 w-4" />
            Download Confirmation
          </Button>
          <a
            href={whatsappHref()}
            target="_blank"
            rel="noopener noreferrer"
            className="pill border border-forest-800/20 bg-card text-forest-800 hover:bg-forest-50 gap-2"
          >
            <MessageCircle className="h-4 w-4" />
            Chat with Resort
          </a>
        </div>

        <p className="mt-10 text-center text-sm text-ink-muted">
          Need to make a change?{" "}
          <Link href="/contact" className="font-medium text-forest-800 underline">Contact us</Link>{" "}
          or use the booking lookup on the home page.
        </p>
      </Container>
    </section>
  );
}

function Detail({ label, value, mono, badge }: { label: string; value: string; mono?: boolean; badge?: "green" | "amber" }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-ink-muted">{label}</dt>
      <dd className={mono ? "mt-1.5 font-mono text-base font-semibold text-ink" : "mt-1.5 text-base font-semibold text-ink"}>
        {badge === "green" ? (
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-forest-50 px-3 py-1 text-sm font-semibold text-forest-800">
            <span className="h-1.5 w-1.5 rounded-pill bg-forest-800" />
            {value}
          </span>
        ) : badge === "amber" ? (
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-sun-50 px-3 py-1 text-sm font-semibold text-sun-600">
            <span className="h-1.5 w-1.5 rounded-pill bg-sun-500" />
            {value}
          </span>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
