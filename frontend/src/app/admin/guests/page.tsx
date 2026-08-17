"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Download,
  ChevronRight,
  Mail,
  Phone,
  Users as UsersIcon,
  Filter,
} from "lucide-react";
import { adminListGuests, type GuestListItem } from "@/lib/api";
import { getAccessToken } from "@/lib/api";

export default function GuestsPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<GuestListItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchList = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const json = await adminListGuests(query || undefined);
      setItems(json.items);
      setTotal(json.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchList(q), 250);
    return () => clearTimeout(t);
  }, [q, fetchList]);

  const handleExport = () => {
    // Backend requires Authorization header; we use fetch with the token directly.
    const token = getAccessToken();
    if (!token) return;
    // Use a hidden link with the bearer token via fetch+blob to keep auth header.
    void (async () => {
      try {
        const res = await fetch("/api/admin/guests/export", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Export failed");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `guests-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Export failed");
      }
    })();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="font-display text-3xl text-ink">Guests</p>
          <p className="mt-1 text-sm text-ink-muted">
            Customer profiles, search, and full booking history.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-full border border-border-soft bg-white/70 px-4 py-2 text-sm font-medium text-ink transition hover:bg-card hover:shadow-sm"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-3xl border border-border-soft bg-white/70 p-4 backdrop-blur">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, email, or phone…"
            className="w-full rounded-full border border-border-soft bg-card pl-10 pr-4 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
          />
        </div>
        <button
          className="flex items-center gap-2 rounded-full border border-border-soft bg-card px-4 py-2 text-sm text-ink-muted transition hover:bg-card"
          disabled
        >
          <Filter className="h-4 w-4" />
          Filters
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-3xl border border-border-soft bg-white/70 backdrop-blur">
        {loading && !items ? (
          <div className="p-10 text-center text-ink-muted">Loading…</div>
        ) : items && items.length === 0 ? (
          <div className="p-10 text-center text-ink-muted">
            <UsersIcon className="mx-auto h-8 w-8 opacity-40" />
            <p className="mt-2">No guests found{q ? ` for "${q}"` : ""}.</p>
          </div>
        ) : items ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-soft bg-surface-2/40 text-left text-xs uppercase tracking-wider text-ink-muted">
                <th className="px-5 py-3 font-medium">Guest</th>
                <th className="px-5 py-3 font-medium">Contact</th>
                <th className="px-5 py-3 font-medium">Stays</th>
                <th className="px-5 py-3 font-medium">Joined</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((g) => (
                <tr
                  key={g.id}
                  onClick={() => router.push(`/admin/guests/${g.id}`)}
                  className="cursor-pointer border-b border-border-soft/60 transition hover:bg-white/60"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-forest/10 text-sm font-semibold text-forest">
                        {g.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-ink">{g.fullName}</p>
                        <p className="text-xs text-ink-muted">{g.id.slice(0, 8)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="space-y-0.5 text-sm">
                      {g.email && (
                        <p className="flex items-center gap-1.5 text-ink-muted">
                          <Mail className="h-3 w-3" />
                          {g.email}
                        </p>
                      )}
                      <p className="flex items-center gap-1.5 text-ink-muted">
                        <Phone className="h-3 w-3" />
                        {g.countryCode} {g.phone}
                      </p>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center rounded-full bg-forest/10 px-2.5 py-0.5 text-xs font-medium text-forest">
                      {g._count.reservations} booking{g._count.reservations === 1 ? "" : "s"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-ink-muted">
                    {new Date(g.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <ChevronRight className="h-4 w-4 text-ink-muted" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>

      {items && (
        <p className="text-xs text-ink-muted">
          Showing {items.length} of {total} guest{total === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}
