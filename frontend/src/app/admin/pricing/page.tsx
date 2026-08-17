"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  TrendingUp,
  IndianRupee,
  Calendar,
  Loader2,
  Image as ImageIcon,
  Star,
  BedDouble,
  Users,
  Maximize2,
} from "lucide-react";
import {
  adminAddRoomPhoto,
  adminCreateRatePlan,
  adminDeleteRatePlan,
  adminDeleteRoomPhoto,
  adminListRatePlans,
  adminListRoomTypes,
  adminUpdateRoomType,
  ApiError,
} from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { formatINR } from "@/lib/format";

type RoomTypeFull = {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  totalUnits: number;
  maxAdults: number;
  maxChildren: number;
  maxOccupancy: number;
  shortDesc?: string | null;
  description?: string | null;
  bedConfiguration?: string | null;
  areaSqft?: number | null;
  view?: string | null;
  status: string;
  displayOrder: number;
  photos?: Array<{
    id: string;
    url: string;
    alt?: string | null;
    isCover: boolean;
    displayOrder: number;
  }>;
};

type EditFormState = {
  basePrice: string; // paise
  name: string;
  shortDesc: string;
  description: string;
  maxAdults: string;
  maxChildren: string;
  maxOccupancy: string;
  bedConfiguration: string;
  areaSqft: string;
  view: string;
  totalUnits: string;
  status: "ACTIVE" | "HIDDEN" | "ARCHIVED";
};

function formFromRt(rt: RoomTypeFull): EditFormState {
  return {
    basePrice: String(rt.basePrice),
    name: rt.name,
    shortDesc: rt.shortDesc ?? "",
    description: rt.description ?? "",
    maxAdults: String(rt.maxAdults),
    maxChildren: String(rt.maxChildren),
    maxOccupancy: String(rt.maxOccupancy),
    bedConfiguration: rt.bedConfiguration ?? "",
    areaSqft: rt.areaSqft ? String(rt.areaSqft) : "",
    view: rt.view ?? "",
    totalUnits: String(rt.totalUnits),
    status: rt.status as "ACTIVE" | "HIDDEN" | "ARCHIVED",
  };
}

