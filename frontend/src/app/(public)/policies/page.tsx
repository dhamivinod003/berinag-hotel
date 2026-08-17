import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  FileText,
  RefreshCcw,
  Home,
  Shield,
  Scale,
  BadgeCheck,
  IndianRupee,
  CreditCard,
  CalendarClock,
} from "lucide-react";
import {
  LegalPage,
  LegalReveal,
  LegalProse,
} from "@/components/sections/LegalPage";

export const metadata: Metadata = {
  title: "Policies",
  description:
    "Cancellation, house rules, privacy, and terms for a stay at Sun & Water Resort, Pithoragarh.",
};

const POLICIES = [
  {
    href: "/cancellation",
    icon: RefreshCcw,
    title: "Cancellation & refunds",
    body: "Free cancellation up to 7 days before check-in, with a clear schedule for later changes, no-shows, and refunds.",
  },
  {
    href: "/house-rules",
    icon: Home,
    title: "House rules",
    body: "Check-in times, ID at reception, smoking, visitors, and the small courtesies that keep the property peaceful.",
  },
  {
    href: "/privacy",
    icon: Shield,
    title: "Privacy policy",
    body: "What we collect when you book, how Razorpay handles payments, cookies, and your rights under Indian data law.",
  },
  {
    href: "/terms",
    icon: Scale,
    title: "Terms of service",
    body: "The booking contract: rates, acceptable use, outdoor activities, and the limits of our liability.",
  },
];

const PILLARS = [
  {
    icon: BadgeCheck,
    text: "Government-issued photo ID is required at check-in for every adult guest, as required for hotels in India.",
  },
  {
    icon: IndianRupee,
    text: "Published rates are in Indian Rupees and usually include GST unless a quote says otherwise.",
  },
  {
    icon: CreditCard,
    text: "Payments on this site are processed by Razorpay. We never see or store your full card number.",
  },
  {
    icon: CalendarClock,
    text: "Special offers, long-stay rates, and group bookings may carry their own cancellation window — we will say so before you pay.",
  },
];

export default function PoliciesPage() {
  return (
    <LegalPage
      eyebrow="Guest information"
      title="Resort policies"
      subtitle="A short map of how we host you — from booking and cancellation to privacy and house rules. Written for a small Himalayan resort, and easy to update as the property grows."
      currentPath="/policies"
    >
      <LegalReveal className="rounded-3xl border border-white/50 bg-white/70 p-6 shadow-soft backdrop-blur-xl sm:p-8">
        <h2 className="font-display text-2xl font-normal text-ink">
          How we look after a stay
        </h2>
        <LegalProse className="mt-3">
          <p>
            Sun & Water Resort is a family-run property in Pithoragarh,
            Uttarakhand. These pages cover the practical side of a booking:
            money, conduct, and personal data. They apply to stays reserved on
            this website, by phone, WhatsApp, or at reception, unless a written
            offer says otherwise.
          </p>
        </LegalProse>
      </LegalReveal>

      <ul className="grid gap-4 sm:grid-cols-2 sm:gap-5">
        {POLICIES.map((item, i) => (
          <li key={item.href}>
            <LegalReveal delay={i * 0.06}>
              <Link
                href={item.href}
                className="group liquid-sheen relative flex h-full items-start gap-4 rounded-3xl border border-white/50 bg-white/75 p-6 shadow-soft backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-forest-800/20 hover:shadow-lift sm:p-7"
              >
                <span className="liquid-sheen-track" aria-hidden="true" />
                <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-forest-50 text-forest-800 shadow-soft">
                  <item.icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-xl font-normal text-ink">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                    {item.body}
                  </p>
                </div>
                <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-forest-800 transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
            </LegalReveal>
          </li>
        ))}
      </ul>

      <LegalReveal delay={0.08}>
        <div className="rounded-3xl border border-white/50 bg-white/70 p-6 shadow-soft backdrop-blur-xl sm:p-8">
          <h2 className="font-display text-2xl font-normal text-ink">
            A few things that sit above every page
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {PILLARS.map((item) => (
              <li
                key={item.text}
                className="flex gap-3 rounded-2xl bg-cream-50/80 p-4"
              >
                <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-card text-forest-800 shadow-soft">
                  <item.icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <p className="text-sm leading-relaxed text-ink-muted">
                  {item.text}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </LegalReveal>

      <LegalReveal>
        <div className="rounded-3xl border border-forest-200/50 bg-forest-50/70 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-card text-forest-800 shadow-soft">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-xl font-normal text-ink">
                Need a copy or a clarification?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                Reception can walk you through any of these policies before you
                book, or after you arrive. Write to{" "}
                <a
                  href="mailto:info@sunandwaterresort.com"
                  className="font-medium text-forest-800 underline underline-offset-2"
                >
                  info@sunandwaterresort.com
                </a>{" "}
                or use the{" "}
                <Link
                  href="/contact"
                  className="font-medium text-forest-800 underline underline-offset-2"
                >
                  contact form
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </LegalReveal>
    </LegalPage>
  );
}
