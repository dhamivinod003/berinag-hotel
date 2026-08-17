"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Star,
  Plus,
  Trash2,
  Edit3,
  X,
  Save,
  Check,
  CheckCircle2,
  XCircle,
  Filter,
  Search,
  ExternalLink,
} from "lucide-react";
import {
  adminListReviews,
  adminCreateReview,
  adminUpdateReview,
  adminDeleteReview,
  type ReviewDto,
  type ReviewSource,
  type ReviewInput,
} from "@/lib/api";

const SOURCES: { value: ReviewSource; label: string; color: string }[] = [
  { value: "GOOGLE", label: "Google", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "DIRECT", label: "Direct", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "WEBSITE", label: "Website", color: "bg-violet-50 text-violet-700 border-violet-200" },
  { value: "TRIPADVISOR", label: "TripAdvisor", color: "bg-lime-50 text-lime-700 border-lime-200" },
  { value: "MAKEMYTRIP", label: "MakeMyTrip", color: "bg-orange-50 text-orange-700 border-orange-200" },
  { value: "OTHER", label: "Other", color: "bg-slate-50 text-slate-700 border-slate-200" },
];

const emptyForm: ReviewInput = {
  source: "WEBSITE",
  authorName: "",
  rating: 5,
  body: "",
  status: "DRAFT",
  isFeatured: false,
};

