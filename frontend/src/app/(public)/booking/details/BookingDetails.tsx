"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ShieldCheck, ArrowRight, AlertCircle, Calendar } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getRoomType, createHold, createBooking, ApiError } from "@/lib/api";
import { formatINR, formatDateShort, nightsBetween, todayPlusDays } from "@/lib/format";
import type { RoomType, ReservationDto } from "@/lib/types";
import {
  clampInt,
  maxGuestsForRoom,
  maxRoomsForType,
  rangeOptions,
} from "@/lib/bookingLimits";

export function BookingDetails() {
  const router = useRouter();
  const params = useSearchParams();
  const roomTypeSlug = params.get("roomType") || "deluxe-room";
  const checkIn = params.get("checkIn") || todayPlusDays(3);
  const checkOut = params.get("checkOut") || todayPlusDays(6);
  const adultsParam = parseInt(params.get("adults") || "2", 10);
  const roomsParam = parseInt(params.get("rooms") || "1", 10);

  const [room, setRoom] = useState<RoomType | null>(null);
  const [roomLoading, setRoomLoading] = useState(true);
  const [holdId, setHoldId] = useState<string | null>(null);
  const [holdSecondsLeft, setHoldSecondsLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch the room.
  useEffect(() => {
    let cancelled = false;
    setRoomLoading(true);
    getRoomType(roomTypeSlug)
      .then((r) => !cancelled && setRoom(r))
      .catch(() => !cancelled && setRoom(null))
      .finally(() => !cancelled && setRoomLoading(false));
    return () => { cancelled = true; };
  }, [roomTypeSlug]);

  // Create the hold on mount.
  useEffect(() => {
    if (!room) return;
    let cancelled = false;
    createHold({
      roomTypeId: room.id,
      checkIn,
      checkOut,
      rooms: clampInt(roomsParam, 1, maxRoomsForType(room)),
    })
      .then((h) => {
        if (cancelled) return;
        setHoldId(h.holdId);
        setHoldSecondsLeft(h.secondsLeft);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof ApiError ? e.message : "Failed to create hold.");
      });
    return () => { cancelled = true; };
  }, [room, checkIn, checkOut, roomsParam]);

  // Countdown timer.
  useEffect(() => {
    if (holdSecondsLeft <= 0) return;
    const t = setInterval(() => {
      setHoldSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [holdSecondsLeft > 0]);

  const nights = useMemo(() => nightsBetween(checkIn, checkOut), [checkIn, checkOut]);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  if (roomLoading) {
    return <div className="skeleton h-96" />;
  }
  if (!room) {
    return (
      <div className="rounded-3xl border border-border-soft bg-card p-8 text-center text-ink-muted">
        Room not found.
      </div>
    );
  }

  const rooms = clampInt(roomsParam, 1, maxRoomsForType(room));
  const maxGuests = maxGuestsForRoom(room, rooms);
  const adults = clampInt(adultsParam, 1, maxGuests);
  const subtotal = room.basePrice * nights * rooms;
  const taxes = Math.round(subtotal * 0.12);
  const total = subtotal + taxes;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!holdId) {
      setError("Hold not ready. Please wait a moment.");
      return;
    }
    setError(null);
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    try {
      const guestPhone = String(form.get("phone") || "");
      const result: ReservationDto = await createBooking({
        holdId: holdId!,
        guest: {
          fullName: String(form.get("fullName") || ""),
          phone: guestPhone,
          countryCode: "+91",
          email: String(form.get("email") || "") || undefined,
          address: String(form.get("address") || "") || undefined,
        },
        specialRequests: String(form.get("specialRequests") || "") || undefined,
        arrivalTime: String(form.get("arrivalTime") || "") || undefined,
        adults: clampInt(Number(form.get("guests") || adults) || adults, 1, maxGuests),
      });
      // Pass the phone the guest just used so the confirmation page can
      // verify against the same number the backend stored.
      // If the reservation still has an amountDue, route through the payment
      // page first; otherwise go straight to confirmation.
      if (result.amountDue > 0) {
        router.push(
          `/booking/pay?reservationId=${result.id}&ref=${encodeURIComponent(result.bookingReference)}&phone=${encodeURIComponent(guestPhone)}`
        );
      } else {
        router.push(
          `/booking/confirmation?ref=${encodeURIComponent(result.bookingReference)}&phone=${encodeURIComponent(guestPhone)}`
        );
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Booking failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <form onSubmit={handleSubmit} className="space-y-6 lg:col-span-7">
        <div className="rounded-3xl border border-border-soft bg-card p-6 shadow-soft">
          <h3 className="font-display text-xl text-ink">Your Selection</h3>
          <dl className="mt-5 space-y-3 text-sm">
            <Row label="Room" value={room.name} />
            <Row label="Check-in" value={formatDateShort(checkIn)} />
            <Row label="Check-out" value={formatDateShort(checkOut)} />
            <Row label="Duration" value={`${nights} ${nights === 1 ? "night" : "nights"}`} />
            <Row label="Guests" value={`${adults} ${adults === 1 ? "guest" : "guests"}`} />
            <Row label="Rooms" value={String(rooms)} />
          </dl>
        </div>

        <div className="rounded-3xl border border-border-soft bg-card p-6 shadow-soft">
          <h3 className="font-display text-xl text-ink">Guest information</h3>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required>
              <input required name="fullName" type="text" className="field" placeholder="As on your ID" />
            </Field>
            <Field label="Phone" required>
              <input required name="phone" type="tel" className="field" placeholder="+91 98765 43210" />
            </Field>
            <Field label="Email" full>
              <input name="email" type="email" className="field" placeholder="you@example.com" />
            </Field>
            <Field label="Number of guests" full>
              <select
                name="guests"
                defaultValue={adults}
                className="field"
              >
                {rangeOptions(maxGuests).map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "guest" : "guests"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Expected arrival time" full>
              <input name="arrivalTime" type="time" className="field" defaultValue="14:00" />
            </Field>
            <Field label="Special requests" full>
              <textarea name="specialRequests" rows={3} className="field resize-none" placeholder="A high-floor room, a cake in the room, dietary preferences…" />
            </Field>
          </div>
        </div>

        <div className="rounded-3xl border border-forest-200 bg-forest-50 p-4 text-sm text-forest-900 sm:p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-forest-800" />
            <p>
              {holdId ? (
                <>
                  Your room will be held for{" "}
                  <span className="font-mono font-semibold">{fmt(holdSecondsLeft)}</span>.
                  After that, it'll be released and you'll need to check availability again.
                  We never auto-charge without confirmation.
                </>
              ) : error ? (
                <span className="text-red-700">{error}</span>
              ) : (
                "Reserving your room…"
              )}
            </p>
          </div>
        </div>

        {error && holdId && (
          <div className="flex items-start gap-2 rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          variant="primary"
          className="w-full gap-2"
          isLoading={submitting}
          disabled={!holdId}
        >
          Confirm booking
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>

      <aside className="lg:col-span-5">
        <div className="sticky top-28 space-y-4">
          <div className="rounded-3xl border border-border-soft bg-card p-6 shadow-soft">
            <h3 className="font-display text-xl text-ink">Price summary</h3>
            <dl className="mt-5 space-y-3 text-sm">
              <PriceRow label={`${formatINR(room.basePrice)} × ${nights} ${nights === 1 ? "night" : "nights"}`} value={formatINR(subtotal)} />
              <PriceRow label="Subtotal" value={formatINR(subtotal)} bold />
              <PriceRow label="Taxes & fees (12% GST)" value={formatINR(taxes)} />
              <div className="my-3 border-t border-border-soft" />
              <PriceRow label="Total payable" value={formatINR(total)} large />
            </dl>
            <p className="mt-4 text-xs text-ink-muted">
              Free cancellation up to 7 days before check-in.{" "}
              <a href="/cancellation" className="underline hover:text-ink">Full policy</a>
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}

function PriceRow({ label, value, bold, large }: { label: string; value: string; bold?: boolean; large?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className={bold ? "text-ink" : "text-ink-muted"}>{label}</dt>
      <dd className={large ? "font-display text-2xl font-semibold text-forest-800" : bold ? "font-semibold text-ink" : "text-ink"}>
        {value}
      </dd>
    </div>
  );
}

function Field({ label, required, full, children }: { label: string; required?: boolean; full?: boolean; children: React.ReactNode }) {
  return (
    <label className={full ? "sm:col-span-2 block" : "block"}>
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-muted">
        {label}
        {required && <span className="text-forest-800"> *</span>}
      </span>
      {children}
    </label>
  );
}
