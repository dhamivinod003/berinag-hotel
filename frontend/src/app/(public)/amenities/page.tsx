import type { Metadata } from "next";
import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/sections/PageHero";
import { Waves, UtensilsCrossed, Wifi, Car, Sparkles, Mountain, Users, Flame, Calendar, Heart } from "lucide-react";
import { amenitiesImage, restaurantImage, mountainImage } from "@/lib/mock-data";

export const metadata: Metadata = {
  title: "Amenities",
  description:
    "Pool, restaurant, Wi-Fi, parking, room service, family facilities and event hosting — every detail thought through.",
};

const AMENITIES = [
  {
    icon: Waves,
    title: "Swimming Pool",
    body: "A clean, warm infinity pool overlooking the lower gardens. Towels, loungers, and a kids' shallow end.",
    image: amenitiesImage,
  },
  {
    icon: UtensilsCrossed,
    title: "Multi-cuisine Restaurant",
    body: "Kumaoni, North Indian, continental and Chinese. Local ingredients, slow cooking, generous portions.",
    image: restaurantImage,
  },
  {
    icon: Wifi,
    title: "High-speed Wi-Fi",
    body: "Reliable fibre across the property, including the pool deck and most cottages. Free for all guests.",
  },
  {
    icon: Car,
    title: "Parking",
    body: "Secure, well-lit on-site parking. Room for SUVs, sedans, and a small coach. Valet on request.",
  },
  {
    icon: Sparkles,
    title: "Spa & Wellness",
    body: "In-room massages and a small spa pavilion. Deep-tissue, Swedish, and traditional Kumaoni therapies.",
  },
  {
    icon: Mountain,
    title: "Mountain View Deck",
    body: "An open-air deck at the property's highest point — the best spot for a slow morning or a quiet nightcap.",
    image: mountainImage,
  },
  {
    icon: Users,
    title: "Family Facilities",
    body: "Cots, high chairs, kid-friendly menus, and a small indoor play area. Babysitting on advance request.",
  },
  {
    icon: Flame,
    title: "Bonfire Evenings",
    body: "Weather permitting, we light a bonfire on the lawn every evening. Marshmallows for the kids.",
  },
  {
    icon: Calendar,
    title: "Event Hosting",
    body: "Small weddings, milestone birthdays, corporate retreats. Indoor and outdoor venues, full catering.",
  },
  {
    icon: Heart,
    title: "Pet-friendly",
    body: "Well-behaved pets are welcome in select cottages. Please mention at the time of booking.",
  },
];

export default function AmenitiesPage() {
  return (
    <>
      <PageHero
        eyebrow="What we offer"
        title="Everything for a quiet, comfortable stay"
        subtitle="From the obvious essentials to the small details that make a holiday feel like a holiday."
      />
      <section className="bg-page pb-20 sm:pb-24 lg:pb-32">
        <Container>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {AMENITIES.map((a, i) => (
              <article
                key={a.title}
                className="group overflow-hidden rounded-3xl border border-border-soft bg-card shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
              >
                {a.image && (
                  <div className="relative aspect-[16/9] overflow-hidden">
                    <Image
                      src={a.image}
                      alt={a.title}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
                )}
                <div className="p-6">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-forest-50 text-forest-800">
                    <a.icon className="h-5 w-5" strokeWidth={1.75} />
                  </div>
                  <h3 className="mt-4 font-display text-2xl font-normal text-ink">
                    {a.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                    {a.body}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