export default function ReviewsPage() {
  const [items, setItems] = useState<ReviewDto[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterSource, setFilterSource] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ReviewDto | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const opts: { source?: string; status?: "DRAFT" | "PUBLISHED"; q?: string } = {};
      if (filterSource) opts.source = filterSource;
      if (filterStatus === "DRAFT" || filterStatus === "PUBLISHED") opts.status = filterStatus;
      if (search) opts.q = search;
      const json = await adminListReviews(opts);
      setItems(json.items);
      setTotal(json.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [filterSource, filterStatus, search]);

  useEffect(() => {
    const t = setTimeout(fetchList, 250);
    return () => clearTimeout(t);
  }, [fetchList]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this review? This cannot be undone.")) return;
    try {
      await adminDeleteReview(id);
      await fetchList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const handlePublishToggle = async (r: ReviewDto) => {
    try {
      await adminUpdateReview(r.id, {
        source: r.source as ReviewSource,
        authorName: r.authorName,
        rating: r.rating,
        body: r.content,
        status: r.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED",
        isFeatured: r.isFeatured,
        sourceUrl: r.sourceUrl,
        authorAvatar: r.authorAvatar,
        stayDate: r.reviewDate,
      });
      await fetchList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  };

  const handleFeatureToggle = async (r: ReviewDto) => {
    try {
      await adminUpdateReview(r.id, {
        source: r.source as ReviewSource,
        authorName: r.authorName,
        rating: r.rating,
        body: r.content,
        status: r.status,
        isFeatured: !r.isFeatured,
        sourceUrl: r.sourceUrl,
        authorAvatar: r.authorAvatar,
        stayDate: r.reviewDate,
      });
      await fetchList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="font-display text-3xl text-ink">Reviews & Testimonials</p>
          <p className="mt-1 text-sm text-ink-muted">
            Moderate guest reviews. Only <strong>approved</strong> reviews are shown publicly.
            Each review keeps a truthful <strong>source</strong> label so internal testimonials
            are never mislabeled as Google.
          </p>
        </div>
        <button
          onClick={() => {
            setCreating(true);
            setEditing(null);
          }}
          className="flex items-center gap-2 rounded-full bg-forest px-4 py-2 text-sm font-medium text-white transition hover:bg-forest/90"
        >
          <Plus className="h-4 w-4" />
          Add testimonial
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-border-soft bg-white/70 p-4 backdrop-blur">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search author, title, body…"
            className="w-full rounded-full border border-border-soft bg-card pl-10 pr-4 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
          />
        </div>
        <select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
          className="rounded-full border border-border-soft bg-card px-4 py-2 text-sm text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
        >
          <option value="">All sources</option>
          {SOURCES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-full border border-border-soft bg-card px-4 py-2 text-sm text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
        >
          <option value="">All status</option>
          <option value="PUBLISHED">Published</option>
          <option value="DRAFT">Draft</option>
        </select>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {loading && !items ? (
          <div className="col-span-full rounded-3xl border border-border-soft bg-white/70 p-10 text-center text-ink-muted">
            Loading…
          </div>
        ) : items && items.length === 0 ? (
          <div className="col-span-full rounded-3xl border border-border-soft bg-white/70 p-10 text-center text-ink-muted">
            No reviews yet. Click <strong>Add testimonial</strong> to create one.
          </div>
        ) : items ? (
          items.map((r) => {
            const sourceStyle = SOURCES.find((s) => s.value === r.source)?.color ?? "bg-slate-50 text-slate-700 border-slate-200";
            return (
              <div
                key={r.id}
                className="flex flex-col rounded-3xl border border-border-soft bg-white/70 p-5 backdrop-blur"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-forest/10 text-sm font-semibold text-forest">
                      {r.authorName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-ink">{r.authorName}</p>
                      <div className="mt-0.5 flex">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={`h-3.5 w-3.5 ${
                              n <= r.rating ? "fill-amber-400 text-amber-400" : "text-ink-muted/30"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  {r.isFeatured && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                      Featured
                    </span>
                  )}
                </div>
                <p className="mt-2 flex-1 text-sm text-ink-muted line-clamp-5">{r.content}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${sourceStyle}`}>
                    {SOURCES.find((s) => s.value === r.source)?.label ?? r.source}
                  </span>
                  {r.sourceUrl && (
                    <a
                      href={r.sourceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-xs text-forest hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Source
                    </a>
                  )}
                  {r.status === "PUBLISHED" ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" />
                      Published
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                      <XCircle className="h-3 w-3" />
                      Draft
                    </span>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-1 border-t border-border-soft pt-3">
                  <button
                    onClick={() => handlePublishToggle(r)}
                    className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-ink-muted hover:bg-emerald-50 hover:text-emerald-700"
                    title={r.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                  >
                    {r.status === "PUBLISHED" ? <XCircle className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                    {r.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                  </button>
                  <button
                    onClick={() => handleFeatureToggle(r)}
                    className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-ink-muted hover:bg-amber-50 hover:text-amber-700"
                  >
                    <Star className="h-3 w-3" />
                    {r.isFeatured ? "Unfeature" : "Feature"}
                  </button>
                  <button
                    onClick={() => {
                      setEditing(r);
                      setCreating(false);
                    }}
                    className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-ink-muted hover:bg-blue-50 hover:text-blue-700"
                  >
                    <Edit3 className="h-3 w-3" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="ml-auto flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-ink-muted hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        ) : null}
      </div>

      {items && (
        <p className="text-xs text-ink-muted">
          Showing {items.length} of {total} review{total === 1 ? "" : "s"}
        </p>
      )}

      {(creating || editing) && (
        <ReviewEditor
          review={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            fetchList();
          }}
        />
      )}
    </div>
  );
}

function ReviewEditor({
  review,
  onClose,
  onSaved,
}: {
  review: ReviewDto | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ReviewInput>(() =>
    review
      ? {
          source: review.source as ReviewSource,
          sourceUrl: review.sourceUrl,
          authorName: review.authorName,
          authorAvatar: review.authorAvatar,
          rating: review.rating,
          body: review.content,
          stayDate: review.reviewDate,
          status: review.status,
          isFeatured: review.isFeatured,
        }
      : emptyForm
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (review) {
        await adminUpdateReview(review.id, form);
      } else {
        await adminCreateReview(form);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-t-3xl sm:rounded-3xl bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border-soft p-5">
          <h2 className="font-display text-xl text-ink">
            {review ? "Edit review" : "Add testimonial"}
          </h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-surface-2">
            <X className="h-5 w-5 text-ink-muted" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-ink-muted">Source *</label>
              <select
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value as ReviewSource })}
                className="mt-1 w-full rounded-full border border-border-soft bg-card px-4 py-2 text-sm text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
              >
                {SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-ink-muted">
                Always shown on the public site. Choose <strong>WEBSITE</strong> or <strong>DIRECT</strong> for internal testimonials.
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-ink-muted">Rating *</label>
              <div className="mt-1 flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    type="button"
                    key={n}
                    onClick={() => setForm({ ...form, rating: n })}
                    className="p-1"
                  >
                    <Star
                      className={`h-6 w-6 transition ${
                        n <= form.rating ? "fill-amber-400 text-amber-400" : "text-ink-muted/30"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-ink-muted">Author name *</label>
              <input
                type="text"
                value={form.authorName}
                onChange={(e) => setForm({ ...form, authorName: e.target.value })}
                className="mt-1 w-full rounded-full border border-border-soft bg-card px-4 py-2 text-sm text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-muted">Avatar URL</label>
              <input
                type="text"
                value={form.authorAvatar ?? ""}
                onChange={(e) => setForm({ ...form, authorAvatar: e.target.value || null })}
                className="mt-1 w-full rounded-full border border-border-soft bg-card px-4 py-2 text-sm text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-ink-muted">Title (optional)</label>
            <input
              type="text"
              value={form.title ?? ""}
              onChange={(e) => setForm({ ...form, title: e.target.value || null })}
              className="mt-1 w-full rounded-full border border-border-soft bg-card px-4 py-2 text-sm text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-ink-muted">Body *</label>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={5}
              className="mt-1 w-full rounded-2xl border border-border-soft bg-card px-4 py-2 text-sm text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-ink-muted">Source URL</label>
              <input
                type="text"
                value={form.sourceUrl ?? ""}
                onChange={(e) => setForm({ ...form, sourceUrl: e.target.value || null })}
                placeholder="https://…"
                className="mt-1 w-full rounded-full border border-border-soft bg-card px-4 py-2 text-sm text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-muted">Stay date</label>
              <input
                type="date"
                value={form.stayDate ? form.stayDate.split("T")[0] : ""}
                onChange={(e) => setForm({ ...form, stayDate: e.target.value || null })}
                className="mt-1 w-full rounded-full border border-border-soft bg-card px-4 py-2 text-sm text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-surface-2/40 p-4">
            <label className="flex items-center gap-2 text-sm text-ink">
              <span className="text-xs text-ink-muted">Status:</span>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as "DRAFT" | "PUBLISHED" })}
                className="rounded-full border border-border-soft bg-card px-3 py-1 text-sm text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
              >
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published (visible on public site)</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
                className="h-4 w-4 rounded border-border-soft text-forest focus:ring-forest"
              />
              Featured
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border-soft p-4">
          <button
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm text-ink-muted hover:bg-surface-2"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.authorName || !form.body}
            className="flex items-center gap-2 rounded-full bg-forest px-4 py-2 text-sm font-medium text-white transition hover:bg-forest/90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
