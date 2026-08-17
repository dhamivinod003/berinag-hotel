"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, Filter, ChevronRight, Calendar, MessageSquare, BedDouble, Users, Tag, Sparkles, UserCog, BarChart3, Image as ImageIcon, Settings, ListFilter } from "lucide-react";
import { adminListReservations, ApiError } from "@/lib/api";
import { useRealtimeEvents } from "@/lib/useRealtime";
import type { ReservationDto } from "@/lib/types";
import { formatINR, formatDateShort } from "@/lib/format";
import Link from "next/link";
import { cn } from "@/lib/cn";

const STATUSES = [
  "ALL",
  "PENDING",
  "HELD",
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
  "NO_SHOW",
];

export default function BookingsPage() {
  const [items, setItems] = useState<ReservationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("ALL");
  const [q, setQ] = useState("");

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    adminListReservations({
      ...(status !== "ALL" ? { status } : {}),
      ...(q ? { q } : {}),
    })
      .then((data) => setItems(data.items))
      .catch((err) => {
        if (err instanceof ApiError) setError(err.message);
        else setError("Failed to load bookings");
      })
      .finally(() => setLoading(false));
  }, [status, q]);

  useEffect(() => {
    const t = setTimeout(refresh, 200); // debounce search
    return () => clearTimeout(t);
  }, [refresh]);

  useRealtimeEvents(
    useCallback(
      (event) => {
        if (
          [
            "BOOKING_CREATED",
            "BOOKING_UPDATED",
            "BOOKING_CANCELLED",
            "BOOKING_CHECKED_IN",
            "BOOKING_CHECKED_OUT",
            "BOOKING_EXTENDED",
          ].includes(event.type)
        ) {
          refresh();
        }
      },
      [refresh]
    )
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="font-display text-3xl text-ink">Bookings</p>
          <p className="mt-1 text-sm text-ink-muted">All reservations — past, current, and future.</p>
        </div>
        <Link
          href="/admin/bookings/new"
          className="pill bg-forest-800 text-white hover:bg-forest-700"
        >
          + New Booking
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            type="search"
            placeholder="Search by ref, guest name, or phone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="field pl-10"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto">
          <ListFilter className="h-4 w-4 text-ink-muted" />
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                "rounded-pill border px-3 py-1.5 text-xs font-medium transition-colors",
                status === s
                  ? "border-forest-800 bg-forest-800 text-white"
                  : "border-border-soft bg-card text-ink hover:border-forest-800/40"
              )}
            >
              {s.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-900">{error}</div>
      )}

      <div className="rounded-3xl border border-border-soft bg-card shadow-soft">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-12" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-ink-muted">No bookings found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-soft text-left text-xs uppercase tracking-wider text-ink-muted">
                  <th className="px-4 py-3 font-medium">Ref</th>
                  <th className="px-4 py-3 font-medium">Guest</th>
                  <th className="px-4 py-3 font-medium">Room</th>
                  <th className="px-4 py-3 font-medium">Dates</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((b) => (
                  <tr
                    key={b.id}
                    className="border-b border-border-soft/60 last:border-0 transition-colors hover:bg-cream-50"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-ink-muted">#{b.bookingReference}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{b.guest?.fullName ?? "—"}</div>
                      <div className="text-xs text-ink-muted">{b.guest?.phone ?? ""}</div>
                    </td>
                    <td className="px-4 py-3 text-ink">{b.roomType?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-muted">
                      {formatDateShort(b.checkIn)} → {formatDateShort(b.checkOut)}
                      <div className="text-xs">{b.nights} {b.nights === 1 ? "night" : "nights"}</div>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{b.source}</td>
                    <td className="px-4 py-3 text-right font-medium text-ink">{formatINR(b.totalAmount)}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={b.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/bookings/${b.id}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-forest-800 hover:underline"
                      >
                        Open
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    CONFIRMED: "bg-forest-50 text-forest-800",
    PENDING: "bg-sun-50 text-sun-600",
    CANCELLED: "bg-red-50 text-red-700",
    HELD: "bg-blue-50 text-blue-700",
    CHECKED_IN: "bg-violet-50 text-violet-700",
    CHECKED_OUT: "bg-cream-100 text-ink-muted",
    NO_SHOW: "bg-red-50 text-red-700",
    EXPIRED: "bg-cream-100 text-ink-muted",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-semibold",
        map[status] ?? "bg-cream-100 text-ink-muted"
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
