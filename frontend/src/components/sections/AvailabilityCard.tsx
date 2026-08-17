"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Calendar, Users, BedDouble, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { todayPlusDays, nightsBetween } from "@/lib/format";
import {
  MAX_GUESTS_PER_BOOKING,
  MAX_ROOMS_PER_BOOKING,
  clampInt,
  rangeOptions,
} from "@/lib/bookingLimits";

interface AvailabilityCardProps {
  variant?: "glass" | "solid";
  defaultCheckIn?: string;
  defaultCheckOut?: string;
}

export function AvailabilityCard({
  variant = "glass",
  defaultCheckIn,
  defaultCheckOut,
}: AvailabilityCardProps) {
  const router = useRouter();
  const [checkIn, setCheckIn] = useState(
    defaultCheckIn ?? todayPlusDays(3)
  );
  const [checkOut, setCheckOut] = useState(
    defaultCheckOut ?? todayPlusDays(6)
  );
  const [guests, setGuests] = useState(2);
  const [rooms, setRooms] = useState(1);
  const guestChoices = rangeOptions(MAX_GUESTS_PER_BOOKING);
  const roomChoices = rangeOptions(MAX_ROOMS_PER_BOOKING);

  const nights = useMemo(
    () => nightsBetween(checkIn, checkOut),
    [checkIn, checkOut]
  );

  const valid = useMemo(() => {
    if (!checkIn || !checkOut) return false;
    if (new Date(checkOut) <= new Date(checkIn)) return false;
    if (new Date(checkIn) < new Date(todayPlusDays(0))) return false;
    if (guests < 1 || guests > MAX_GUESTS_PER_BOOKING) return false;
    if (rooms < 1 || rooms > MAX_ROOMS_PER_BOOKING) return false;
    return true;
  }, [checkIn, checkOut, guests, rooms]);

  const handleCheck = () => {
    if (!valid) return;
    const q = new URLSearchParams({
      checkIn,
      checkOut,
      adults: String(guests),
      rooms: String(rooms),
    });
    router.push(`/booking?${q.toString()}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={
        variant === "glass"
          ? "glass rounded-3xl p-5 sm:p-6 liquid-sheen"
          : "rounded-3xl border border-border-soft bg-card p-5 shadow-lift sm:p-6"
      }
    >
      {variant === "glass" && (
        <span className="liquid-sheen-track" aria-hidden="true" />
      )}
      <div className="mb-4 flex items-center gap-2">
        <Calendar
          className={
            variant === "glass"
              ? "h-4 w-4 text-forest-800"
              : "h-4 w-4 text-forest-800"
          }
        />
        <h3
          className={
            variant === "glass"
              ? "text-sm font-semibold uppercase tracking-[0.18em] text-forest-800"
              : "text-sm font-semibold uppercase tracking-[0.18em] text-forest-800"
          }
        >
          Check Availability
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field
          label="Check-in"
          variant={variant}
          input={
            <input
              type="date"
              value={checkIn}
              min={todayPlusDays(0)}
              onChange={(e) => {
                setCheckIn(e.target.value);
                if (e.target.value >= checkOut) {
                  const d = new Date(e.target.value);
                  d.setDate(d.getDate() + 1);
                  setCheckOut(d.toISOString().slice(0, 10));
                }
              }}
              className={inputClass(variant)}
            />
          }
        />
        <Field
          label="Check-out"
          variant={variant}
          input={
            <input
              type="date"
              value={checkOut}
              min={checkIn || todayPlusDays(1)}
              onChange={(e) => setCheckOut(e.target.value)}
              className={inputClass(variant)}
            />
          }
        />
        <Field
          label="Guests"
          variant={variant}
          input={
            <div className="relative">
              <Users
                className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${
                  variant === "glass" ? "text-ink-muted" : "text-ink-muted"
                }`}
              />
              <select
                value={guests}
                onChange={(e) =>
                  setGuests(
                    clampInt(parseInt(e.target.value, 10), 1, MAX_GUESTS_PER_BOOKING)
                  )
                }
                className={`${inputClass(variant)} appearance-none pl-9`}
              >
                {guestChoices.map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "Guest" : "Guests"}
                  </option>
                ))}
              </select>
            </div>
          }
        />
        <Field
          label="Rooms"
          variant={variant}
          input={
            <div className="relative">
              <BedDouble
                className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${
                  variant === "glass" ? "text-ink-muted" : "text-ink-muted"
                }`}
              />
              <select
                value={rooms}
                onChange={(e) =>
                  setRooms(
                    clampInt(parseInt(e.target.value, 10), 1, MAX_ROOMS_PER_BOOKING)
                  )
                }
                className={`${inputClass(variant)} appearance-none pl-9`}
              >
                {roomChoices.map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "Room" : "Rooms"}
                  </option>
                ))}
              </select>
            </div>
          }
        />
      </div>

      <div className="mt-5 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p
          className={`text-sm ${
            variant === "glass" ? "text-ink/80" : "text-ink-muted"
          }`}
        >
          {valid ? (
            <>
              <span className="font-semibold text-forest-800">{nights}</span>{" "}
              {nights === 1 ? "night" : "nights"} · {guests}{" "}
              {guests === 1 ? "guest" : "guests"} · {rooms}{" "}
              {rooms === 1 ? "room" : "rooms"}
            </>
          ) : (
            "Pick a check-out after your check-in."
          )}
        </p>
        <Button
          variant="primary"
          size="lg"
          className="gap-2 sm:min-w-[200px]"
          disabled={!valid}
          onClick={handleCheck}
        >
          <Search className="h-4 w-4" />
          Check Availability
        </Button>
      </div>
    </motion.div>
  );
}

function Field({
  label,
  input,
  variant,
}: {
  label: string;
  input: React.ReactNode;
  variant: "glass" | "solid";
}) {
  return (
    <label className="block">
      <span
        className={`mb-1.5 block text-xs font-medium uppercase tracking-wider ${
          variant === "glass" ? "text-ink/70" : "text-ink-muted"
        }`}
      >
        {label}
      </span>
      {input}
    </label>
  );
}

function inputClass(variant: "glass" | "solid"): string {
  const base =
    "w-full rounded-2xl px-3.5 py-3 text-base outline-none transition-all";
  if (variant === "glass") {
    return `${base} theme-field border-white/25`;
  }
  return `${base} theme-field`;
}
