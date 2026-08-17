"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  X,
  Image as ImageIcon,
  Trash2,
  Loader2,
  Star,
  Tag,
} from "lucide-react";
import {
  adminAddGalleryImage,
  adminDeleteGalleryImage,
  ApiError,
} from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { GlassPanel } from "@/components/ui/GlassPanel";

type GalleryImage = {
  id: string;
  url: string;
  alt?: string | null;
  caption?: string | null;
  isFeatured: boolean;
  categoryId: string;
};

export default function GalleryPage() {
  const [items, setItems] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    url: "",
    alt: "",
    caption: "",
    categorySlug: "resort",
    isFeatured: false,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      // The public gallery endpoint returns the visible images.
      const r = await fetch("/api/public/gallery").then((r) => r.json());
      setItems((r.items ?? []) as GalleryImage[]);
    } catch {
      // If no endpoint, leave empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    if (!form.url) {
      setError("Image URL is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await adminAddGalleryImage({
        url: form.url,
        alt: form.alt || undefined,
        caption: form.caption || undefined,
        categorySlug: form.categorySlug,
        isFeatured: form.isFeatured,
      });
      setForm({ url: "", alt: "", caption: "", categorySlug: "resort", isFeatured: false });
      setAdding(false);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Add failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this image from the gallery?")) return;
    setDeleting(id);
    try {
      await adminDeleteGalleryImage(id);
      await load();
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
          <p className="font-display text-3xl text-ink">Gallery</p>
          <p className="mt-1 text-sm text-ink-muted">
            Photos that appear on the public /gallery page and in the home page grid.
          </p>
        </div>
        <Button onClick={() => setAdding(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add photo
        </Button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</div>
      )}

      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            <GlassPanel className="p-6">
              <div className="flex items-center justify-between">
                <p className="font-display text-lg text-ink">Add gallery photo</p>
                <button
                  onClick={() => setAdding(false)}
                  className="rounded-pill p-1.5 text-ink-muted hover:bg-cream-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Image URL" required full>
                  <input
                    className="field"
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                    placeholder="https://images.unsplash.com/photo-…?w=1600"
                  />
                </Field>
                <Field label="Alt text">
                  <input
                    className="field"
                    value={form.alt}
                    onChange={(e) => setForm({ ...form, alt: e.target.value })}
                    placeholder="Mountain view at sunrise"
                  />
                </Field>
                <Field label="Caption">
                  <input
                    className="field"
                    value={form.caption}
                    onChange={(e) => setForm({ ...form, caption: e.target.value })}
                    placeholder="Optional caption"
                  />
                </Field>
                <Field label="Category">
                  <select
                    className="field"
                    value={form.categorySlug}
                    onChange={(e) => setForm({ ...form, categorySlug: e.target.value })}
                  >
                    <option value="resort">Resort</option>
                    <option value="rooms">Rooms</option>
                    <option value="dining">Dining</option>
                    <option value="experiences">Experiences</option>
                    <option value="general">General</option>
                  </select>
                </Field>
                <Field label="Featured">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.isFeatured}
                      onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
                    />
                    Show on home page
                  </label>
                </Field>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAdding(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={add} disabled={saving} className="gap-2">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Add photo
                </Button>
              </div>
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="skeleton h-64" />
      ) : items.length === 0 ? (
        <GlassPanel className="p-10 text-center">
          <ImageIcon className="mx-auto h-8 w-8 text-ink-muted" />
          <p className="mt-3 text-ink-muted">No gallery photos yet.</p>
          <Button onClick={() => setAdding(true)} variant="outline" className="mt-4 gap-2">
            <Plus className="h-4 w-4" />
            Add your first photo
          </Button>
        </GlassPanel>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((img) => (
            <div
              key={img.id}
              className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-border-soft bg-cream-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.alt ?? ""}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              {img.isFeatured && (
                <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-pill bg-forest-800/90 px-2 py-0.5 text-xs font-semibold text-white">
                  <Star className="h-3 w-3" />
                  Featured
                </div>
              )}
              {img.caption && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 text-xs text-white">
                  {img.caption}
                </div>
              )}
              <button
                onClick={() => remove(img.id)}
                disabled={deleting === img.id}
                className="absolute right-2 top-2 hidden rounded-pill bg-red-600/90 p-1.5 text-white group-hover:flex"
              >
                {deleting === img.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
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
