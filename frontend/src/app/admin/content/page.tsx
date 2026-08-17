"use client";

import { useEffect, useState, useCallback } from "react";
import { Image as ImageIcon, Save, AlertCircle, CheckCircle2 } from "lucide-react";
import { adminGetHero, adminUpdateHero, ApiError } from "@/lib/api";

export default function ContentPage() {
  const [hero, setHero] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const h = await adminGetHero();
      setHero(h);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!hero) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await adminUpdateHero(hero);
      setMessage({ kind: "ok", text: "Hero saved. Frontend will reflect changes on next page load." });
    } catch (err) {
      setMessage({ kind: "err", text: err instanceof ApiError ? err.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="skeleton h-96" />;

  return (
    <div className="space-y-6">
      <div>
        <p className="font-display text-3xl text-ink">Website Content</p>
        <p className="mt-1 text-sm text-ink-muted">Edit what the public website displays. Changes are live immediately.</p>
      </div>

      {error && <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-900">{error}</div>}

      {message && (
        <div
          className={`flex items-center gap-2 rounded-2xl border p-3 text-sm ${
            message.kind === "ok" ? "border-forest-200 bg-forest-50 text-forest-900" : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.kind === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      <form onSubmit={save} className="space-y-6">
        <section className="rounded-3xl border border-border-soft bg-card p-5 shadow-soft lg:p-6">
          <h2 className="mb-1 font-display text-xl text-ink">Homepage Hero</h2>
          <p className="mb-4 text-sm text-ink-muted">The big banner at the top of the homepage.</p>

          {hero ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Headline" full>
                <input
                  className="field"
                  value={hero.headline ?? ""}
                  onChange={(e) => setHero({ ...hero, headline: e.target.value })}
                  required
                />
              </Field>
              <Field label="Subheadline" full>
                <textarea
                  className="field resize-none"
                  rows={2}
                  value={hero.subheadline ?? ""}
                  onChange={(e) => setHero({ ...hero, subheadline: e.target.value })}
                />
              </Field>
              <Field label="Image URL" full>
                <input
                  className="field"
                  value={hero.imageUrl ?? ""}
                  onChange={(e) => setHero({ ...hero, imageUrl: e.target.value })}
                  required
                />
              </Field>
              <Field label="Primary CTA label">
                <input
                  className="field"
                  value={hero.primaryCtaLabel ?? ""}
                  onChange={(e) => setHero({ ...hero, primaryCtaLabel: e.target.value })}
                  required
                />
              </Field>
              <Field label="Primary CTA link">
                <input
                  className="field"
                  value={hero.primaryCtaHref ?? ""}
                  onChange={(e) => setHero({ ...hero, primaryCtaHref: e.target.value })}
                  required
                />
              </Field>
              <Field label="Secondary CTA label">
                <input
                  className="field"
                  value={hero.secondaryCtaLabel ?? ""}
                  onChange={(e) => setHero({ ...hero, secondaryCtaLabel: e.target.value })}
                />
              </Field>
              <Field label="Secondary CTA link">
                <input
                  className="field"
                  value={hero.secondaryCtaHref ?? ""}
                  onChange={(e) => setHero({ ...hero, secondaryCtaHref: e.target.value })}
                />
              </Field>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">No hero set yet. Create one below.</p>
          )}
          <div className="mt-4">
            <button
              type="submit"
              disabled={saving || !hero}
              className="pill bg-forest-800 text-white hover:bg-forest-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save Hero"}
            </button>
          </div>
        </section>
      </form>
    </div>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <label className={full ? "sm:col-span-2 block" : "block"}>
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-muted">{label}</span>
      {children}
    </label>
  );
}
