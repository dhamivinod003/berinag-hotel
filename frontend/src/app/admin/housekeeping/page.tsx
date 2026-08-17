"use client";

import { useEffect, useState, useCallback } from "react";
import { adminHousekeepingBoard, adminUpdateHkTask, ApiError } from "@/lib/api";
import { useRealtimeEvents } from "@/lib/useRealtime";
import { cn } from "@/lib/cn";

const COLUMNS: Array<{ key: string; label: string; color: string }> = [
  { key: "DIRTY", label: "Dirty", color: "bg-red-50 text-red-700" },
  { key: "CLEANING", label: "Cleaning", color: "bg-sun-50 text-sun-600" },
  { key: "READY", label: "Ready", color: "bg-forest-50 text-forest-800" },
  { key: "OCCUPIED", label: "Occupied", color: "bg-cream-100 text-ink-muted" },
  { key: "MAINTENANCE", label: "Maintenance", color: "bg-cream-100 text-ink-muted" },
];

export default function HousekeepingPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await adminHousekeepingBoard();
      setData(r);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to load housekeeping board");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useRealtimeEvents(
    useCallback(
      (event) => {
        if (["HOUSEKEEPING_TASK_CREATED", "HOUSEKEEPING_TASK_UPDATED", "ROOM_STATUS_CHANGED"].includes(event.type)) {
          refresh();
        }
      },
      [refresh]
    )
  );

  if (loading) return <div className="skeleton h-96" />;
  if (error) return <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-900">{error}</div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <p className="font-display text-3xl text-ink">Housekeeping</p>
        <p className="mt-1 text-sm text-ink-muted">Room status board, live from the floor.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Object.entries(data.summary).map(([k, v]: any) => (
          <div key={k} className="rounded-3xl border border-border-soft bg-card p-4 text-center shadow-soft">
            <p className="font-display text-3xl font-semibold text-ink">{v}</p>
            <p className="mt-1 text-xs font-medium uppercase tracking-wider text-ink-muted">{k}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {COLUMNS.map((col) => {
          const inCol = data.rooms.filter((r: any) => r.status === col.key);
          return (
            <div key={col.key} className="rounded-3xl border border-border-soft bg-card p-5 shadow-soft">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-lg text-ink">{col.label}</h3>
                <span className={cn("rounded-pill px-2.5 py-0.5 text-xs font-semibold", col.color)}>
                  {inCol.length}
                </span>
              </div>
              {inCol.length === 0 ? (
                <p className="text-sm text-ink-muted">Empty.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {inCol.map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between rounded-2xl border border-border-soft bg-cream-50 px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold text-ink">Room {r.roomNumber}</p>
                        <p className="text-xs text-ink-muted">{r.roomType?.name}</p>
                      </div>
                      <select
                        className="rounded-xl border border-border-soft bg-card px-2 py-1 text-xs"
                        value={r.status}
                        onChange={async (e) => {
                          // Hand off to the room status update endpoint.
                          // (We'll call adminUpdateRoomStatus here, but it's not in the api client yet;
                          //  reuse the housekeeping update if/when we add it.)
                          alert("Use the Rooms page to change status.");
                        }}
                      >
                        {COLUMNS.map((c) => (
                          <option key={c.key} value={c.key}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
