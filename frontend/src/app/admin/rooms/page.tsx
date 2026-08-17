"use client";

import { useEffect, useState, useCallback } from "react";
import { adminListRooms, adminListRoomTypes, adminUpdateRoomStatus, ApiError } from "@/lib/api";
import { useRealtimeEvents } from "@/lib/useRealtime";
import type { RoomDto, RoomStatus } from "@/lib/types";
import { cn } from "@/lib/cn";
import { CheckCircle2, AlertCircle } from "lucide-react";

const STATUSES: Array<{ value: RoomStatus; label: string; color: string }> = [
  { value: "READY", label: "Ready", color: "bg-forest-50 text-forest-800 border-forest-200" },
  { value: "DIRTY", label: "Dirty", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "CLEANING", label: "Cleaning", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "OCCUPIED", label: "Occupied", color: "bg-sun-50 text-sun-600 border-sun-200" },
  { value: "MAINTENANCE", label: "Maintenance", color: "bg-cream-100 text-ink-muted border-border-soft" },
  { value: "OUT_OF_ORDER", label: "Out of Order", color: "bg-red-50 text-red-700 border-red-200" },
];

export default function RoomsPage() {
  const [rooms, setRooms] = useState<RoomDto[]>([]);
  const [roomTypes, setRoomTypes] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [updatingRoomId, setUpdatingRoomId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [rs, rts] = await Promise.all([adminListRooms(), adminListRoomTypes()]);
      setRooms(rs.items);
      setRoomTypes(rts.items);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to load rooms");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useRealtimeEvents(
    useCallback(
      (event) => {
        if (event.type === "ROOM_STATUS_CHANGED" || event.type === "ROOM_ASSIGNED" || event.type === "ROOM_MOVED") {
          refresh();
        }
      },
      [refresh]
    )
  );

  const handleStatusChange = async (roomId: string, roomNumber: string, nextStatus: RoomStatus) => {
    setUpdatingRoomId(roomId);
    try {
      await adminUpdateRoomStatus(roomId, nextStatus);
      setRooms((prev) =>
        prev.map((x) => (x.id === roomId ? { ...x, status: nextStatus } : x))
      );
      setToast({
        type: "success",
        message: `Room ${roomNumber} status updated to ${nextStatus}`,
      });
      setTimeout(() => setToast(null), 4000);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to update status";
      setToast({ type: "error", message: msg });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setUpdatingRoomId(null);
    }
  };

  const filtered = filter === "ALL" ? rooms : rooms.filter((r) => r.status === filter);

  // Group by type
  const grouped = roomTypes.map((rt) => ({
    type: rt,
    rooms: filtered.filter((r) => r.roomType?.name === rt.name),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="font-display text-3xl text-ink">Rooms &amp; Inventory</p>
          <p className="mt-1 text-sm text-ink-muted">Live status of every physical room. Change room status on the fly.</p>
        </div>
      </div>

      {toast && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-2xl border p-4 text-sm transition-all shadow-soft",
            toast.type === "success"
              ? "border-forest-200 bg-forest-50 text-forest-800"
              : "border-red-200 bg-red-50 text-red-800"
          )}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-forest-800" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-red-800" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {error && (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-900">{error}</div>
      )}

      <div className="flex flex-wrap gap-2">
        <FilterChip active={filter === "ALL"} onClick={() => setFilter("ALL")}>
          All ({rooms.length})
        </FilterChip>
        {STATUSES.map((s) => {
          const count = rooms.filter((r) => r.status === s.value).length;
          return (
            <FilterChip key={s.value} active={filter === s.value} onClick={() => setFilter(s.value)}>
              {s.label} ({count})
            </FilterChip>
          );
        })}
      </div>

      {loading ? (
        <div className="skeleton h-96" />
      ) : (
        <div className="space-y-4">
          {grouped.map(({ type, rooms: typeRooms }) => (
            <div key={type.id} className="rounded-3xl border border-border-soft bg-card p-5 shadow-soft lg:p-6">
              <h2 className="mb-4 font-display text-xl text-ink">
                {type.name} <span className="text-sm font-normal text-ink-muted">({typeRooms.length})</span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {typeRooms.map((r) => {
                  const s = STATUSES.find((x) => x.value === r.status) ?? STATUSES[0];
                  const isUpdating = updatingRoomId === r.id;
                  return (
                    <div
                      key={r.id}
                      className={cn(
                        "rounded-2xl border border-border-soft bg-cream-50 p-4 transition-all hover:shadow-soft",
                        isUpdating && "opacity-60 pointer-events-none"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-base font-semibold text-ink">Room {r.roomNumber}</p>
                          {r.floor && <p className="text-xs text-ink-muted">Floor {r.floor}</p>}
                        </div>
                        <span
                          className={cn(
                            "rounded-pill border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider",
                            s.color
                          )}
                        >
                          {s.label}
                        </span>
                      </div>

                      <div className="mt-3">
                        <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-ink-muted">
                          Change Status
                        </label>
                        <select
                          value={r.status}
                          disabled={isUpdating}
                          onChange={(e) => handleStatusChange(r.id, r.roomNumber, e.target.value as RoomStatus)}
                          className="w-full rounded-xl border border-border-soft bg-card px-3 py-1.5 text-xs font-medium text-ink shadow-xs focus:border-forest-800 focus:outline-none"
                        >
                          {STATUSES.map((statusOpt) => (
                            <option key={statusOpt.value} value={statusOpt.value}>
                              Set {statusOpt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-pill border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-forest-800 bg-forest-800 text-white"
          : "border-border-soft bg-card text-ink hover:border-forest-800/40"
      )}
    >
      {children}
    </button>
  );
}
