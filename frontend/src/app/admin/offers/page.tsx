"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Tag,
  Calendar,
  Percent,
  IndianRupee,
  Loader2,
} from "lucide-react";
import {
  adminCreateOffer,
  adminDeleteOffer,
  adminGetOffer,
  adminListOffers,
  adminListRoomTypes,
  ApiError,
} from "@/lib/api";
import type { OfferDto } from "@/lib/types";
import { formatDateShort, formatINR } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { GlassPanel } from "@/components/ui/GlassPanel";

type OfferFormState = {
  id?: string;
  name: string;
  description: string;
  shortDesc: string;
  imageUrl: string;
  discountType: "PERCENT" | "FLAT";
  discountValue: string; // string for input
  minNights: string;
  promoCode: string;
  startDate: string;
  endDate: string;
  terms: string;
  status: "DRAFT" | "PUBLISHED" | "PAUSED" | "EXPIRED";
  roomTypeIds: string[];
};

const emptyForm: OfferFormState = {
  name: "",
  description: "",
  shortDesc: "",
  imageUrl: "",
  discountType: "PERCENT",
  discountValue: "10",
  minNights: "",
  promoCode: "",
  startDate: "",
  endDate: "",
  terms: "",
  status: "DRAFT",
  roomTypeIds: [],
};

