import Link from "next/link";
import { Users, BedDouble, Maximize2, ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { ThemedImage } from "@/components/theme/ThemedImage";
import type { RoomType } from "@/lib/types";
import { formatFromINR } from "@/lib/format";

interface RoomsSectionProps {
  roomTypes: RoomType[];
}

export function RoomsSection({ roomTypes }: RoomsSectionProps) {
  if (roomTypes.length === 0) return null;

  return (
    <section className="bg-page py-20 sm:py-24 lg:py-32">
      <Container>
        <div className="mb-12 flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end lg:mb-16">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-forest-800">
              Our Rooms
            </p>
            <h2 className="mt-3 font-display text-4xl font-light leading-[1.05] text-ink sm:text-5xl text-balance">
              Comfortable stays for a
              <br className="hidden sm:block" />{" "}
              <span className="italic text-forest-800">perfect getaway</span>
            </h2>
          </div>
          <Link
            href="/rooms"
            className="group inline-flex items-center gap-2 rounded-pill border border-forest-800/20 bg-card px-5 py-2.5 text-sm font-medium text-forest-800 transition-all hover:border-forest-800/40 hover:bg-forest-50"
          >
            View All Rooms
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {roomTypes.map((room, index) => {
            const cover = room.coverImage ?? room.photos?.find((p) => p.isCover)?.url;
            return (
              <Link
                key={room.id}
                href={`/rooms/${room.slug}`}
                className="group block h-full overflow-hidden rounded-3xl border border-border-soft bg-card shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-cream-100">
                  <ThemedImage
                    kind="room"
                    index={index}
                    fallback={cover}
                    alt={room.name}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-semibold text-ink">
                    {room.name}
                  </h3>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      {room.maxAdults} Guests
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <BedDouble className="h-3.5 w-3.5" />
                      {room.bedConfiguration ?? "—"}
                    </span>
                    {room.areaSqft && (
                      <span className="inline-flex items-center gap-1.5">
                        <Maximize2 className="h-3.5 w-3.5" />
                        {room.areaSqft} sq.ft
                      </span>
                    )}
                  </div>
                  <div className="mt-4 flex items-baseline gap-1.5">
                    <span className="text-xl font-semibold text-forest-800">
                      {formatFromINR(room.basePrice)}
                    </span>
                    <span className="text-sm text-ink-muted">/ night</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
