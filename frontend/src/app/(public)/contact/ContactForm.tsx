"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Send, Check } from "lucide-react";

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    // TODO: wire to backend POST /api/public/enquiries
    await new Promise((r) => setTimeout(r, 600));
    setSubmitting(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-forest-200 bg-forest-50 p-8 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-pill bg-forest-800 text-white">
          <Check className="h-5 w-5" />
        </div>
        <h3 className="font-display text-xl text-ink">Message received</h3>
        <p className="max-w-sm text-sm text-ink-muted">
          Thanks for reaching out. We'll get back to you within a few hours.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Name" required>
        <input
          required
          name="name"
          type="text"
          placeholder="Your full name"
          className="field"
        />
      </Field>
      <Field label="Phone" required>
        <input
          required
          name="phone"
          type="tel"
          placeholder="+91 98765 43210"
          className="field"
        />
      </Field>
      <Field label="Email" full>
        <input
          name="email"
          type="email"
          placeholder="you@example.com"
          className="field"
        />
      </Field>
      <Field label="Preferred dates" full>
        <div className="grid grid-cols-2 gap-3">
          <input
            name="checkIn"
            type="date"
            className="field"
            placeholder="Check-in"
          />
          <input
            name="checkOut"
            type="date"
            className="field"
            placeholder="Check-out"
          />
        </div>
      </Field>
      <Field label="Message" full>
        <textarea
          name="message"
          rows={4}
          placeholder="Tell us what you're planning — a weekend, a wedding, a quiet work retreat…"
          className="field resize-none"
        />
      </Field>
      <div className="sm:col-span-2">
        <Button
          type="submit"
          size="lg"
          variant="primary"
          className="gap-2"
          isLoading={submitting}
        >
          Send Message
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </form>
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
        {required && <span className="text-forest-800"> *</span>}
      </span>
      {children}
    </label>
  );
}
