import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, BadgeCheck, CreditCard, Scale } from "lucide-react";
import {
  LegalPage,
  LegalSection,
  LegalCallout,
  LegalReveal,
} from "@/components/sections/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Booking terms, acceptable use, and limitation of liability for Sun & Water Resort, Pithoragarh, Uttarakhand.",
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Policies"
      title="Terms of service"
      subtitle="The agreement that sits behind every reservation — written in plain language for a small resort in the Kumaon hills."
      currentPath="/terms"
    >
      <LegalReveal>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-forest-200/60 bg-forest-50/70 p-5 shadow-soft">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-card text-forest-800 shadow-soft">
              <BadgeCheck className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <p className="mt-3 text-sm font-medium text-ink">Age &amp; ID</p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
              You must be 18 or older to make a booking. Every adult guest must
              present valid government photo ID at check-in.
            </p>
          </div>
          <div className="rounded-3xl border border-sun-200/70 bg-sun-50/80 p-5 shadow-soft">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-card text-forest-800 shadow-soft">
              <CreditCard className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <p className="mt-3 text-sm font-medium text-ink">When it is confirmed</p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
              A reservation is confirmed only when we issue a booking reference
              and, for prepaid stays, when payment is captured.
            </p>
          </div>
          <div className="rounded-3xl border border-wave-500/20 bg-wave-500/10 p-5 shadow-soft">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-card text-forest-800 shadow-soft">
              <Scale className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <p className="mt-3 text-sm font-medium text-ink">Holds are not stays</p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
              A short hold on this website is not a confirmed stay. Holds expire
              if you do not finish guest details and payment in time.
            </p>
          </div>
        </div>
      </LegalReveal>

      <LegalCallout
        tone="sun"
        title="Outdoor activity and mountain risk"
        icon={<AlertTriangle className="h-5 w-5" strokeWidth={1.75} />}
      >
        <p>
          Outdoor activities, village walks, and any third-party treks or
          taxis you arrange are at your own risk. Follow local advice after
          rain or snowfall.
        </p>
      </LegalCallout>

      <LegalSection title="Agreement">
        <p>
          By browsing this website, holding a room, or completing a booking
          with Sun & Water Resort, Pithoragarh, you agree to these terms, our{" "}
          <Link
            href="/cancellation"
            className="font-medium text-forest-800 underline underline-offset-2"
          >
            cancellation policy
          </Link>
          ,{" "}
          <Link
            href="/house-rules"
            className="font-medium text-forest-800 underline underline-offset-2"
          >
            house rules
          </Link>
          , and{" "}
          <Link
            href="/privacy"
            className="font-medium text-forest-800 underline underline-offset-2"
          >
            privacy policy
          </Link>
          . If you book for other people, you confirm they will follow them too.
        </p>
      </LegalSection>

      <LegalSection title="Bookings">
        <ul>
          <li>
            A reservation is confirmed only when we issue a booking reference
            and, for prepaid stays, when payment is captured.
          </li>
          <li>
            A short hold on this website is not a confirmed stay. Holds expire
            if you do not finish guest details and payment in time.
          </li>
          <li>
            Rates are in Indian Rupees. Taxes (including GST) and any mandatory
            fees are shown before you pay. We do not honour screenshots of an
            old rate if the live price has changed before confirmation.
          </li>
          <li>
            You must be 18 or older to make a booking. Every adult guest must
            present valid government photo ID at check-in.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Payment">
        <p>
          Online payments are collected by Razorpay on our behalf. Failed,
          cancelled, or incomplete payments do not confirm a room. Chargebacks
          opened in error should be discussed with us first — we will refund
          through the official{" "}
          <Link
            href="/cancellation"
            className="font-medium text-forest-800 underline underline-offset-2"
          >
            cancellation
          </Link>{" "}
          path when a refund is due.
        </p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>You agree not to:</p>
        <ul>
          <li>Use a booking for any unlawful purpose, or bring prohibited items onto the property.</li>
          <li>Harass staff or other guests, or ignore reasonable instructions from reception.</li>
          <li>
            Scrape, overload, or attempt to break this website, or use it to
            send spam.
          </li>
          <li>
            Resell rooms as an unauthorised agent, or assign a booking without
            our written consent.
          </li>
        </ul>
        <p>
          We may cancel a stay without refund if these rules, or the{" "}
          <Link
            href="/house-rules"
            className="font-medium text-forest-800 underline underline-offset-2"
          >
            house rules
          </Link>
          , are seriously broken.
        </p>
      </LegalSection>

      <LegalSection title="The stay itself">
        <p>
          Descriptions, photographs, and amenities on this site are offered in
          good faith. Mountain weather, seasonal water, and maintenance can
          affect a view, a trail, or a facility on a given day. If something
          material is unavailable, we will say so and offer a fair alternative
          or a partial refund for that element.
        </p>
        <p>
          Outdoor activities, village walks, and any third-party treks or
          taxis you arrange are at your own risk. Follow local advice after
          rain or snowfall.
        </p>
      </LegalSection>

      <LegalSection title="Limitation of liability">
        <p>
          To the fullest extent permitted by Indian law, Sun & Water Resort is
          not liable for:
        </p>
        <ul>
          <li>Indirect or consequential loss, including missed onward travel.</li>
          <li>Loss or theft of valuables not deposited with reception.</li>
          <li>
            Injury or loss arising from unsupervised use of the pool, garden,
            paths, or nearby trails.
          </li>
          <li>
            Delay or failure caused by events outside our reasonable control
            (landslides, road closures, power or network outages, government
            orders).
          </li>
        </ul>
        <p>
          Our total liability for a booking is limited to the amount you paid
          us for that booking, except where the law does not allow a limit
          (including death or personal injury caused by our negligence).
        </p>
      </LegalSection>

      <LegalSection title="Intellectual property">
        <p>
          The Sun & Water name, this website, and its photographs and copy
          belong to the resort or its licensors. You may not copy them for
          commercial use without written permission.
        </p>
      </LegalSection>

      <LegalSection title="Governing law">
        <p>
          These terms are governed by the laws of India. Courts at Pithoragarh,
          Uttarakhand, have exclusive jurisdiction, without limiting any
          consumer-protection rights you have under Indian law.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          We may update these terms as the property or the law changes. The
          date at the top of this page is the version that applies to new
          bookings. A confirmed stay keeps the terms that were live when you
          paid, unless a change is required by law.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
