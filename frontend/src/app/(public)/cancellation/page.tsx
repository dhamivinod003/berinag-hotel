import type { Metadata } from "next";
import Link from "next/link";
import { CloudRain } from "lucide-react";
import {
  LegalPage,
  LegalSection,
  LegalCallout,
  LegalReveal,
} from "@/components/sections/LegalPage";

export const metadata: Metadata = {
  title: "Cancellation & Refund Policy",
  description:
    "Free cancellation up to 7 days before check-in, partial refunds inside that window, and how no-shows are handled at Sun & Water Resort.",
};

const TIMELINE = [
  {
    when: "7+ days before check-in",
    detail: "Full refund. We cancel at no charge.",
    badge: "100% refund",
    tone: "forest" as const,
  },
  {
    when: "1–7 days before check-in",
    detail: "50% of the room charges are retained; the rest is refunded.",
    badge: "50% refund",
    tone: "sun" as const,
  },
  {
    when: "Less than 24 hours / no-show",
    detail: "No refund on unused nights, unless we can re-let the room.",
    badge: "No refund",
    tone: "ink" as const,
  },
];

const badgeClass = {
  forest: "bg-forest-800 text-white",
  sun: "bg-sun-400 text-ink",
  ink: "bg-ink text-inverse",
};

export default function CancellationPage() {
  return (
    <LegalPage
      eyebrow="Policies"
      title="Cancellation & refunds"
      subtitle="Clear windows, so you can plan a Himalayan trip without guessing what happens if plans change. These figures are the resort standard and can be edited as seasons change."
      currentPath="/cancellation"
    >
      <LegalReveal>
        <div className="relative grid gap-4 lg:grid-cols-3">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-[16%] right-[16%] top-[2.15rem] hidden h-px bg-gradient-to-r from-forest-800 via-sun-400 to-ink/70 lg:block"
          />
          {TIMELINE.map((step) => (
            <div
              key={step.when}
              className="relative rounded-3xl border border-white/50 bg-white/75 p-6 shadow-soft backdrop-blur-xl"
            >
              <span
                aria-hidden="true"
                className="absolute left-6 top-[1.85rem] hidden h-3 w-3 -translate-y-1/2 rounded-full border-2 border-white bg-forest-800 shadow-soft lg:left-1/2 lg:-translate-x-1/2 lg:block"
              />
              <p
                className={`inline-flex rounded-pill px-3 py-1 text-xs font-semibold tracking-wide ${badgeClass[step.tone]}`}
              >
                {step.badge}
              </p>
              <h3 className="mt-4 font-display text-xl font-normal text-ink">
                {step.when}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                {step.detail}
              </p>
            </div>
          ))}
        </div>
      </LegalReveal>

      <LegalCallout
        tone="sun"
        title="Weather, landslides, and force majeure"
        icon={<CloudRain className="h-5 w-5" strokeWidth={1.75} />}
      >
        <p>
          Mountain roads can close with little notice. If a government advisory,
          landslide, or similar event makes it genuinely impossible to reach the
          resort, we will move your dates at no charge, or refund in full if
          new dates do not work. We ask for the same understanding if we must
          close a room or the property for safety.
        </p>
      </LegalCallout>

      <LegalSection title="Standard cancellation window">
        <p>
          For bookings made on this website at the regular published rate, the
          following applies to the room charges (excluding any non-refundable
          extras you have already used):
        </p>
        <ul>
          <li>
            <strong className="font-medium text-ink">7 days or more</strong>{" "}
            before check-in — full refund. We cancel at no charge.
          </li>
          <li>
            <strong className="font-medium text-ink">
              Less than 7 days, more than 24 hours
            </strong>{" "}
            before check-in — 50% of the room charges are retained; the rest is
            refunded.
          </li>
          <li>
            <strong className="font-medium text-ink">
              Within 24 hours of check-in
            </strong>
            , or after the stay has begun — no refund on unused nights, unless
            we can re-let the room.
          </li>
        </ul>
        <p>
          “Check-in” means 14:00 on your arrival date, Asia/Kolkata time. The
          7-day and 24-hour windows are placeholders you can tighten or loosen
          later in this page and in the booking settings.
        </p>
      </LegalSection>

      <LegalSection title="How to cancel">
        <p>
          Write to us from the email or phone number on the booking, and
          include your booking reference. You can also call reception or use{" "}
          <Link
            href="/contact"
            className="font-medium text-forest-800 underline underline-offset-2"
          >
            the contact page
          </Link>
          . A cancellation is confirmed only when we reply in writing
          (email or WhatsApp).
        </p>
      </LegalSection>

      <LegalSection title="No-shows">
        <p>
          If you do not arrive and do not cancel, the booking is treated as a
          no-show. The full stay is charged and is not refundable. If you are
          delayed on the road — common in the hills — please call us. We will
          hold the room into the evening whenever we can.
        </p>
      </LegalSection>

      <LegalSection title="Changes and early departure">
        <p>
          Date changes are treated as a cancellation of the original nights plus
          a new booking, using the windows above. If you leave early, unused
          nights are refunded only if we can re-sell the room, and only after
          any applicable window has been applied.
        </p>
      </LegalSection>

      <LegalSection title="Offers, prepaid rates, and groups">
        <p>
          Advance-purchase, festival, and “non-refundable” rates follow the
          terms shown on the offer, not this page. Group bookings (typically 4
          or more rooms) and long stays may carry a different deposit and
          cancellation schedule, which we will put in writing before you pay.
        </p>
      </LegalSection>

      <LegalSection title="Refunds">
        <p>
          Approved refunds go back to the original payment method. Card and UPI
          payments collected through Razorpay usually take 5–10 business days
          to appear, depending on your bank. Cash or bank-transfer bookings are
          refunded to the account you nominate. We do not deduct a separate
          “processing fee” beyond what the cancellation window already retains.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
