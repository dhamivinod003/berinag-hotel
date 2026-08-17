"use client";

import { useEffect, useState } from "react";
import {
  Save,
  AlertCircle,
  CheckCircle2,
  Building2,
  Phone,
  Mail,
  MapPin,
  Clock,
  IndianRupee,
  Globe,
  CreditCard,
  MessageCircle,
} from "lucide-react";
import { adminGetSettings, adminUpdateSettings, ApiError } from "@/lib/api";

interface Settings {
  // Resort info
  "resort.name"?: string;
  "resort.tagline"?: string;
  "resort.address"?: string;
  "resort.city"?: string;
  "resort.state"?: string;
  "resort.country"?: string;
  "resort.pincode"?: string;
  "resort.phone"?: string;
  "resort.email"?: string;
  "resort.whatsapp"?: string;
  "resort.timezone"?: string;
  "resort.checkin_time"?: string;
  "resort.checkout_time"?: string;
  "resort.late_checkout_fee_pct"?: number;
  // Booking rules
  "booking.hold_minutes"?: number;
  "booking.min_nights"?: number;
  "booking.max_nights"?: number;
  "booking.allow_pending_balance"?: boolean;
  // Cancellation
  "cancellation.free_until_hours"?: number;
  "cancellation.partial_charge_pct"?: number;
  // Children / extra bed
  "policy.children_free_age"?: number;
  "policy.extra_bed_charge_paise"?: number;
  "policy.max_occupancy_default"?: number;
  // Tax
  "tax.gst_pct"?: number;
  "tax.service_charge_pct"?: number;
  "currency.code"?: string;
  "currency.symbol"?: string;
  // Payment
  "payment.razorpay_enabled"?: boolean;
  "payment.cod_allowed"?: boolean;
  // Notifications
  "notify.email_enabled"?: boolean;
  "notify.whatsapp_enabled"?: boolean;
  "notify.send_booking_confirmation"?: boolean;
  "notify.send_payment_receipt"?: boolean;
  "notify.send_cancellation"?: boolean;
  "notify.send_extension"?: boolean;
  // Website
  "site.url"?: string;
  "site.og_image"?: string;
  [key: string]: unknown;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    adminGetSettings()
      .then((data) => setSettings(data as Settings))
      .catch((err) => {
        if (err instanceof ApiError) setMessage({ kind: "err", text: err.message });
      })
      .finally(() => setLoading(false));
  }, []);

  const update = (key: keyof Settings, value: Settings[keyof Settings]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await adminUpdateSettings(settings);
      setMessage({ kind: "ok", text: "Settings saved." });
    } catch (err) {
      setMessage({ kind: "err", text: err instanceof ApiError ? err.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-10 text-center text-ink-muted">Loading…</div>;

  return (
    <div className="space-y-6">
      <div>
        <p className="font-display text-3xl text-ink">Settings</p>
        <p className="mt-1 text-sm text-ink-muted">
          Resort configuration. Changes apply to the live system.
        </p>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 rounded-2xl border p-3 text-sm ${
            message.kind === "ok"
              ? "border-forest-200 bg-forest-50 text-forest-900"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.kind === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      <form onSubmit={save} className="space-y-6">
        {/* Resort information */}
        <Section title="Resort information" icon={<Building2 className="h-4 w-4" />}>
          <SettingInput
            label="Resort name"
            value={settings["resort.name"] ?? ""}
            onChange={(v) => update("resort.name", v)}
            full
          />
          <SettingInput
            label="Tagline"
            value={settings["resort.tagline"] ?? ""}
            onChange={(v) => update("resort.tagline", v)}
            full
          />
          <SettingInput
            label="Address"
            value={settings["resort.address"] ?? ""}
            onChange={(v) => update("resort.address", v)}
            full
          />
          <SettingInput
            label="City"
            value={settings["resort.city"] ?? ""}
            onChange={(v) => update("resort.city", v)}
          />
          <SettingInput
            label="State"
            value={settings["resort.state"] ?? ""}
            onChange={(v) => update("resort.state", v)}
          />
          <SettingInput
            label="Country"
            value={settings["resort.country"] ?? "India"}
            onChange={(v) => update("resort.country", v)}
          />
          <SettingInput
            label="Pincode"
            value={settings["resort.pincode"] ?? ""}
            onChange={(v) => update("resort.pincode", v)}
          />
          <SettingInput
            label="Timezone"
            value={settings["resort.timezone"] ?? "Asia/Kolkata"}
            onChange={(v) => update("resort.timezone", v)}
          />
        </Section>

        {/* Contact */}
        <Section title="Contact" icon={<Phone className="h-4 w-4" />}>
          <SettingInput
            label="Phone (with country code)"
            value={settings["resort.phone"] ?? ""}
            placeholder="+91 98765 43210"
            onChange={(v) => update("resort.phone", v)}
          />
          <SettingInput
            label="Email"
            value={settings["resort.email"] ?? ""}
            placeholder="info@example.com"
            onChange={(v) => update("resort.email", v)}
          />
          <SettingInput
            label="WhatsApp (digits only, with country code)"
            value={settings["resort.whatsapp"] ?? ""}
            placeholder="919876543210"
            onChange={(v) => update("resort.whatsapp", v)}
            full
          />
        </Section>

        {/* Check-in / check-out */}
        <Section title="Check-in / check-out" icon={<Clock className="h-4 w-4" />}>
          <SettingInput
            label="Check-in time"
            value={settings["resort.checkin_time"] ?? "14:00"}
            type="text"
            onChange={(v) => update("resort.checkin_time", v)}
          />
          <SettingInput
            label="Check-out time"
            value={settings["resort.checkout_time"] ?? "11:00"}
            type="text"
            onChange={(v) => update("resort.checkout_time", v)}
          />
          <SettingInput
            label="Late checkout fee (% of nightly rate)"
            value={settings["resort.late_checkout_fee_pct"] ?? 50}
            type="number"
            onChange={(v) => update("resort.late_checkout_fee_pct", v)}
          />
        </Section>

        {/* Booking rules */}
        <Section title="Booking rules">
          <SettingInput
            label="Hold duration (minutes)"
            value={settings["booking.hold_minutes"] ?? 10}
            type="number"
            onChange={(v) => update("booking.hold_minutes", v)}
          />
          <SettingInput
            label="Minimum nights"
            value={settings["booking.min_nights"] ?? 1}
            type="number"
            onChange={(v) => update("booking.min_nights", v)}
          />
          <SettingInput
            label="Maximum nights"
            value={settings["booking.max_nights"] ?? 30}
            type="number"
            onChange={(v) => update("booking.max_nights", v)}
          />
          <ToggleInput
            label="Allow pending balance (amountDue > 0)"
            value={Boolean(settings["booking.allow_pending_balance"] ?? true)}
            onChange={(v) => update("booking.allow_pending_balance", v)}
            full
          />
        </Section>

        {/* Cancellation */}
        <Section title="Cancellation policy">
          <SettingInput
            label="Free cancellation until (hours before check-in)"
            value={settings["cancellation.free_until_hours"] ?? 168}
            type="number"
            onChange={(v) => update("cancellation.free_until_hours", v)}
          />
          <SettingInput
            label="Partial charge between free window and 24h (%)"
            value={settings["cancellation.partial_charge_pct"] ?? 50}
            type="number"
            onChange={(v) => update("cancellation.partial_charge_pct", v)}
          />
        </Section>

        {/* Children / extra bed */}
        <Section title="Children & extra bed policy">
          <SettingInput
            label="Children stay free up to age"
            value={settings["policy.children_free_age"] ?? 5}
            type="number"
            onChange={(v) => update("policy.children_free_age", v)}
          />
          <SettingInput
            label="Extra bed charge (₹)"
            value={(settings["policy.extra_bed_charge_paise"] ?? 150000) / 100}
            type="number"
            onChange={(v) => update("policy.extra_bed_charge_paise", v * 100)}
          />
          <SettingInput
            label="Default max occupancy"
            value={settings["policy.max_occupancy_default"] ?? 3}
            type="number"
            onChange={(v) => update("policy.max_occupancy_default", v)}
          />
        </Section>

        {/* Tax & currency */}
        <Section title="Tax & currency" icon={<IndianRupee className="h-4 w-4" />}>
          <SettingInput
            label="GST %"
            value={settings["tax.gst_pct"] ?? 12}
            type="number"
            onChange={(v) => update("tax.gst_pct", v)}
          />
          <SettingInput
            label="Service charge %"
            value={settings["tax.service_charge_pct"] ?? 0}
            type="number"
            onChange={(v) => update("tax.service_charge_pct", v)}
          />
          <SettingInput
            label="Currency code"
            value={settings["currency.code"] ?? "INR"}
            onChange={(v) => update("currency.code", v)}
          />
          <SettingInput
            label="Currency symbol"
            value={settings["currency.symbol"] ?? "₹"}
            onChange={(v) => update("currency.symbol", v)}
          />
        </Section>

        {/* Payment */}
        <Section title="Payment" icon={<CreditCard className="h-4 w-4" />}>
          <ToggleInput
            label="Razorpay online payments"
            value={Boolean(settings["payment.razorpay_enabled"] ?? true)}
            onChange={(v) => update("payment.razorpay_enabled", v)}
          />
          <ToggleInput
            label="Allow pay-at-property (cash / card on arrival)"
            value={Boolean(settings["payment.cod_allowed"] ?? true)}
            onChange={(v) => update("payment.cod_allowed", v)}
          />
        </Section>

        {/* Notifications */}
        <Section title="Notification preferences" icon={<MessageCircle className="h-4 w-4" />}>
          <ToggleInput
            label="Email channel enabled"
            value={Boolean(settings["notify.email_enabled"] ?? true)}
            onChange={(v) => update("notify.email_enabled", v)}
          />
          <ToggleInput
            label="WhatsApp channel enabled"
            value={Boolean(settings["notify.whatsapp_enabled"] ?? false)}
            onChange={(v) => update("notify.whatsapp_enabled", v)}
          />
          <ToggleInput
            label="Send booking confirmation"
            value={Boolean(settings["notify.send_booking_confirmation"] ?? true)}
            onChange={(v) => update("notify.send_booking_confirmation", v)}
          />
          <ToggleInput
            label="Send payment receipt"
            value={Boolean(settings["notify.send_payment_receipt"] ?? true)}
            onChange={(v) => update("notify.send_payment_receipt", v)}
          />
          <ToggleInput
            label="Send cancellation email"
            value={Boolean(settings["notify.send_cancellation"] ?? true)}
            onChange={(v) => update("notify.send_cancellation", v)}
          />
          <ToggleInput
            label="Send extension confirmation"
            value={Boolean(settings["notify.send_extension"] ?? true)}
            onChange={(v) => update("notify.send_extension", v)}
          />
        </Section>

        {/* Website */}
        <Section title="Website" icon={<Globe className="h-4 w-4" />}>
          <SettingInput
            label="Public site URL"
            value={settings["site.url"] ?? ""}
            placeholder="https://example.com"
            onChange={(v) => update("site.url", v)}
          />
          <SettingInput
            label="Default OG / share image"
            value={settings["site.og_image"] ?? ""}
            placeholder="https://…/og.jpg"
            onChange={(v) => update("site.og_image", v)}
          />
        </Section>

        <div>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-full bg-forest px-5 py-2.5 text-sm font-medium text-white transition hover:bg-forest/90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Section({
  title,
  children,
  icon,
}: {
  title: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border-soft bg-white/70 p-5 backdrop-blur lg:p-6">
      <h2 className="mb-4 flex items-center gap-2 font-display text-xl text-ink">
        {icon}
        {title}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function SettingInput({
  label,
  value,
  type,
  onChange,
  placeholder,
  full,
}: {
  label: string;
  value: any;
  type?: "text" | "number";
  onChange: (v: any) => void;
  placeholder?: string;
  full?: boolean;
}) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-muted">
        {label}
      </span>
      <input
        type={type ?? "text"}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(type === "number" ? Number(e.target.value) : e.target.value)}
        className="w-full rounded-full border border-border-soft bg-card px-4 py-2 text-sm text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
      />
    </label>
  );
}

function ToggleInput({
  label,
  value,
  onChange,
  full,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  full?: boolean;
}) {
  return (
    <label
      className={`flex items-center justify-between rounded-2xl border border-border-soft bg-cream-50 p-3 ${
        full ? "sm:col-span-2" : ""
      }`}
    >
      <span className="text-sm text-ink">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 rounded-full transition-colors ${
          value ? "bg-forest" : "bg-border"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-transform ${
            value ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}
