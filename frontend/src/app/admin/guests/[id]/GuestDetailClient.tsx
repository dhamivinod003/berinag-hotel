"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Calendar,
  FileText,
  Edit3,
  Save,
  X,
} from "lucide-react";
import {
  adminGetGuest,
  adminUpdateGuest,
  ApiError,
  type GuestProfileResponse,
} from "@/lib/api";
import type { ReservationDto } from "@/lib/types";

const STATUS_STYLES: Record<string, string> = {
  CONFIRMED: "bg-blue-50 text-blue-700 border-blue-200",
  CHECKED_IN: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CHECKED_OUT: "bg-slate-50 text-slate-600 border-slate-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  NO_SHOW: "bg-orange-50 text-orange-700 border-orange-200",
  HELD: "bg-violet-50 text-violet-700 border-violet-200",
};

function inr(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function GuestDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<GuestProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<GuestProfileResponse["guest"]>>({});
  const [saving, setSaving] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await adminGetGuest(id);
      setData(json);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError("Guest not found");
      } else {
        setError(err instanceof Error ? err.message : "Failed to load");
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminUpdateGuest(id, draft);
      setEditing(false);
      await fetchProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-ink-muted">Loading guest…</div>;
  if (error) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.push("/admin/guests")}
          className="flex items-center gap-2 text-sm text-ink-muted transition hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to guests
        </button>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      </div>
    );
  }
  if (!data) return null;

  const g = data.guest;
  const stats = data.stats;
  const canSeeSensitive = g.address !== null || g.notes !== null || g.idNumber !== null;

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.push("/admin/guests")}
        className="flex items-center gap-2 text-sm text-ink-muted transition hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to guests
      </button>

      <div className="rounded-3xl border border-border-soft bg-white/70 p-6 backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-forest/10 text-2xl font-semibold text-forest">
              {g.fullName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="font-display text-2xl text-ink">{g.fullName}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
                {g.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    {g.email}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  {g.countryCode} {g.phone}
                </span>
                {g.address && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {g.address}
                  </span>
                )}
              </div>
            </div>
          </div>
          {!editing ? (
            <button
              onClick={() => {
                setDraft({
                  fullName: g.fullName,
                  email: g.email,
                  phone: g.phone,
                  countryCode: g.countryCode,
                  address: g.address,
                  idType: g.idType,
                  idNumber: g.idNumber,
                  notes: g.notes,
                });
                setEditing(true);
              }}
              className="flex items-center gap-2 rounded-full border border-border-soft bg-card px-4 py-2 text-sm text-ink transition hover:shadow-sm"
            >
              <Edit3 className="h-4 w-4" />
              Edit
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditing(false)}
                className="flex items-center gap-2 rounded-full border border-border-soft bg-card px-4 py-2 text-sm text-ink-muted"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-full bg-forest px-4 py-2 text-sm font-medium text-white transition hover:bg-forest/90 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          )}
        </div>

        {stats.hasCurrentStay && data.currentReservation && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Currently {data.currentReservation.status === "CHECKED_IN" ? "checked in" : "has an upcoming stay"} —{" "}
            {data.currentReservation.bookingReference}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total bookings" value={stats.totalBookings} />
        <StatCard label="Past stays" value={stats.pastReservations} />
        <StatCard label="Upcoming" value={stats.upcomingReservations} />
        {stats.canSeeRevenue ? (
          <StatCard label="Total spent" value={inr(stats.totalSpentPaise)} accent="text-forest" />
        ) : (
          <StatCard label="Member since" value={new Date(g.createdAt).getFullYear().toString()} />
        )}
      </div>

      {editing && (
        <div className="rounded-3xl border border-border-soft bg-white/70 p-6 backdrop-blur">
          <h2 className="font-display text-lg text-ink">Edit details</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Full name" value={draft.fullName ?? ""} onChange={(v) => setDraft({ ...draft, fullName: v })} />
            <Field label="Email" value={draft.email ?? ""} onChange={(v) => setDraft({ ...draft, email: v || null })} />
            <Field label="Phone" value={draft.phone ?? ""} onChange={(v) => setDraft({ ...draft, phone: v })} />
            <Field label="Country code" value={draft.countryCode ?? ""} onChange={(v) => setDraft({ ...draft, countryCode: v })} />
            <Field
              label="Address"
              value={draft.address ?? ""}
              onChange={(v) => setDraft({ ...draft, address: v || null })}
              full
            />
            <Field label="ID type" value={draft.idType ?? ""} onChange={(v) => setDraft({ ...draft, idType: v || null })} />
            <Field label="ID number" value={draft.idNumber ?? ""} onChange={(v) => setDraft({ ...draft, idNumber: v || null })} />
            <Field
              label="Internal notes"
              value={draft.notes ?? ""}
              onChange={(v) => setDraft({ ...draft, notes: v || null })}
              full
              multiline
            />
          </div>
        </div>
      )}

      {!editing && canSeeSensitive && (g.notes || g.idType) && (
        <div className="rounded-3xl border border-border-soft bg-white/70 p-6 backdrop-blur">
          <h2 className="flex items-center gap-2 font-display text-lg text-ink">
            <FileText className="h-4 w-4" />
            Internal notes & ID
          </h2>
          {g.idType && (
            <p className="mt-3 text-sm text-ink-muted">
              <span className="font-medium text-ink">ID:</span> {g.idType} — {g.idNumber ?? "—"}
            </p>
          )}
          {g.notes && (
            <p className="mt-3 whitespace-pre-wrap text-sm text-ink">{g.notes}</p>
          )}
        </div>
      )}

      <div className="rounded-3xl border border-border-soft bg-white/70 backdrop-blur">
        <div className="border-b border-border-soft p-5">
          <h2 className="flex items-center gap-2 font-display text-lg text-ink">
            <Calendar className="h-4 w-4" />
            Booking history
          </h2>
        </div>
        {data.reservations.length === 0 ? (
          <div className="p-10 text-center text-sm text-ink-muted">No bookings yet.</div>
        ) : (
          <div className="divide-y divide-border-soft/60">
            {data.reservations.map((r: ReservationDto) => {
              const roomAssignment = r.assignments?.[0] as { room?: { roomNumber?: string } } | undefined;
              const roomNumber = roomAssignment?.room?.roomNumber;
              return (
                <div
                  key={r.id}
                  onClick={() => router.push(`/admin/bookings?id=${r.id}`)}
                  className="flex items-center gap-4 p-4 transition hover:bg-white/60 cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-ink">{r.bookingReference}</p>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                          STATUS_STYLES[r.status] ?? STATUS_STYLES.PENDING
                        }`}
                      >
                        {r.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-ink-muted">
                      {r.roomType?.name}
                      {roomNumber ? ` • Room ${roomNumber}` : ""} • {fmtDate(r.checkIn)} → {fmtDate(r.checkOut)}
                    </p>
                  </div>
                  {stats.canSeeRevenue && (
                    <div className="text-right">
                      <p className="font-medium text-ink">{inr(r.totalAmount)}</p>
                      <p className="text-xs text-ink-muted">
                        {r.amountDue > 0 ? `Due ${inr(r.amountDue)}` : "Paid"}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, accent = "" }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-2xl border border-border-soft bg-white/70 p-4 backdrop-blur">
      <p className="text-xs uppercase tracking-wider text-ink-muted">{label}</p>
      <p className={`mt-1 font-display text-2xl ${accent || "text-ink"}`}>{value}</p>
    </div>
  );
}

function Field({ label, value, onChange, full, multiline }: { label: string; value: string; onChange: (v: string) => void; full?: boolean; multiline?: boolean }) {
  return (
    <label className={`block ${full ? "md:col-span-2" : ""}`}>
      <span className="text-xs font-medium text-ink-muted">{label}</span>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className="mt-1 w-full rounded-2xl border border-border-soft bg-card px-3 py-2 text-sm text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20" />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-full border border-border-soft bg-card px-4 py-2 text-sm text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20" />
      )}
    </label>
  );
}
