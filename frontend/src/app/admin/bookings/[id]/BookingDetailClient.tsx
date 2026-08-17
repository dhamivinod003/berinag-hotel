"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  LogIn,
  LogOut,
  X,
  BedDouble,
  ArrowRightLeft,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  adminGetReservation,
  adminConfirmReservation,
  adminCancelReservation,
  adminCheckIn,
  adminCheckOut,
  adminListRooms,
  adminAssignRoom,
  adminRequestExtension,
  adminMoveRoom,
  ApiError,
  getAccessToken,
} from "@/lib/api";
import { useRealtimeEvents } from "@/lib/useRealtime";
import { formatINR, formatDateShort } from "@/lib/format";
import type { ReservationDto, RoomDto } from "@/lib/types";

export default function BookingDetailPage({ id }: { id: string }) {
  const router = useRouter();
  const [reservation, setReservation] = useState<ReservationDto | null>(null);
  const [rooms, setRooms] = useState<RoomDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const refresh = useCallback(async () => {
    if (!getAccessToken()) return;
    setError(null);
    try {
      const [r, rs] = await Promise.all([
        adminGetReservation(id),
        adminListRooms(),
      ]);
      setReservation(r);
      setRooms(rs.items);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to load booking");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useRealtimeEvents(
    useCallback(
      (event) => {
        if (event?.data?.reservation?.id === id || event?.data?.id === id) {
          refresh();
        }
      },
      [id, refresh]
    )
  );

  async function runAction(label: string, fn: () => Promise<unknown>) {
    setActionPending(label);
    setActionMessage(null);
    try {
      await fn();
      setActionMessage({ kind: "ok", text: `${label} — done` });
      await refresh();
    } catch (err) {
      setActionMessage({
        kind: "err",
        text: err instanceof ApiError ? err.message : "Action failed",
      });
    } finally {
      setActionPending(null);
    }
  }

  if (loading && !reservation) {
    return <div className="skeleton h-96" />;
  }
  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-900">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          <h3 className="font-semibold">Couldn't load booking</h3>
        </div>
        <p className="mt-1 text-sm">{error}</p>
        <Link href="/admin/bookings" className="mt-4 inline-block text-sm font-medium underline">
          Back to bookings
        </Link>
      </div>
    );
  }
  if (!reservation) return null;

  const r = reservation;
  const assignable = ["CONFIRMED"].includes(r.status);
  const canCheckIn = r.status === "CONFIRMED";
  const canCheckOut = r.status === "CHECKED_IN";
  const canCancel = ["PENDING", "HELD", "CONFIRMED"].includes(r.status);
  const assignedRoom = r.assignments?.[0]?.room;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/bookings"
          className="inline-flex h-10 w-10 items-center justify-center rounded-pill border border-border-soft bg-card hover:bg-cream-50"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <p className="font-display text-2xl text-ink">Booking #{r.bookingReference}</p>
          <p className="text-xs text-ink-muted">
            Created {new Date(r.createdAt ?? "").toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
        <span className={`ml-auto inline-flex items-center rounded-pill px-3 py-1 text-xs font-semibold ${statusColor(r.status)}`}>
          {r.status.replace(/_/g, " ")}
        </span>
      </div>

      {actionMessage && (
        <div
          className={`flex items-center gap-2 rounded-2xl border p-3 text-sm ${
            actionMessage.kind === "ok"
              ? "border-forest-200 bg-forest-50 text-forest-900"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {actionMessage.kind === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          {/* Stay */}
          <Card title="Stay">
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <Field label="Check-in" value={formatDateShort(r.checkIn)} />
              <Field label="Check-out" value={formatDateShort(r.checkOut)} />
              <Field label="Nights" value={String(r.nights)} />
              <Field label="Adults" value={String(r.adults)} />
              <Field label="Children" value={String(r.children)} />
              <Field label="Rooms" value={String(r.roomCount)} />
            </dl>
            {r.specialRequests && (
              <div className="mt-4 rounded-2xl bg-cream-50 p-3 text-sm text-ink-muted">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Special requests: </span>
                {r.specialRequests}
              </div>
            )}
          </Card>

          {/* Guest */}
          <Card title="Guest">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Field label="Name" value={r.guest?.fullName ?? "—"} />
              <Field label="Phone" value={r.guest?.phone ?? "—"} />
              <Field label="Email" value={r.guest?.email ?? "—"} />
              <Field label="Country" value={r.guest?.countryCode ?? "—"} />
            </dl>
          </Card>

          {/* Pricing */}
          <Card title="Pricing">
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <Field label="Nightly" value={formatINR(r.nightlyRate)} />
              <Field label="Subtotal" value={formatINR(r.subtotal)} />
              <Field label="Tax" value={formatINR(r.taxAmount)} />
              <Field label="Total" value={formatINR(r.totalAmount)} bold />
              <Field label="Paid" value={formatINR(r.amountPaid)} />
              <Field label="Due" value={formatINR(r.amountDue)} />
            </dl>
          </Card>

          {/* Events / history */}
          <Card title="Activity">
            {r.payments && r.payments.length > 0 && (
              <div className="mb-4">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">Payments</h4>
                <ul className="space-y-1.5 text-sm">
                  {r.payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between rounded-xl bg-cream-50 px-3 py-2">
                      <span>{p.method} · {p.status}</span>
                      <span className="font-mono">{formatINR(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-sm text-ink-muted">Activity log entries appear once the audit service is wired to this view.</p>
          </Card>
        </div>

        {/* Sidebar actions */}
        <div className="space-y-4 lg:col-span-4">
          <Card title="Actions">
            <div className="space-y-2">
              {r.status === "PENDING" && (
                <ActionBtn
                  icon={<Check className="h-4 w-4" />}
                  label="Confirm"
                  pending={actionPending === "Confirm"}
                  onClick={() => runAction("Confirm", () => adminConfirmReservation(r.id))}
                />
              )}
              {canCheckIn && (
                <ActionBtn
                  icon={<LogIn className="h-4 w-4" />}
                  label="Check In"
                  pending={actionPending === "Check In"}
                  onClick={() => runAction("Check-in", () => adminCheckIn(r.id))}
                />
              )}
              {canCheckOut && (
                <ActionBtn
                  icon={<LogOut className="h-4 w-4" />}
                  label="Check Out"
                  pending={actionPending === "Check Out"}
                  onClick={() => runAction("Check-out", () => adminCheckOut(r.id))}
                />
              )}
              {canCancel && (
                <ActionBtn
                  icon={<X className="h-4 w-4" />}
                  label="Cancel Booking"
                  variant="danger"
                  pending={actionPending === "Cancel Booking"}
                  onClick={() => {
                    const reason = prompt("Reason for cancellation?");
                    if (!reason) return;
                    runAction("Cancel", () => adminCancelReservation(r.id, reason));
                  }}
                />
              )}
            </div>
          </Card>

          {assignedRoom && (
            <Card title="Assigned Room">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-forest-50 text-forest-800">
                  <BedDouble className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-base font-semibold text-ink">Room {assignedRoom.roomNumber}</p>
                  <p className="text-xs text-ink-muted">{r.roomType?.name}</p>
                </div>
              </div>
            </Card>
          )}

          {assignable && rooms.length > 0 && (
            <Card title="Assign Room">
              <select
                className="field mb-2"
                onChange={async (e) => {
                  const roomId = e.target.value;
                  if (!roomId) return;
                  await runAction("Assign room", () => adminAssignRoom(r.id, roomId));
                  e.target.value = "";
                }}
                defaultValue=""
              >
                <option value="">Choose a room…</option>
                {rooms
                  .filter((rm) => rm.roomType?.name === r.roomType?.name)
                  .map((rm) => (
                    <option key={rm.id} value={rm.id}>
                      Room {rm.roomNumber} · {rm.status}
                    </option>
                  ))}
              </select>
            </Card>
          )}

          {(r.status === "CONFIRMED" || r.status === "CHECKED_IN") && (
            <Card title="Extend Stay">
              <ExtensionForm
                currentCheckOut={r.checkOut}
                onSubmit={(newCheckOut) =>
                  runAction("Request extension", () =>
                    adminRequestExtension(r.id, newCheckOut.toISOString())
                  )
                }
                pending={actionPending === "Request extension"}
              />
            </Card>
          )}

          {r.status === "CHECKED_IN" && assignedRoom && (
            <Card title="Move Room">
              <MoveRoomForm
                rooms={rooms.filter((rm) => rm.id !== assignedRoom.id && rm.roomType?.name === r.roomType?.name)}
                onSubmit={(toRoomId, reason) =>
                  runAction("Move room", () => adminMoveRoom(r.id, toRoomId, reason))
                }
                pending={actionPending === "Move room"}
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-border-soft bg-card p-5 shadow-soft lg:p-6">
      <h2 className="mb-4 font-display text-xl text-ink">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-ink-muted">{label}</dt>
      <dd className={`mt-1 text-sm ${bold ? "font-semibold text-forest-800" : "text-ink"}`}>{value}</dd>
    </div>
  );
}

function ActionBtn({
  icon,
  label,
  pending,
  onClick,
  variant = "primary",
}: {
  icon: React.ReactNode;
  label: string;
  pending: boolean;
  onClick: () => void;
  variant?: "primary" | "danger";
}) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${
        variant === "danger"
          ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
          : "border border-forest-800/20 bg-card text-forest-800 hover:bg-forest-50"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ExtensionForm({
  currentCheckOut,
  onSubmit,
  pending,
}: {
  currentCheckOut: string;
  onSubmit: (d: Date) => void;
  pending: boolean;
}) {
  const next = new Date(currentCheckOut);
  next.setDate(next.getDate() + 1);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const v = String(fd.get("newCheckOut") || "");
        if (v) onSubmit(new Date(v));
      }}
      className="flex items-end gap-2"
    >
      <label className="block flex-1">
        <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-muted">New check-out</span>
        <input
          type="date"
          name="newCheckOut"
          defaultValue={next.toISOString().slice(0, 10)}
          min={new Date(currentCheckOut).toISOString().slice(0, 10)}
          required
          className="field"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-2xl bg-forest-800 px-4 py-3 text-sm font-medium text-white hover:bg-forest-700 disabled:opacity-50"
      >
        Request
      </button>
    </form>
  );
}

function MoveRoomForm({
  rooms,
  onSubmit,
  pending,
}: {
  rooms: RoomDto[];
  onSubmit: (toRoomId: string, reason: string) => void;
  pending: boolean;
}) {
  if (rooms.length === 0) {
    return <p className="text-sm text-ink-muted">No alternative rooms of the same type available.</p>;
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const toRoomId = String(fd.get("toRoomId") || "");
        const reason = String(fd.get("reason") || "");
        if (toRoomId && reason) onSubmit(toRoomId, reason);
      }}
      className="space-y-2"
    >
      <select name="toRoomId" required className="field" defaultValue="">
        <option value="">Move to…</option>
        {rooms.map((rm) => (
          <option key={rm.id} value={rm.id}>
            Room {rm.roomNumber}
          </option>
        ))}
      </select>
      <input name="reason" required className="field" placeholder="Reason" />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-forest-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-forest-700 disabled:opacity-50"
      >
        Move
      </button>
    </form>
  );
}

function statusColor(status: string): string {
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
  return map[status] ?? "bg-cream-100 text-ink-muted";
}
