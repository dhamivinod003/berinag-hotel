import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/sections/PageHero";
import { Button } from "@/components/ui/Button";
import { Tag, Calendar, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Offers & Packages",
  description:
    "Seasonal offers, long-stay discounts, and family packages at Sun & Water Resort.",
};

const OFFERS = [
  {
    title: "Stay 3, Pay 2 Nights",
    desc: "Book three consecutive nights in any room category and pay for only two. The third night is on us.",
    validTill: "Valid until 30 Sep 2026",
    image:
      "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=80",
    badge: "−33%",
    cta: "Book this offer",
  },
  {
    title: "Himalayan Honeymoon",
    desc: "Two nights in a Luxury Cottage with a private candle-lit dinner, a couples' spa session, and a late checkout.",
    validTill: "Year-round, on request",
    image:
      "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80",
    badge: "Couples",
    cta: "Plan your honeymoon",
  },
  {
    title: "Family Week",
    desc: "Five nights in a Family Suite with breakfast and dinner included for up to four guests, plus a free bonfire evening.",
    validTill: "Valid on weekdays",
    image:
      "https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1200&q=80",
    badge: "Families",
    cta: "Book Family Week",
  },
  {
    title: "Early Bird 2026",
    desc: "Book at least 60 days in advance and get 15% off the best available rate. Combinable with the long-stay offer.",
    validTill: "For stays Jan–Mar 2026",
    image:
      "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80",
    badge: "−15%",
    cta: "Plan ahead",
  },
];

export default function OffersPage() {
  return (
    <>
      <PageHero
        eyebrow="Special offers"
        title="Packages & seasonal offers"
        subtitle="A handful of ways to make the most of your stay. All combinable where noted."
      />
      <section className="bg-page pb-20 sm:pb-24 lg:pb-32">
        <Container>
          <div className="grid gap-6 md:grid-cols-2">
            {OFFERS.map((o, i) => (
              <article
                key={o.title}
                className="group overflow-hidden rounded-3xl border border-border-soft bg-card shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
              >
                <div className="relative aspect-[16/9] overflow-hidden">
                  <Image
                    src={o.image}
                    alt={o.title}
                    fill
                    sizes="(min-width: 768px) 50vw, 100vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute left-4 top-4">
                    <span className="inline-flex items-center gap-1.5 rounded-pill bg-white/95 px-3 py-1.5 text-xs font-semibold text-forest-800 shadow-soft backdrop-blur-sm">
                      <Tag className="h-3 w-3" />
                      {o.badge}
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="font-display text-2xl font-normal text-ink">
                    {o.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                    {o.desc}
                  </p>
                  <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                    <Calendar className="h-3.5 w-3.5" />
                    {o.validTill}
                  </p>
                  <div className="mt-6 flex items-center justify-between border-t border-border-soft/70 pt-4">
                    <Link href="/booking">
                      <Button size="md" variant="primary" className="gap-2">
                        {o.cta}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
