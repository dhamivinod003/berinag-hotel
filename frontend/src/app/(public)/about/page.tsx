import type { Metadata } from "next";
import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/sections/PageHero";
import { Mountain, MapPin, Leaf, Users } from "lucide-react";
import { resort } from "@/lib/mock-data";

export const metadata: Metadata = {
  title: "About",
  description:
    "A small Himalayan resort in Pithoragarh, run by a family that grew up in the Kumaon hills.",
};

const HIGHLIGHTS = [
  { icon: Mountain, title: "In the Kumaon Himalayas", body: "1,650m above sea level, surrounded by oak and rhododendron." },
  { icon: Leaf, title: "Built for the climate", body: "Local stone and salvaged timber. No air-conditioning needed in summer." },
  { icon: Users, title: "Run by locals", body: "Twenty-eight of us, mostly from villages within 10 km of the property." },
  { icon: MapPin, title: "Close to everything", body: "Pithoragarh town is 12 km; the nearest treks begin from our front gate." },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="Our story"
        title="A Himalayan retreat that began as a family home"
        subtitle="Sun & Water started as a small guesthouse that the Negi family ran from their own house. Today it's a 22-room resort — but the same family still runs it, and most of the team has been with us since the start."
      />

      {/* Image + text */}
      <section className="bg-page py-12 sm:py-16">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-12">
            <div className="relative aspect-[4/5] overflow-hidden rounded-3xl lg:col-span-6">
              <Image
                src="https://images.unsplash.com/photo-1518733057094-95b53143d2a7?auto=format&fit=crop&w=1200&q=80"
                alt="Sun & Water Resort exterior at golden hour"
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
            <div className="lg:col-span-6">
              <h2 className="font-display text-3xl font-light text-ink sm:text-4xl text-balance">
                Slow mornings, warm tea, the sound of the wind.
              </h2>
              <p className="mt-5 text-base leading-relaxed text-ink-muted text-pretty">
                We host guests who want to slow down — to read a book in the
                garden, walk to a nearby village, share a meal with strangers
                who become friends. If you're looking for a property that
                maximises room count, we're not it. We're 22 rooms, a small
                restaurant, a pool, and 4.5 acres of garden.
              </p>
              <p className="mt-4 text-base leading-relaxed text-ink-muted text-pretty">
                What we do well, we hope, is the small things. A handwritten
                note on the bed. A pot of chai waiting after a long trek. The
                housekeeper who remembers your name on day two.
              </p>
            </div>
          </div>
        </Container>
      </section>

      {/* Property highlights */}
      <section className="bg-card py-20 sm:py-24">
        <Container>
          <div className="mb-12 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-forest-800">
              The property
            </p>
            <h2 className="mt-3 font-display text-4xl font-light leading-[1.05] text-ink sm:text-5xl text-balance">
              Built for the place it's in.
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {HIGHLIGHTS.map((h) => (
              <div
                key={h.title}
                className="rounded-3xl border border-border-soft bg-cream-50 p-6"
              >
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-forest-50 text-forest-800">
                  <h.icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-ink">
                  {h.title}
                </h3>
                <p className="mt-2 text-sm text-ink-muted">{h.body}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Quick facts */}
      <section className="bg-forest-950 py-16 text-inverse sm:py-20">
        <Container>
          <dl className="grid grid-cols-2 gap-y-10 lg:grid-cols-4">
            <Fact label="Altitude" value="1,650 m" />
            <Fact label="Rooms" value="22" />
            <Fact label="Property size" value="4.5 acres" />
            <Fact label="Team" value="28, mostly local" />
          </dl>
        </Container>
      </section>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.22em] text-sun-400">
        {label}
      </dt>
      <dd className="mt-3 font-display text-3xl font-light text-inverse sm:text-4xl">
        {value}
      </dd>
    </div>
  );
}
