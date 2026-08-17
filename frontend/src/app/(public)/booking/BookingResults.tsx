"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ThemedImage } from "@/components/theme/ThemedImage";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Users, BedDouble, Maximize2, ArrowRight, AlertCircle, Wifi, Snowflake, Tv, Bath, Coffee, Mountain, Check, Calendar } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getAvailability, ApiError } from "@/lib/api";
import { formatINR, formatDateShort, nightsBetween, todayPlusDays } from "@/lib/format";
import type { AvailabilityResult } from "@/lib/types";
import {
  MAX_GUESTS_PER_BOOKING,
  MAX_ROOMS_PER_BOOKING,
  clampInt,
} from "@/lib/bookingLimits";

const AMENITY_ICONS: Record<string, any> = {
  wifi: Wifi,
  ac: Snowflake,
  tv: Tv,
  balcony: Mountain,
  room_service: Coffee,
  hot_water: Bath,
  minibar: Coffee,
  lounge: Coffee,
  fireplace: Bath,
  tub: Bath,
};

export function BookingResults() {
  const router = useRouter();
  const params = useSearchParams();
  const checkIn = params.get("checkIn") || todayPlusDays(3);
  const checkOut = params.get("checkOut") || todayPlusDays(6);
  const adults = clampInt(parseInt(params.get("adults") || "2", 10), 1, MAX_GUESTS_PER_BOOKING);
  const rooms = clampInt(parseInt(params.get("rooms") || "1", 10), 1, MAX_ROOMS_PER_BOOKING);

  const [data, setData] = useState<AvailabilityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAvailability({ checkIn, checkOut, adults, rooms })
      .then((d) => !cancelled && setData(d))
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof ApiError ? e.message : "Failed to load availability.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [checkIn, checkOut, adults, rooms]);

  const nights = useMemo(() => nightsBetween(checkIn, checkOut), [checkIn, checkOut]);

  return (
    <div>
      <div className="flex flex-col items-start justify-between gap-4 rounded-3xl border border-border-soft bg-card p-5 shadow-soft sm:flex-row sm:items-center sm:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-forest-800">Your Stay</p>
          <p className="mt-2 font-display text-2xl font-normal text-ink">
            {formatDateShort(checkIn)} <span className="text-ink-muted">→</span> {formatDateShort(checkOut)}
          </p>
          <p className="mt-1.5 text-sm text-ink-muted">
            {nights} {nights === 1 ? "night" : "nights"} · {adults} {adults === 1 ? "guest" : "guests"} · {rooms} {rooms === 1 ? "room" : "rooms"}
          </p>
        </div>
        <Link href="/" className="pill border border-forest-800/20 bg-card text-forest-800 hover:bg-forest-50">
          Modify Search
        </Link>
      </div>

      {loading && (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-3xl border border-border-soft bg-card">
              <div className="skeleton aspect-[16/9]" />
              <div className="space-y-3 p-6">
                <div className="skeleton h-6 w-2/3" />
                <div className="skeleton h-4 w-full" />
                <div className="skeleton h-4 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-8 rounded-3xl border border-red-200 bg-red-50 p-6 text-red-900">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            <h3 className="font-semibold">Couldn't check availability</h3>
          </div>
          <p className="mt-1 text-sm">{error}</p>
          <Button size="sm" variant="outline" className="mt-4" onClick={() => router.refresh()}>
            Try again
          </Button>
        </div>
      )}

      {data && data.roomTypes.length === 0 && (
        <div className="mt-8 rounded-3xl border border-border-soft bg-card p-10 text-center">
          <Calendar className="mx-auto h-10 w-10 text-ink-subtle" />
          <h3 className="mt-4 font-display text-2xl text-ink">No rooms available for these dates</h3>
          <p className="mt-2 text-sm text-ink-muted">Try shifting your dates by a day or two, or contact us directly.</p>
        </div>
      )}

      {data && data.roomTypes.length > 0 && (
        <div className="mt-8 space-y-6">
          {data.roomTypes.map((room, i) => {
            const cover = room.coverImage ?? room.photos?.find((p) => p.isCover)?.url;
            return (
              <motion.article
                key={room.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="grid gap-0 overflow-hidden rounded-3xl border border-border-soft bg-card shadow-soft sm:grid-cols-12"
              >
                <div className="relative aspect-[4/3] bg-cream-100 sm:col-span-4 sm:aspect-auto">
                  <ThemedImage
                    kind="room"
                    index={i}
                    fallback={cover}
                    alt={room.name}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </div>
                <div className="flex flex-col gap-4 p-5 sm:col-span-8 sm:p-6">
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div>
                      <h3 className="font-display text-2xl font-normal text-ink">{room.name}</h3>
                      {room.shortDesc && (
                        <p className="mt-1 text-sm text-ink-muted">{room.shortDesc}</p>
                      )}
                    </div>
                    <div className="shrink-0">
                      {room.soldOut ? (
                        <span className="inline-flex items-center gap-1.5 rounded-pill bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">
                          Sold Out
                        </span>
                      ) : room.available <= 2 ? (
                        <span className="inline-flex items-center gap-1.5 rounded-pill bg-sun-50 px-3 py-1.5 text-xs font-semibold text-sun-600">
                          Only {room.available} left
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-pill bg-forest-50 px-3 py-1.5 text-xs font-semibold text-forest-800">
                          {room.available} available
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      {room.maxAdults} Guests
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <BedDouble className="h-3.5 w-3.5" />
                      {room.bedConfiguration ?? "—"}
                    </span>
                    {room.areaSqft && (
                      <span className="inline-flex items-center gap-1.5">
                        <Maximize2 className="h-3.5 w-3.5" />
                        {room.areaSqft} sq.ft
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-muted">
                    {(room.amenities ?? []).slice(0, 5).map((a) => {
                      const am = a?.amenity ?? a;
                      const key = am?.key ?? am?.name ?? "unknown";
                      const label = am?.name ?? key.replace(/_/g, " ");
                      const Icon = AMENITY_ICONS[key] ?? Check;
                      return (
                        <span key={am?.id ?? key} className="inline-flex items-center gap-1 capitalize">
                          <Icon className="h-3.5 w-3.5 text-forest-800" strokeWidth={1.75} />
                          {label}
                        </span>
                      );
                    })}
                  </div>

                  <div className="mt-auto flex flex-col items-stretch justify-between gap-3 border-t border-border-soft/70 pt-4 sm:flex-row sm:items-center">
                    <div>
                      <p className="flex items-baseline gap-1.5">
                        <span className="text-xl font-semibold text-forest-800">
                          {formatINR(room.nightlyRate)}
                        </span>
                        <span className="text-sm text-ink-muted">/ night</span>
                      </p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        Total for {nights} {nights === 1 ? "night" : "nights"}:{" "}
                        <span className="font-semibold text-ink">
                          {formatINR(room.totalForStay)}
                        </span>
                      </p>
                    </div>
                    <Button
                      size="md"
                      variant="primary"
                      className="gap-2"
                      disabled={room.soldOut}
                      onClick={() =>
                        router.push(
                          `/booking/details?roomType=${room.slug}&checkIn=${checkIn}&checkOut=${checkOut}&adults=${adults}&rooms=${rooms}`
                        )
                      }
                    >
                      {room.soldOut ? "Sold Out" : "Select"}
                      {!room.soldOut && <ArrowRight className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}
    </div>
  );
}
