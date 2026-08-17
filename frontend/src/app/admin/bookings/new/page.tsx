"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, AlertCircle } from "lucide-react";
import { createBooking, createHold, getRoomTypes, ApiError } from "@/lib/api";
import { formatINR, nightsBetween, todayPlusDays } from "@/lib/format";
import type { RoomType } from "@/lib/types";

export default function NewBookingPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [roomTypeId, setRoomTypeId] = useState("");
  const [checkIn, setCheckIn] = useState(todayPlusDays(0));
  const [checkOut, setCheckOut] = useState(todayPlusDays(1));
  const [roomCount, setRoomCount] = useState(1);
  const [adults, setAdults] = useState(2);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    getRoomTypes()
      .then((list) => {
        setRooms(list);
        if (list[0]) setRoomTypeId(list[0].id);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Could not load rooms");
      });
  }, []);

  const selected = rooms.find((r) => r.id === roomTypeId) ?? null;
  const nights = useMemo(() => nightsBetween(checkIn, checkOut), [checkIn, checkOut]);
  const estimate = selected ? selected.basePrice * nights * roomCount : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!roomTypeId) return;
    setError(null);
    setSubmitting(true);
    try {
      const hold = await createHold({
        roomTypeId,
        checkIn,
        checkOut,
        rooms: roomCount,
      });
      const reservation = await createBooking({
        holdId: hold.holdId,
        guest: { fullName, phone, countryCode: "+91", email: email || undefined },
        adults,
      });
      router.push(`/admin/bookings/${reservation.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Booking failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="font-display text-3xl text-ink">New booking</p>
        <p className="mt-1 text-sm text-ink-muted">
          Walk-in or phone booking. It is counted on the dashboard immediately.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-3xl border border-border-soft bg-card p-6 shadow-soft">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-muted">Room type</span>
          <select className="field" value={roomTypeId} onChange={(e) => setRoomTypeId(e.target.value)} required>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} · {formatINR(r.basePrice)} / night
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-muted">Check-in</span>
            <input type="date" className="field" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} required />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-muted">Check-out</span>
            <input type="date" className="field" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} required />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-muted">Rooms</span>
            <input
              type="number"
              min={1}
              max={10}
              className="field"
              value={roomCount}
              onChange={(e) => setRoomCount(Number(e.target.value) || 1)}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-muted">Guests</span>
            <input
              type="number"
              min={1}
              max={12}
              className="field"
              value={adults}
              onChange={(e) => setAdults(Number(e.target.value) || 1)}
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-muted">Guest name</span>
            <input className="field" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-muted">Phone</span>
            <input className="field" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-muted">Email</span>
            <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
        </div>

        <div className="rounded-2xl bg-cream-50 px-4 py-3 text-sm text-ink">
          {nights} {nights === 1 ? "night" : "nights"} · estimated {formatINR(estimate)}
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-pill bg-forest-800 px-5 py-3 text-sm font-medium text-white hover:bg-forest-700 disabled:opacity-60"
        >
          {submitting ? "Creating booking…" : "Create booking"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
