"use client";

import { useEffect, useState, useCallback } from "react";
import { Phone, MessageCircle, Mail, Calendar } from "lucide-react";
import { adminListEnquiries, adminUpdateEnquiry, ApiError } from "@/lib/api";
import { useRealtimeEvents } from "@/lib/useRealtime";
import type { EnquiryDto } from "@/lib/types";

const STATUSES = ["NEW", "CONTACTED", "AWAITING_RESPONSE", "CONVERTED", "LOST", "SPAM"] as const;

export default function EnquiriesPage() {
  const [items, setItems] = useState<EnquiryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const refresh = useCallback(async () => {
    try {
      const r = await adminListEnquiries();
      setItems(r.items);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to load enquiries");
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
        if (event.type === "ENQUIRY_CREATED" || event.type === "ENQUIRY_UPDATED") {
          refresh();
        }
      },
      [refresh]
    )
  );

  const filtered =
    statusFilter === "ALL"
      ? items
      : items.filter((e) => e.status === statusFilter);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-display text-3xl text-ink">Enquiries</p>
        <p className="mt-1 text-sm text-ink-muted">Leads from the website, WhatsApp, phone, and walk-ins.</p>
      </div>

      {error && (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-900">{error}</div>
      )}

      <div className="flex flex-wrap gap-2">
        <FilterChip active={statusFilter === "ALL"} onClick={() => setStatusFilter("ALL")}>
          All ({items.length})
        </FilterChip>
        {STATUSES.map((s) => {
          const count = items.filter((e) => e.status === s).length;
          return (
            <FilterChip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
              {s.replace(/_/g, " ")} ({count})
            </FilterChip>
          );
        })}
      </div>

      {loading ? (
        <div className="skeleton h-96" />
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-border-soft bg-card p-10 text-center text-ink-muted">
          No enquiries.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((e) => (
            <article
              key={e.id}
              className="rounded-3xl border border-border-soft bg-card p-5 shadow-soft"
            >
              <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-semibold text-ink">{e.name}</p>
                    <StatusPill status={e.status} />
                    <span className="rounded-pill bg-cream-100 px-2 py-0.5 text-[10px] font-medium uppercase text-ink-muted">
                      {e.source}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
                    <a
                      href={`tel:${e.phone}`}
                      className="inline-flex items-center gap-1 hover:text-ink"
                    >
                      <Phone className="h-3 w-3" />
                      {e.phone}
                    </a>
                    {e.email && (
                      <a
                        href={`mailto:${e.email}`}
                        className="inline-flex items-center gap-1 hover:text-ink"
                      >
                        <Mail className="h-3 w-3" />
                        {e.email}
                      </a>
                    )}
                    <a
                      href={`https://wa.me/${e.phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:text-ink"
                    >
                      <MessageCircle className="h-3 w-3" />
                      WhatsApp
                    </a>
                    {e.requestedCheckIn && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {e.requestedCheckIn} → {e.requestedCheckOut}
                      </span>
                    )}
                  </div>
                  {e.message && (
                    <p className="mt-3 max-w-2xl text-sm text-ink">{e.message}</p>
                  )}
                  <p className="mt-2 text-xs text-ink-subtle">
                    {new Date(e.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                <select
                  value={e.status}
                  onChange={async (ev) => {
                    const next = ev.target.value as typeof STATUSES[number];
                    try {
                      await adminUpdateEnquiry(e.id, { status: next });
                      setItems((prev) => prev.map((x) => (x.id === e.id ? { ...x, status: next } : x)));
                    } catch (err) {
                      alert(err instanceof ApiError ? err.message : "Update failed");
                    }
                  }}
                  className="rounded-2xl border border-border-soft bg-card px-3 py-1.5 text-sm"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-pill border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-forest-800 bg-forest-800 text-white"
          : "border-border-soft bg-card text-ink hover:border-forest-800/40"
      }`}
    >
      {children}
    </button>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    NEW: "bg-sun-50 text-sun-600",
    CONTACTED: "bg-blue-50 text-blue-700",
    AWAITING_RESPONSE: "bg-blue-50 text-blue-700",
    CONVERTED: "bg-forest-50 text-forest-800",
    LOST: "bg-red-50 text-red-700",
    SPAM: "bg-cream-100 text-ink-muted",
  };
  return (
    <span className={`rounded-pill px-2.5 py-0.5 text-xs font-semibold ${map[status] ?? "bg-cream-100 text-ink-muted"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
