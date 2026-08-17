"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Users,
  IndianRupee,
  Filter,
  X,
  BedDouble,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import {
  adminGetCalendar,
  ApiError,
  type CalendarView,
  type CalendarBlock,
  type CalendarRoom,
} from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { formatINR, formatDateShort } from "@/lib/format";

type ViewMode = "day" | "week";

const STATUS_PILL: Record<string, string> = {
  CONFIRMED: "bg-forest-100 text-forest-800",
  CHECKED_IN: "bg-sun-100 text-sun-600",
  CHECKED_OUT: "bg-cream-200 text-ink-muted",
  HELD: "bg-wave-400/20 text-wave-600",
};

function toDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function fromDate(s: string): Date {
  return new Date(s + "T00:00:00");
}
function daysInRange(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  for (let t = from.getTime(); t <= to.getTime(); t += 86400_000) out.push(new Date(t));
  return out;
}
function overlap(a: Date, b: Date, c: Date, d: Date): { start: Date; end: Date } | null {
  const start = a.getTime() > c.getTime() ? a : c;
  const end = b.getTime() < d.getTime() ? b : d;
  if (start.getTime() >= end.getTime()) return null;
  return { start, end };
}

export default function CalendarPage() {
  const router = useRouter();
  const [view, setView] = useState<ViewMode>("week");
  const [anchor, setAnchor] = useState<Date>(new Date(new Date().setHours(0, 0, 0, 0)));
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [roomTypeFilter, setRoomTypeFilter] = useState<string | null>(null);
  const [data, setData] = useState<CalendarView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<CalendarBlock | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const range = useMemo(() => {
    if (view === "day") {
      return { from: anchor, to: anchor };
    }
    // Week starting Monday
    const day = anchor.getDay();
    const offset = day === 0 ? -6 : 1 - day;
    const start = new Date(anchor);
    start.setDate(start.getDate() + offset);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { from: start, to: end };
  }, [anchor, view]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await adminGetCalendar(toDate(range.from), toDate(range.to));
      setData(r);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load calendar");
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime poll every 30s
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => load(), 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [load]);

  function shift(days: number) {
    const d = new Date(anchor);
    d.setDate(d.getDate() + days);
    setAnchor(d);
  }
  function today() {
    setAnchor(new Date(new Date().setHours(0, 0, 0, 0)));
  }

  const roomTypes = useMemo(() => {
    const map = new Map<string, string>();
    data?.rooms.forEach((r) => map.set(r.roomTypeId, r.roomTypeName));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [data]);

  const visibleRooms = useMemo(() => {
    if (!data) return [];
    if (!roomTypeFilter) return data.rooms;
    return data.rooms.filter((r) => r.roomTypeId === roomTypeFilter);
  }, [data, roomTypeFilter]);

  const visibleBlocks = useMemo(() => {
    if (!data) return [];
    if (!statusFilter) return data.blocks;
    return data.blocks.filter((b) => b.status === statusFilter);
  }, [data, statusFilter]);

  const days = useMemo(() => daysInRange(range.from, range.to), [range]);

  // Assign each block to a room row (or to "Unassigned" if no room)
  const blocksByRoom = useMemo(() => {
    const m = new Map<string | null, CalendarBlock[]>();
    for (const b of visibleBlocks) {
      const key = b.roomId ?? null;
      const list = m.get(key) ?? [];
      list.push(b);
      m.set(key, list);
    }
    return m;
  }, [visibleBlocks]);
  const unassigned = blocksByRoom.get(null) ?? [];
  const blockByRoom = new Map<string, CalendarBlock[]>();
  blocksByRoom.forEach((v, k) => {
    if (k) blockByRoom.set(k, v);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-3xl text-ink">Reservation calendar</p>
          <p className="mt-1 text-sm text-ink-muted">
            Live view of bookings across rooms and dates. Auto-refreshes every 30s.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => load()} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      <GlassPanel className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" onClick={() => shift(view === "day" ? -1 : -7)} className="!px-2">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={today}>Today</Button>
            <Button size="sm" variant="outline" onClick={() => shift(view === "day" ? 1 : 7)} className="!px-2">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <span className="font-display text-base text-ink">
            {formatDateShort(toDate(range.from))} — {formatDateShort(toDate(range.to))}
          </span>
          <span className="text-ink-muted">·</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setView("day")}
              className={`rounded-pill px-3 py-1.5 text-sm ${
                view === "day" ? "bg-forest-800 text-white" : "border border-border-soft bg-card text-ink hover:border-forest-800/40"
              }`}
            >
              Day
            </button>
            <button
              onClick={() => setView("week")}
              className={`rounded-pill px-3 py-1.5 text-sm ${
                view === "week" ? "bg-forest-800 text-white" : "border border-border-soft bg-card text-ink hover:border-forest-800/40"
              }`}
            >
              Week
            </button>
          </div>
          <span className="text-ink-muted">·</span>
          <Filter className="h-4 w-4 text-ink-muted" />
          <select
            className="rounded-xl border border-border-soft bg-card px-2 py-1 text-sm"
            value={statusFilter ?? ""}
            onChange={(e) => setStatusFilter(e.target.value || null)}
          >
            <option value="">All statuses</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="CHECKED_IN">Checked in</option>
            <option value="CHECKED_OUT">Checked out</option>
            <option value="HELD">Held</option>
          </select>
          <select
            className="rounded-xl border border-border-soft bg-card px-2 py-1 text-sm"
            value={roomTypeFilter ?? ""}
            onChange={(e) => setRoomTypeFilter(e.target.value || null)}
          >
            <option value="">All room types</option>
            {roomTypes.map((rt) => (
              <option key={rt.id} value={rt.id}>{rt.name}</option>
            ))}
          </select>
        </div>
      </GlassPanel>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</div>
      )}

      {loading && !data ? (
        <div className="skeleton h-[480px] rounded-3xl" />
      ) : data ? (
        <GlassPanel className="p-0 overflow-hidden">
          <CalendarGrid
            days={days}
            rooms={visibleRooms}
            blocksByRoom={blockByRoom}
            unassigned={unassigned}
            rangeFrom={range.from}
            rangeTo={range.to}
            onBlockClick={setSelectedBlock}
          />
        </GlassPanel>
      ) : null}

      <BlockDetailsDrawer
        block={selectedBlock}
        room={data?.rooms.find((r) => r.id === selectedBlock?.roomId) ?? null}
        onClose={() => setSelectedBlock(null)}
        onOpenBooking={(id) => router.push(`/admin/bookings/${id}`)}
      />
    </div>
  );
}

