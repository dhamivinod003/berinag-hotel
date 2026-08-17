import type { Metadata } from "next";
import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/sections/PageHero";

export const metadata: Metadata = {
  title: "Gallery",
  description: "A visual tour of Sun & Water Resort — rooms, pool, restaurant, surroundings.",
};

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "resort", label: "Resort" },
  { key: "rooms", label: "Rooms" },
  { key: "pool", label: "Pool" },
  { key: "restaurant", label: "Restaurant" },
  { key: "surroundings", label: "Surroundings" },
];

const IMAGES = [
  { src: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80", cat: "resort" },
  { src: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80", cat: "pool" },
  { src: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1200&q=80", cat: "rooms" },
  { src: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=80", cat: "restaurant" },
  { src: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80", cat: "surroundings" },
  { src: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80", cat: "rooms" },
  { src: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80", cat: "rooms" },
  { src: "https://images.unsplash.com/photo-1518733057094-95b53143d2a7?auto=format&fit=crop&w=1200&q=80", cat: "resort" },
  { src: "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=1200&q=80", cat: "surroundings" },
  { src: "https://images.unsplash.com/photo-1493770348161-369560ae357d?auto=format&fit=crop&w=1200&q=80", cat: "restaurant" },
  { src: "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=80", cat: "resort" },
  { src: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80", cat: "resort" },
];

export default function GalleryPage() {
  return (
    <>
      <PageHero
        eyebrow="Gallery"
        title="A visual tour of the resort"
        subtitle="Click any image to view in full. Filter by category to find what you're looking for."
      />
      <section className="bg-page pb-20 sm:pb-24 lg:pb-32">
        <Container>
          {/* Filter chips (visual only for now) */}
          <div className="mb-8 flex flex-wrap gap-2">
            {CATEGORIES.map((c, i) => (
              <button
                key={c.key}
                className={
                  i === 0
                    ? "pill border border-forest-800 bg-forest-800 text-white"
                    : "pill border border-border-soft bg-card text-ink hover:border-forest-800/40 hover:bg-forest-50"
                }
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {IMAGES.map((img, i) => (
              <div
                key={i}
                className={
                  i % 7 === 0
                    ? "relative col-span-2 row-span-2 aspect-square overflow-hidden rounded-3xl md:col-span-2 md:row-span-2"
                    : "relative aspect-square overflow-hidden rounded-3xl"
                }
              >
                <Image
                  src={img.src}
                  alt={`Sun & Water Resort — ${img.cat}`}
                  fill
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                  className="object-cover transition-transform duration-500 hover:scale-105"
                />
              </div>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