export default function OffersPage() {
  const [items, setItems] = useState<OfferDto[]>([]);
  const [roomTypes, setRoomTypes] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<OfferFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [r, rt] = await Promise.all([
        adminListOffers(),
        adminListRoomTypes(),
      ]);
      setItems(r.items);
      setRoomTypes(rt.items.map((x) => ({ id: x.id, name: x.name })));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load offers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function startEdit(o: OfferDto) {
    try {
      const full = await adminGetOffer(o.id);
      setEditing({
        id: full.id,
        name: full.name,
        description: full.description,
        shortDesc: full.shortDesc ?? "",
        imageUrl: full.imageUrl ?? "",
        discountType: full.discountType as "PERCENT" | "FLAT",
        discountValue: String(full.discountValue / (full.discountType === "PERCENT" ? 100 : 100)),
        minNights: full.minNights ? String(full.minNights) : "",
        promoCode: full.promoCode ?? "",
        startDate: full.startDate.slice(0, 10),
        endDate: full.endDate.slice(0, 10),
        terms: full.terms ?? "",
        status: full.status as OfferFormState["status"],
        roomTypeIds: full.roomTypes.map((x) => x.roomTypeId),
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load offer");
    }
  }

  function startNew() {
    const today = new Date().toISOString().slice(0, 10);
    const in3m = new Date(Date.now() + 90 * 86400_000).toISOString().slice(0, 10);
    setEditing({ ...emptyForm, startDate: today, endDate: in3m });
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const v = parseFloat(editing.discountValue || "0");
      const valueInPaise = editing.discountType === "PERCENT" ? Math.round(v * 100) : Math.round(v * 100);
      const body = {
        id: editing.id,
        name: editing.name.trim(),
        description: editing.description.trim(),
        shortDesc: editing.shortDesc.trim() || undefined,
        imageUrl: editing.imageUrl.trim() || undefined,
        discountType: editing.discountType,
        discountValue: valueInPaise,
        minNights: editing.minNights ? parseInt(editing.minNights, 10) : undefined,
        promoCode: editing.promoCode.trim() || undefined,
        startDate: editing.startDate,
        endDate: editing.endDate,
        terms: editing.terms.trim() || undefined,
        status: editing.status,
        roomTypeIds: editing.roomTypeIds,
      };
      if (!body.name || !body.description || !body.startDate || !body.endDate) {
        setError("Name, description, start and end dates are required.");
        return;
      }
      if (new Date(body.endDate) <= new Date(body.startDate)) {
        setError("End date must be after start date.");
        return;
      }
      await adminCreateOffer(body);
      setEditing(null);
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this offer? It will be soft-deleted and stop showing on the site.")) return;
    setDeleting(id);
    try {
      await adminDeleteOffer(id);
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Delete failed");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-display text-3xl text-ink">Offers</p>
          <p className="mt-1 text-sm text-ink-muted">
            Promotions, packages, and promo codes. Appear on the public offers page.
          </p>
        </div>
        <Button onClick={startNew} className="gap-2" size="md">
          <Plus className="h-4 w-4" />
          New offer
        </Button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</div>
      )}

      {loading ? (
        <div className="skeleton h-64" />
      ) : items.length === 0 ? (
        <div className="glass rounded-3xl p-10 text-center">
          <p className="text-ink-muted">No offers yet.</p>
          <Button onClick={startNew} className="mt-4 gap-2" variant="outline">
            <Plus className="h-4 w-4" />
            Create your first offer
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((o) => (
            <article
              key={o.id}
              className="glass rounded-3xl p-5 transition-shadow hover:shadow-lift"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-xl text-ink">{o.name}</h3>
                  {o.shortDesc && (
                    <p className="mt-0.5 text-xs text-ink-muted">{o.shortDesc}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-pill px-2.5 py-0.5 text-xs font-semibold ${
                    o.status === "PUBLISHED"
                      ? "bg-forest-50 text-forest-800"
                      : o.status === "PAUSED"
                      ? "bg-sun-50 text-sun-600"
                      : o.status === "EXPIRED"
                      ? "bg-red-50 text-red-700"
                      : "bg-cream-100 text-ink-muted"
                  }`}
                >
                  {o.status}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-ink/80">{o.description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
                <span className="inline-flex items-center gap-1">
                  {o.discountType === "PERCENT" ? (
                    <Percent className="h-3.5 w-3.5" />
                  ) : (
                    <IndianRupee className="h-3.5 w-3.5" />
                  )}
                  {o.discountType === "PERCENT"
                    ? `${(o.discountValue / 100).toFixed(0)}% off`
                    : `${formatINR(o.discountValue)} off`}
                </span>
                {o.promoCode && (
                  <span className="inline-flex items-center gap-1 rounded bg-cream-100 px-2 py-0.5 font-mono">
                    <Tag className="h-3 w-3" />
                    {o.promoCode}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDateShort(o.startDate)} → {formatDateShort(o.endDate)}
                </span>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => startEdit(o)}
                  className="gap-1.5"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => remove(o.id)}
                  disabled={deleting === o.id}
                  className="gap-1.5 !text-red-700 hover:!bg-red-50"
                >
                  {deleting === o.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Delete
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Edit modal */}
      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-md sm:items-center sm:p-4"
            onClick={() => !saving && setEditing(null)}
          >
            <motion.div
              initial={{ y: 30, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 30, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 360, damping: 32 }}
              className="glass max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl p-6 sm:rounded-3xl sm:p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl text-ink">
                  {editing.id ? "Edit offer" : "New offer"}
                </h2>
                <button
                  onClick={() => setEditing(null)}
                  disabled={saving}
                  className="rounded-pill p-1.5 text-ink-muted hover:bg-cream-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field label="Name" required full>
                  <input
                    className="field"
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="Early Bird 20% off"
                  />
                </Field>
                <Field label="Tagline">
                  <input
                    className="field"
                    value={editing.shortDesc}
                    onChange={(e) => setEditing({ ...editing, shortDesc: e.target.value })}
                    placeholder="20% off when you book 30 days ahead"
                  />
                </Field>
                <Field label="Description" required full>
                  <textarea
                    className="field min-h-[100px] resize-none"
                    value={editing.description}
                    onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                    placeholder="Lock in 20% off the best available rate when you book 30+ days in advance. Free cancellation up to 7 days before check-in."
                  />
                </Field>
                <Field label="Image URL">
                  <input
                    className="field"
                    value={editing.imageUrl}
                    onChange={(e) => setEditing({ ...editing, imageUrl: e.target.value })}
                    placeholder="https://images.unsplash.com/…"
                  />
                </Field>
                <Field label="Discount type">
                  <select
                    className="field"
                    value={editing.discountType}
                    onChange={(e) =>
                      setEditing({ ...editing, discountType: e.target.value as "PERCENT" | "FLAT" })
                    }
                  >
                    <option value="PERCENT">Percent (%)</option>
                    <option value="FLAT">Flat amount (₹)</option>
                  </select>
                </Field>
                <Field
                  label={editing.discountType === "PERCENT" ? "Discount (%)" : "Discount (₹)"}
                >
                  <input
                    className="field"
                    type="number"
                    min="0"
                    step={editing.discountType === "PERCENT" ? "1" : "100"}
                    value={editing.discountValue}
                    onChange={(e) => setEditing({ ...editing, discountValue: e.target.value })}
                  />
                </Field>
                <Field label="Min nights">
                  <input
                    className="field"
                    type="number"
                    min="0"
                    value={editing.minNights}
                    onChange={(e) => setEditing({ ...editing, minNights: e.target.value })}
                    placeholder="optional"
                  />
                </Field>
                <Field label="Promo code">
                  <input
                    className="field font-mono uppercase"
                    value={editing.promoCode}
                    onChange={(e) => setEditing({ ...editing, promoCode: e.target.value.toUpperCase() })}
                    placeholder="EARLY20"
                  />
                </Field>
                <Field label="Start date" required>
                  <input
                    className="field"
                    type="date"
                    value={editing.startDate}
                    onChange={(e) => setEditing({ ...editing, startDate: e.target.value })}
                  />
                </Field>
                <Field label="End date" required>
                  <input
                    className="field"
                    type="date"
                    value={editing.endDate}
                    onChange={(e) => setEditing({ ...editing, endDate: e.target.value })}
                  />
                </Field>
                <Field label="Status">
                  <select
                    className="field"
                    value={editing.status}
                    onChange={(e) =>
                      setEditing({ ...editing, status: e.target.value as OfferFormState["status"] })
                    }
                  >
                    <option value="DRAFT">Draft (hidden)</option>
                    <option value="PUBLISHED">Published (live)</option>
                    <option value="PAUSED">Paused</option>
                    <option value="EXPIRED">Expired</option>
                  </select>
                </Field>
                <Field label="Terms &amp; conditions" full>
                  <textarea
                    className="field min-h-[80px] resize-none"
                    value={editing.terms}
                    onChange={(e) => setEditing({ ...editing, terms: e.target.value })}
                    placeholder="Min 30 days advance booking. Cannot combine with other offers."
                  />
                </Field>
                <Field label="Applies to" full>
                  <div className="flex flex-wrap gap-2">
                    {roomTypes.length === 0 && (
                      <span className="text-xs text-ink-muted">Loading…</span>
                    )}
                    {roomTypes.map((rt) => {
                      const on = editing.roomTypeIds.includes(rt.id);
                      return (
                        <button
                          key={rt.id}
                          type="button"
                          onClick={() => {
                            const next = on
                              ? editing.roomTypeIds.filter((x) => x !== rt.id)
                              : [...editing.roomTypeIds, rt.id];
                            setEditing({ ...editing, roomTypeIds: next });
                          }}
                          className={`rounded-pill border px-3 py-1.5 text-sm transition-all ${
                            on
                              ? "border-forest-800 bg-forest-800 text-white"
                              : "border-border-soft bg-card text-ink hover:border-forest-800/40"
                          }`}
                        >
                          {rt.name}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </div>

              <div className="mt-8 flex items-center justify-end gap-2 border-t border-border-soft pt-6">
                <Button
                  variant="outline"
                  onClick={() => setEditing(null)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  onClick={save}
                  disabled={saving}
                  className="gap-2"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editing.id ? "Save changes" : "Create offer"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({
  label,
  required,
  full,
  children,
}: {
  label: string;
  required?: boolean;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={full ? "sm:col-span-2 block" : "block"}>
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-muted">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      {children}
    </label>
  );
}