function CalendarGrid({
  days,
  rooms,
  blocksByRoom,
  unassigned,
  rangeFrom,
  rangeTo,
  onBlockClick,
}: {
  days: Date[];
  rooms: CalendarRoom[];
  blocksByRoom: Map<string, CalendarBlock[]>;
  unassigned: CalendarBlock[];
  rangeFrom: Date;
  rangeTo: Date;
  onBlockClick: (b: CalendarBlock) => void;
}) {
  const totalDays = days.length;
  const rowHeight = 64;
  const headerH = 56;
  const roomColW = 200;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[900px]">
        {/* Header row */}
        <div className="sticky top-0 z-10 flex border-b border-border-soft bg-white/95 backdrop-blur-md">
          <div
            className="shrink-0 border-r border-border-soft px-3 py-3"
            style={{ width: roomColW, height: headerH }}
          >
            <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">Room</p>
            <p className="text-xs text-ink-subtle">{rooms.length} rooms</p>
          </div>
          <div className="flex flex-1">
            {days.map((d) => {
              const dow = d.getDay();
              const isWeekend = dow === 0 || dow === 6;
              const isToday = toDate(d) === toDate(new Date());
              return (
                <div
                  key={toDate(d)}
                  className={`flex-1 border-r border-border-soft px-2 py-3 ${
                    isToday ? "bg-forest-50" : isWeekend ? "bg-cream-50" : "bg-card"
                  }`}
                  style={{ height: headerH }}
                >
                  <p className="text-[10px] font-medium uppercase tracking-wider text-ink-muted">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dow]}
                  </p>
                  <p className="font-mono text-sm font-semibold text-ink">
                    {d.getDate()}{" "}
                    <span className="text-xs font-normal text-ink-muted">
                      {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()]}
                    </span>
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Room rows */}
        {rooms.map((room) => {
          const blocks = blocksByRoom.get(room.id) ?? [];
          return (
            <div
              key={room.id}
              className="flex border-b border-border-soft"
              style={{ minHeight: rowHeight }}
            >
              <div
                className="shrink-0 border-r border-border-soft bg-card px-3 py-3"
                style={{ width: roomColW }}
              >
                <p className="font-mono text-sm font-semibold text-ink">#{room.roomNumber}</p>
                <p className="text-xs text-ink-muted">{room.roomTypeName}</p>
                <span
                  className={`mt-1 inline-block rounded-pill px-1.5 py-0.5 text-[10px] font-medium ${
                    room.status === "READY"
                      ? "bg-forest-50 text-forest-800"
                      : room.status === "OCCUPIED"
                      ? "bg-sun-50 text-sun-600"
                      : "bg-cream-200 text-ink-muted"
                  }`}
                >
                  {room.status}
                </span>
              </div>
              <div
                className="relative flex-1"
                style={{ minHeight: rowHeight }}
              >
                {/* Day grid lines */}
                {days.map((d) => (
                  <div
                    key={toDate(d)}
                    className={`absolute inset-y-0 border-r border-border-soft ${
                      d.getDay() === 0 || d.getDay() === 6 ? "bg-cream-50/50" : ""
                    }`}
                    style={{ left: `${(days.indexOf(d) / totalDays) * 100}%`, width: `${(1 / totalDays) * 100}%` }}
                  />
                ))}
                {/* Today line */}
                {(() => {
                  const today = toDate(new Date());
                  const idx = days.findIndex((d) => toDate(d) === today);
                  if (idx < 0) return null;
                  return (
                    <div
                      className="absolute inset-y-0 w-px bg-forest-800/40"
                      style={{ left: `${((idx + 0.5) / totalDays) * 100}%` }}
                    />
                  );
                })()}
                {/* Blocks */}
                {blocks.map((b) => {
                  const overlap_ = overlap(fromDate(b.checkIn), fromDate(b.checkOut), rangeFrom, rangeTo);
                  if (!overlap_) return null;
                  const startIdx = days.findIndex((d) => toDate(d) === toDate(overlap_.start));
                  const endIdx = days.findIndex((d) => toDate(d) === toDate(overlap_.end));
                  const s = startIdx < 0 ? 0 : startIdx;
                  const e = endIdx < 0 ? days.length : endIdx + 1;
                  const left = (s / totalDays) * 100;
                  const width = ((e - s) / totalDays) * 100;
                  return (
                    <button
                      key={b.reservationId}
                      onClick={() => onBlockClick(b)}
                      className="absolute top-1.5 bottom-1.5 cursor-pointer overflow-hidden rounded-xl border border-white/30 px-2 py-1 text-left text-white shadow-sm transition-all hover:scale-[1.02] hover:shadow-lg"
                      style={{
                        left: `calc(${left}% + 2px)`,
                        width: `calc(${width}% - 4px)`,
                        backgroundColor: b.roomTypeColor,
                      }}
                      title={`${b.bookingReference} · ${b.guestName} (${b.status})`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <p className="truncate text-xs font-semibold">{b.guestName}</p>
                        <span className="shrink-0 rounded-full bg-white/25 px-1.5 py-0.5 text-[9px]">
                          {b.status.replace("CHECKED_", "CI:").replace("CONFIRMED", "OK")}
                        </span>
                      </div>
                      <p className="truncate text-[10px] opacity-90">{b.bookingReference}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Unassigned row */}
        {unassigned.length > 0 && (
          <div className="flex border-b border-border-soft bg-amber-50/50">
            <div
              className="shrink-0 border-r border-border-soft px-3 py-3"
              style={{ width: roomColW }}
            >
              <p className="text-sm font-semibold text-ink">Unassigned</p>
              <p className="text-xs text-ink-muted">
                {unassigned.length} reservation{unassigned.length === 1 ? "" : "s"} without a room
              </p>
            </div>
            <div className="relative flex-1" style={{ minHeight: rowHeight }}>
              {days.map((d) => (
                <div
                  key={toDate(d)}
                  className="absolute inset-y-0 border-r border-border-soft"
                  style={{ left: `${(days.indexOf(d) / totalDays) * 100}%`, width: `${(1 / totalDays) * 100}%` }}
                />
              ))}
              {unassigned.map((b) => {
                const overlap_ = overlap(fromDate(b.checkIn), fromDate(b.checkOut), rangeFrom, rangeTo);
                if (!overlap_) return null;
                const startIdx = days.findIndex((d) => toDate(d) === toDate(overlap_.start));
                const endIdx = days.findIndex((d) => toDate(d) === toDate(overlap_.end));
                const s = startIdx < 0 ? 0 : startIdx;
                const e = endIdx < 0 ? days.length : endIdx + 1;
                const left = (s / totalDays) * 100;
                const width = ((e - s) / totalDays) * 100;
                return (
                  <button
                    key={b.reservationId}
                    onClick={() => onBlockClick(b)}
                    className="absolute top-1.5 bottom-1.5 cursor-pointer overflow-hidden rounded-xl border-2 border-dashed border-amber-500/60 bg-amber-200/80 px-2 py-1 text-left text-ink shadow-sm transition-all hover:scale-[1.02] hover:shadow-lg"
                    style={{
                      left: `calc(${left}% + 2px)`,
                      width: `calc(${width}% - 4px)`,
                    }}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <p className="truncate text-xs font-semibold">{b.guestName}</p>
                      <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px]">
                        ⚠ assign
                      </span>
                    </div>
                    <p className="truncate text-[10px] opacity-80">{b.bookingReference} · {b.roomTypeName}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {rooms.length === 0 && unassigned.length === 0 && (
          <div className="px-6 py-10 text-center text-sm text-ink-muted">
            No rooms match the current filter.
          </div>
        )}
      </div>
    </div>
  );
}

function BlockDetailsDrawer({
  block,
  room,
  onClose,
  onOpenBooking,
}: {
  block: CalendarBlock | null;
  room: CalendarRoom | null;
  onClose: () => void;
  onOpenBooking: (id: string) => void;
}) {
  return (
    <AnimatePresence>
      {block && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-md sm:items-center sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 30, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 30, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 360, damping: 32 }}
            className="glass max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-6 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-sm font-semibold text-ink-muted">
                  {block.bookingReference}
                </p>
                <h2 className="font-display text-2xl text-ink">{block.guestName}</h2>
              </div>
              <button onClick={onClose} className="rounded-pill p-1.5 text-ink-muted hover:bg-cream-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-3 text-sm">
              <Detail
                icon={CalendarDays}
                label="Stay"
                value={`${formatDateShort(block.checkIn)} → ${formatDateShort(block.checkOut)}`}
              />
              <Detail
                icon={Users}
                label="Guests"
                value={`${block.adults} adults${block.children ? ` · ${block.children} children` : ""}`}
              />
              <Detail
                icon={BedDouble}
                label="Room"
                value={
                  block.roomNumber
                    ? `#${block.roomNumber} · ${block.roomTypeName}`
                    : `${block.roomTypeName} · not yet assigned`
                }
              />
              <Detail
                icon={IndianRupee}
                label="Payment"
                value={`${formatINR(block.amountPaid)} paid · ${formatINR(block.amountDue)} due`}
              />
              <div className="flex items-center gap-2 text-sm">
                <span className="text-ink-muted">Status</span>
                <span
                  className={`rounded-pill px-2 py-0.5 text-xs font-semibold ${
                    STATUS_PILL[block.status] ?? "bg-cream-100 text-ink-muted"
                  }`}
                >
                  {block.status}
                </span>
                <span className="text-xs text-ink-muted">· via {block.source}</span>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-border-soft pt-4">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button
                onClick={() => {
                  onOpenBooking(block.reservationId);
                  onClose();
                }}
                className="gap-2"
              >
                Open booking
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="h-4 w-4 text-ink-muted" />
      <span className="text-ink-muted">{label}:</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}
