// Required for `output: "export"` builds. Pre-generates the most common room
// slugs at build time so the static export has something to ship; the dev
// server still serves the route dynamically for any slug.
export function generateStaticParams() {
  return [
    { slug: "deluxe-room" },
    { slug: "premium-room" },
    { slug: "luxury-cottage" },
    { slug: "family-suite" },
    { slug: "single" },
    { slug: "double" },
  ];
}

import Image from "next/image";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { AvailabilityCard } from "@/components/sections/AvailabilityCard";
import { ThemedImage } from "@/components/theme/ThemedImage";
import { getRoomTypes, getRoomType } from "@/lib/api";
import { whatsappHref } from "@/lib/whatsapp";
import { formatFromINR, formatINR } from "@/lib/format";
import {
  Users,
  BedDouble,
  Maximize2,
  Wifi,
  Snowflake,
  Tv,
  Bath,
  Coffee,
  Mountain,
  Check,
} from "lucide-react";
import Link from "next/link";

const AMENITY_ICONS: Record<string, any> = {
  wifi: Wifi,
  ac: Snowflake,
  tv: Tv,
  balcony: Mountain,
  room_service: Coffee,
  hot_water: Bath,
  minibar: Coffee,
  lounge: Coffee,
  fireplace: Bath,
  tub: Bath,
};

export default async function RoomDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const room = await getRoomType(params.slug).catch(() => null);
  if (!room) return notFound();

  // Photos in display order, cover first.
  const photos = room.photos && room.photos.length > 0
    ? [...room.photos].sort((a, b) => (a.isCover ? -1 : b.isCover ? 1 : 0))
    : room.coverImage
    ? [{ id: "cover", url: room.coverImage, alt: room.name, isCover: true }]
    : [];
  const heroImg = photos[0]?.url;
  const gallery = photos.slice(1, 3).map((p) => p.url).filter(Boolean) as string[];

  return (
    <>
      {/* Gallery hero */}
      <section className="pt-24">
        <Container>
          <div className="grid gap-3 lg:grid-cols-12 lg:grid-rows-2">
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl lg:col-span-8 lg:row-span-2 lg:aspect-auto">
              <ThemedImage
                kind="room"
                index={0}
                fallback={heroImg}
                alt={room.name}
                priority
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
            {gallery.map((img, i) => (
              <div
                key={i}
                className="relative aspect-[4/3] overflow-hidden rounded-3xl lg:col-span-4 lg:aspect-auto"
              >
                <Image
                  src={img}
                  alt={`${room.name} ${i + 2}`}
                  fill
                  sizes="(min-width: 1024px) 33vw, 100vw"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-12 sm:py-16">
        <Container>
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-forest-800">
                Room
              </p>
              <h1 className="mt-3 font-display text-4xl font-light leading-[1.05] text-ink sm:text-5xl text-balance">
                {room.name}
              </h1>
              {room.description && (
                <p className="mt-5 text-base leading-relaxed text-ink-muted sm:text-lg text-pretty">
                  {room.description}
                </p>
              )}

              <dl className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
                <Spec icon={Users} label="Guests" value={`Up to ${room.maxAdults}`} />
                <Spec icon={BedDouble} label="Bed" value={room.bedConfiguration ?? "—"} />
                {room.areaSqft && (
                  <Spec icon={Maximize2} label="Area" value={`${room.areaSqft} sq.ft`} />
                )}
                {room.view && <Spec icon={Mountain} label="View" value={room.view} />}
              </dl>

              <div className="mt-12">
                <h2 className="font-display text-2xl font-normal text-ink">Amenities</h2>
                <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm text-ink sm:grid-cols-3">
                  {room.amenities.map((a) => {
                    // Backend returns { amenity: { key, name, ... } } for each
                    const am = a?.amenity ?? a;
                    const key = am?.key ?? am?.name ?? "unknown";
                    const label = am?.name ?? key.replace(/_/g, " ");
                    const Icon = AMENITY_ICONS[key] ?? Check;
                    return (
                      <li
                        key={am?.id ?? key}
                        className="inline-flex items-center gap-2 capitalize"
                      >
                        <Icon className="h-4 w-4 text-forest-800" strokeWidth={1.75} />
                        {label}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="mt-12 grid gap-4 sm:grid-cols-2">
                <Policy
                  title="Cancellation"
                  body="Free cancellation up to 7 days before check-in. Within 7 days: 50% charge. Within 24h: full charge."
                />
                <Policy
                  title="House rules"
                  body={`Check-in ${"14:00"} · Check-out ${"11:00"}. No smoking in rooms. Pets on request.`}
                />
              </div>
            </div>

            <aside className="lg:col-span-5">
              <div className="sticky top-28 space-y-4">
                <div className="rounded-3xl border border-border-soft bg-card p-6 shadow-soft">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-semibold text-forest-800">
                      {formatFromINR(room.basePrice)}
                    </span>
                    <span className="text-sm text-ink-muted">/ night</span>
                  </div>
                  <p className="mt-1 text-xs text-ink-subtle">
                    {formatINR(room.basePrice * 3)} for 3 nights · taxes extra
                  </p>
                  <div className="mt-6 flex flex-col gap-2">
                    <Link href={`/booking?roomType=${room.slug}`}>
                      <Button size="lg" variant="primary" className="w-full">
                        Book Now
                      </Button>
                    </Link>
                    <a
                      href={whatsappHref(`Hi, I'd like to know more about the ${room.name}.`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pill border border-forest-800/20 bg-card text-forest-800 hover:bg-forest-50"
                    >
                      Ask on WhatsApp
                    </a>
                    <Link
                      href="/booking"
                      className="text-center text-sm font-medium text-ink-muted hover:text-ink"
                    >
                      Check other dates →
                    </Link>
                  </div>
                </div>

                <div className="rounded-3xl border border-border-soft bg-card p-2 shadow-soft">
                  <AvailabilityCard variant="solid" />
                </div>
              </div>
            </aside>
          </div>
        </Container>
      </section>
    </>
  );
}

function Spec({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-ink-muted">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
        {label}
      </dt>
      <dd className="mt-1.5 text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

function Policy({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border-soft bg-cream-50 p-4">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{body}</p>
    </div>
  );
}