export default function PricingPage() {
  const [items, setItems] = useState<RoomTypeFull[]>([]);
  const [rates, setRates] = useState<
    Array<{
      id: string;
      roomTypeId: string;
      startDate: string;
      endDate: string;
      rate: number;
      minNights?: number | null;
      priority: number;
      active: boolean;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ rt: RoomTypeFull; form: EditFormState } | null>(null);
  const [saving, setSaving] = useState(false);

  const [newRateRoomTypeId, setNewRateRoomTypeId] = useState<string | null>(null);
  const [newRateForm, setNewRateForm] = useState({
    startDate: "",
    endDate: "",
    rate: "",
    minNights: "",
  });

  const refresh = useCallback(async () => {
    try {
      const [rts, rs] = await Promise.all([
        adminListRoomTypes(),
        adminListRatePlans(),
      ]);
      setItems(rts.items as RoomTypeFull[]);
      setRates(rs.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const basePrice = parseInt(editing.form.basePrice, 10);
      if (!Number.isFinite(basePrice) || basePrice <= 0) {
        setError("Base price must be a positive number (in paise).");
        return;
      }
      await adminUpdateRoomType(editing.rt.id, {
        name: editing.form.name.trim() || editing.rt.name,
        shortDesc: editing.form.shortDesc.trim() || undefined,
        description: editing.form.description.trim() || undefined,
        basePrice,
        maxAdults: parseInt(editing.form.maxAdults, 10) || editing.rt.maxAdults,
        maxChildren: parseInt(editing.form.maxChildren, 10) || 0,
        maxOccupancy: parseInt(editing.form.maxOccupancy, 10) || editing.rt.maxOccupancy,
        bedConfiguration: editing.form.bedConfiguration.trim() || undefined,
        areaSqft: parseInt(editing.form.areaSqft, 10) || undefined,
        view: editing.form.view.trim() || undefined,
        totalUnits: parseInt(editing.form.totalUnits, 10) || editing.rt.totalUnits,
        status: editing.form.status,
      });
      setEditing(null);
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function addRate() {
    if (!newRateRoomTypeId) return;
    try {
      const startDate = newRateForm.startDate;
      const endDate = newRateForm.endDate;
      if (!startDate || !endDate) {
        setError("Pick a start and end date for the rate override.");
        return;
      }
      if (new Date(endDate) <= new Date(startDate)) {
        setError("End date must be after start date.");
        return;
      }
      const rate = parseInt(newRateForm.rate, 10);
      if (!Number.isFinite(rate) || rate <= 0) {
        setError("Rate must be a positive number (in paise).");
        return;
      }
      await adminCreateRatePlan({
        roomTypeId: newRateRoomTypeId,
        startDate,
        endDate,
        rate,
        minNights: newRateForm.minNights ? parseInt(newRateForm.minNights, 10) : undefined,
        priority: 10,
        active: true,
      });
      setNewRateRoomTypeId(null);
      setNewRateForm({ startDate: "", endDate: "", rate: "", minNights: "" });
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to add rate plan");
    }
  }

  async function removeRate(id: string) {
    if (!confirm("Delete this rate plan?")) return;
    try {
      await adminDeleteRatePlan(id);
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Delete failed");
    }
  }

  async function addPhoto(roomTypeId: string, url: string, alt: string, isCover: boolean) {
    if (!url) return;
    try {
      await adminAddRoomPhoto(roomTypeId, { url, alt, isCover });
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Add photo failed");
    }
  }

  async function removePhoto(roomTypeId: string, photoId: string) {
    if (!confirm("Remove this photo?")) return;
    try {
      await adminDeleteRoomPhoto(roomTypeId, photoId);
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Delete photo failed");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-display text-3xl text-ink">Pricing &amp; Content</p>
        <p className="mt-1 text-sm text-ink-muted">
          Edit base prices, room details, photos, and seasonal rate overrides.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</div>
      )}

      {loading ? (
        <div className="skeleton h-64" />
      ) : (
        <div className="space-y-6">
          {items.map((rt) => (
            <article key={rt.id} className="glass rounded-3xl p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-2xl text-ink">{rt.name}</h3>
                  {rt.shortDesc && (
                    <p className="mt-1 text-sm text-ink-muted">{rt.shortDesc}</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      {rt.maxAdults} adults · {rt.maxChildren} children
                    </span>
                    {rt.bedConfiguration && (
                      <span className="inline-flex items-center gap-1.5">
                        <BedDouble className="h-3.5 w-3.5" />
                        {rt.bedConfiguration}
                      </span>
                    )}
                    {rt.areaSqft && (
                      <span className="inline-flex items-center gap-1.5">
                        <Maximize2 className="h-3.5 w-3.5" />
                        {rt.areaSqft} sq.ft
                      </span>
                    )}
                    <span className="rounded-pill bg-cream-100 px-2 py-0.5 text-ink">
                      {rt.totalUnits} units
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-2xl font-semibold text-forest-800">
                    {formatINR(rt.basePrice)}
                  </div>
                  <div className="text-xs text-ink-muted">/ night</div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setEditing({ rt, form: formFromRt(rt) })}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit details &amp; price
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => {
                    setNewRateRoomTypeId(rt.id);
                    setError(null);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add seasonal rate
                </Button>
              </div>

              {/* Rate plans for this room type */}
              {(() => {
                const myRates = rates.filter((r) => r.roomTypeId === rt.id);
                if (myRates.length === 0) return null;
                return (
                  <div className="mt-5 border-t border-border-soft pt-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">
                      Seasonal overrides
                    </p>
                    <div className="mt-2 space-y-1.5">
                      {myRates.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-border-soft bg-cream-50 px-3 py-2 text-sm"
                        >
                          <div className="flex items-center gap-2 text-ink-muted">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>
                              {r.startDate.slice(0, 10)} → {r.endDate.slice(0, 10)}
                            </span>
                            {r.minNights ? (
                              <span className="rounded-full bg-sun-50 px-2 py-0.5 text-xs text-sun-600">
                                Min {r.minNights} nights
                              </span>
                            ) : null}
                            {!r.active && (
                              <span className="rounded-full bg-cream-200 px-2 py-0.5 text-xs text-ink-muted">
                                Disabled
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-semibold text-forest-800">
                              {formatINR(r.rate)}
                            </span>
                            <button
                              onClick={() => removeRate(r.id)}
                              className="text-red-600 hover:bg-red-50 rounded-pill p-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Photos */}
              <PhotoStrip
                roomTypeId={rt.id}
                photos={rt.photos ?? []}
                onAdd={addPhoto}
                onRemove={removePhoto}
              />
            </article>
          ))}
        </div>
      )}

      {/* Add-rate inline form */}
      <AnimatePresence>
        {newRateRoomTypeId && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="glass rounded-3xl p-6"
          >
            <div className="flex items-center justify-between">
              <p className="font-display text-lg text-ink">Add seasonal rate override</p>
              <button
                onClick={() => setNewRateRoomTypeId(null)}
                className="rounded-pill p-1.5 text-ink-muted hover:bg-cream-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              Overrides the base price for matching dates. Use for peak season, festivals, long weekends.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-5">
              <label className="block">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-ink-muted">Start</span>
                <input
                  className="field"
                  type="date"
                  value={newRateForm.startDate}
                  onChange={(e) => setNewRateForm({ ...newRateForm, startDate: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-ink-muted">End</span>
                <input
                  className="field"
                  type="date"
                  value={newRateForm.endDate}
                  onChange={(e) => setNewRateForm({ ...newRateForm, endDate: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-ink-muted">Rate (paise)</span>
                <input
                  className="field"
                  type="number"
                  value={newRateForm.rate}
                  onChange={(e) => setNewRateForm({ ...newRateForm, rate: e.target.value })}
                  placeholder="650000"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-ink-muted">Min nights</span>
                <input
                  className="field"
                  type="number"
                  value={newRateForm.minNights}
                  onChange={(e) => setNewRateForm({ ...newRateForm, minNights: e.target.value })}
                  placeholder="optional"
                />
              </label>
              <div className="flex items-end gap-2">
                <Button onClick={addRate} className="w-full gap-2">
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
            </div>
            <p className="mt-2 text-xs text-ink-muted">
              Tip: rate is in paise. ₹6,500 = 650000.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

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
                  Edit {editing.rt.name}
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
                <Field label="Name" required>
                  <input className="field" value={editing.form.name} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, name: e.target.value } })} />
                </Field>
                <Field label="Slug (read-only)">
                  <input className="field bg-cream-50 font-mono text-xs" value={editing.rt.slug} readOnly />
                </Field>
                <Field label="Tagline" full>
                  <input className="field" value={editing.form.shortDesc} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, shortDesc: e.target.value } })} />
                </Field>
                <Field label="Description" full>
                  <textarea className="field min-h-[100px] resize-none" value={editing.form.description} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, description: e.target.value } })} />
                </Field>
                <Field label="Base price (paise)" required>
                  <input
                    className="field font-mono"
                    type="number"
                    min="0"
                    value={editing.form.basePrice}
                    onChange={(e) => setEditing({ ...editing, form: { ...editing.form, basePrice: e.target.value } })}
                  />
                  <p className="mt-1 text-xs text-ink-muted">
                    ≈ ₹{editing.form.basePrice ? (parseInt(editing.form.basePrice, 10) / 100).toFixed(2) : "0"}/night
                  </p>
                </Field>
                <Field label="Total units">
                  <input className="field" type="number" min="1" value={editing.form.totalUnits} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, totalUnits: e.target.value } })} />
                </Field>
                <Field label="Max adults">
                  <input className="field" type="number" min="1" value={editing.form.maxAdults} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, maxAdults: e.target.value } })} />
                </Field>
                <Field label="Max children">
                  <input className="field" type="number" min="0" value={editing.form.maxChildren} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, maxChildren: e.target.value } })} />
                </Field>
                <Field label="Max occupancy">
                  <input className="field" type="number" min="1" value={editing.form.maxOccupancy} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, maxOccupancy: e.target.value } })} />
                </Field>
                <Field label="Bed configuration">
                  <input className="field" value={editing.form.bedConfiguration} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, bedConfiguration: e.target.value } })} placeholder="1 King Bed" />
                </Field>
                <Field label="Area (sq.ft)">
                  <input className="field" type="number" min="0" value={editing.form.areaSqft} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, areaSqft: e.target.value } })} placeholder="250" />
                </Field>
                <Field label="View">
                  <input className="field" value={editing.form.view} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, view: e.target.value } })} placeholder="Mountain" />
                </Field>
                <Field label="Status">
                  <select
                    className="field"
                    value={editing.form.status}
                    onChange={(e) => setEditing({ ...editing, form: { ...editing.form, status: e.target.value as "ACTIVE" | "HIDDEN" | "ARCHIVED" } })}
                  >
                    <option value="ACTIVE">Active (public)</option>
                    <option value="HIDDEN">Hidden (admin only)</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </Field>
              </div>

              <div className="mt-8 flex items-center justify-end gap-2 border-t border-border-soft pt-6">
                <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={saveEdit} disabled={saving} className="gap-2">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save changes
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PhotoStrip({
  roomTypeId,
  photos,
  onAdd,
  onRemove,
}: {
  roomTypeId: string;
  photos: Array<{ id: string; url: string; alt?: string | null; isCover: boolean; displayOrder: number }>;
  onAdd: (roomTypeId: string, url: string, alt: string, isCover: boolean) => Promise<void>;
  onRemove: (roomTypeId: string, photoId: string) => Promise<void>;
}) {
  const [url, setUrl] = useState("");
  const [alt, setAlt] = useState("");
  const [adding, setAdding] = useState(false);
  return (
    <div className="mt-5 border-t border-border-soft pt-4">
      <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">
        Photos ({photos.length})
      </p>
      <div className="mt-2 flex flex-wrap gap-3">
        {photos.map((p) => (
          <div
            key={p.id}
            className="group relative h-20 w-28 overflow-hidden rounded-xl border border-border-soft bg-cream-100"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.alt ?? ""} className="h-full w-full object-cover" />
            {p.isCover && (
              <div className="absolute left-1 top-1 rounded-full bg-forest-800/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                Cover
              </div>
            )}
            <button
              onClick={() => onRemove(roomTypeId, p.id)}
              className="absolute right-1 top-1 hidden rounded-full bg-red-600/90 p-1 text-white group-hover:block"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <div className="flex h-20 w-28 items-center justify-center rounded-xl border border-dashed border-border-soft text-ink-muted">
          {adding ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await onAdd(roomTypeId, url, alt, false);
                setUrl("");
                setAlt("");
                setAdding(false);
              }}
              className="w-full space-y-1 px-1.5"
            >
              <input
                autoFocus
                className="w-full rounded border border-border-soft px-1 py-0.5 text-xs"
                placeholder="Image URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
              <input
                className="w-full rounded border border-border-soft px-1 py-0.5 text-xs"
                placeholder="Alt text"
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
              />
              <div className="flex gap-1">
                <button type="submit" className="flex-1 rounded bg-forest-800 px-1 py-0.5 text-xs text-white">Add</button>
                <button type="button" onClick={() => setAdding(false)} className="rounded px-1 py-0.5 text-xs text-ink-muted">×</button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="flex flex-col items-center gap-0.5 text-xs"
            >
              <ImageIcon className="h-4 w-4" />
              Add
            </button>
          )}
        </div>
      </div>
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
