import type { Metadata } from "next";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Clock,
  IdCard,
  CigaretteOff,
  UtensilsCrossed,
  Moon,
  Waves,
  PawPrint,
  Users,
  Wine,
  Leaf,
  Camera,
  Home,
  Mountain,
} from "lucide-react";
import {
  LegalPage,
  LegalReveal,
  LegalProse,
} from "@/components/sections/LegalPage";

export const metadata: Metadata = {
  title: "House Rules",
  description:
    "Check-in and check-out times, ID requirements, smoking, visitors, and guest conduct at Sun & Water Resort, Pithoragarh.",
};

const FEATURED: {
  icon: LucideIcon;
  title: string;
  body: string[];
}[] = [
  {
    icon: Clock,
    title: "Check-in / Check-out times",
    body: [
      "Check-in from 14:00. Rooms are rarely ready earlier than this.",
      "Check-out by 11:00. Late check-out is complimentary when the next booking allows — please ask the night before.",
      "Early arrivals can leave bags at reception and use the garden, restaurant, and common areas.",
    ],
  },
  {
    icon: IdCard,
    title: "ID proof required",
    body: [
      "Indian hotel regulations require a government-issued photo ID for every adult guest at check-in. A passport, Aadhaar, driving licence, or voter ID is fine. Please bring the original. We take a copy for the guest register and do not share it except as required by law.",
      "Unmarried couples are welcome. We do not ask invasive questions. We do need valid ID that matches the names on the booking.",
    ],
  },
  {
    icon: CigaretteOff,
    title: "No smoking",
    body: [
      "All rooms and indoor public spaces are non-smoking. Please use the designated outdoor spots. A deep-clean charge applies if a room smells of smoke.",
    ],
  },
  {
    icon: UtensilsCrossed,
    title: "No outside food",
    body: [
      "Outside food is not allowed in the restaurant. In-room snacks from the market are fine; please do not cook in the rooms.",
    ],
  },
  {
    icon: Moon,
    title: "Quiet hours",
    body: [
      "Quiet hours are 22:00–07:00. Music and loud conversation should stay indoors and low after 22:00.",
    ],
  },
  {
    icon: Waves,
    title: "Pool rules",
    body: [
      "The pool is typically open 07:00–19:00. There is no lifeguard — children must be with an adult.",
    ],
  },
  {
    icon: PawPrint,
    title: "Pets",
    body: [
      "Pets are not permitted in rooms or the restaurant, except trained service animals arranged in advance.",
    ],
  },
];

const MORE: { icon: LucideIcon; title: string; body: string[] }[] = [
  {
    icon: Users,
    title: "Who may stay",
    body: [
      "Room occupancy must stay within the limit published for that room type.",
      "Children are welcome. Extra beds and cots are subject to availability and may carry a charge.",
      "Day visitors should be introduced at reception. Overnight visitors who are not on the booking need a room of their own.",
    ],
  },
  {
    icon: Wine,
    title: "Drink",
    body: [
      "Alcohol may be enjoyed in your room or at the bar, in line with Uttarakhand law. Please do not drink in the pool area or garden after quiet hours.",
    ],
  },
  {
    icon: Leaf,
    title: "The grounds",
    body: [
      "Please do not feed wildlife, pick plants, or light fires except at the staff-run bonfire.",
    ],
  },
  {
    icon: Camera,
    title: "Drones",
    body: ["Drones need prior written permission from the manager."],
  },
  {
    icon: Home,
    title: "Care of the room",
    body: [
      "Treat the room as you would a well-loved family house. Damage beyond ordinary wear, missing items, or a room left in a state that needs specialist cleaning will be charged at cost, and we will tell you before we take the payment. Report anything broken as soon as you notice it — we would rather fix it than bill you.",
    ],
  },
];

function RuleCard({
  icon: Icon,
  title,
  body,
  delay,
}: {
  icon: LucideIcon;
  title: string;
  body: string[];
  delay: number;
}) {
  return (
    <LegalReveal delay={delay}>
      <article className="flex h-full flex-col rounded-3xl border border-white/50 bg-white/75 p-6 shadow-soft backdrop-blur-xl">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-forest-50 text-forest-800 shadow-soft">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <h3 className="mt-4 font-display text-xl font-normal text-ink">
          {title}
        </h3>
        <div className="mt-2 space-y-2 text-sm leading-relaxed text-ink-muted">
          {body.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </article>
    </LegalReveal>
  );
}

export default function HouseRulesPage() {
  return (
    <LegalPage
      eyebrow="Policies"
      title="House rules"
      subtitle="A small property works when everyone treats it like a shared home. These are the courtesies we ask of every guest — and the ones we hold ourselves to."
      currentPath="/house-rules"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {FEATURED.map((rule, i) => (
          <RuleCard key={rule.title} {...rule} delay={i * 0.05} />
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {MORE.map((rule, i) => (
          <RuleCard key={rule.title} {...rule} delay={i * 0.05} />
        ))}
      </div>

      <LegalReveal>
        <div className="rounded-3xl border border-sun-200/70 bg-sun-50/80 p-6 shadow-soft sm:p-8">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-card text-forest-800 shadow-soft">
              <Mountain className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="font-display text-2xl font-normal text-ink">
                Safety in the hills
              </h2>
              <LegalProse className="mt-3">
                <p>
                  Paths, terraces, and the pool can be wet and uneven. Wear shoes with
                  grip after rain. Do not walk to the river or nearby trails after
                  dark without telling reception. The resort is not liable for
                  unsupervised outdoor activity — see our{" "}
                  <Link
                    href="/terms"
                    className="font-medium text-forest-800 underline underline-offset-2"
                  >
                    terms of service
                  </Link>
                  .
                </p>
              </LegalProse>
            </div>
          </div>
        </div>
      </LegalReveal>
    </LegalPage>
  );
}
