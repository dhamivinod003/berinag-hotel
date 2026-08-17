import Link from "next/link";
import { motion } from "framer-motion";
import { Users, BedDouble, Maximize2, ArrowRight } from "lucide-react";
import type { RoomType } from "@/lib/types";
import { formatFromINR } from "@/lib/format";
import { TiltCard } from "@/components/ui/TiltCard";
import { ThemedImage } from "@/components/theme/ThemedImage";

interface RoomsGridProps {
  roomTypes: RoomType[];
}

export function RoomsGrid({ roomTypes }: RoomsGridProps) {
  if (roomTypes.length === 0) {
    return (
      <div className="rounded-3xl border border-border-soft bg-card p-10 text-center text-ink-muted">
        No rooms to display yet.
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {roomTypes.map((room, i) => {
        const cover = room.coverImage ?? room.photos?.find((p) => p.isCover)?.url;
        return (
          <motion.div
            key={room.id}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{
              duration: 0.5,
              delay: i * 0.08,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <TiltCard
              maxTilt={4}
              hoverScale={1.01}
              highlightStrength={0.08}
              className="group block h-full overflow-hidden rounded-3xl border border-border-soft bg-card shadow-soft hover:shadow-lift"
            >
              <Link
                href={`/rooms/${room.slug}`}
                className="block h-full"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-cream-100">
                  <ThemedImage
                    kind="room"
                    index={i}
                    fallback={cover}
                    alt={room.name}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                </div>
                <div className="p-6">
                  <h3 className="font-display text-2xl font-normal text-ink">
                    {room.name}
                  </h3>
                  {room.shortDesc && (
                    <p className="mt-2 text-sm text-ink-muted">{room.shortDesc}</p>
                  )}
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-muted">
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
                  <div className="mt-5 flex items-center justify-between border-t border-border-soft/70 pt-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-semibold text-forest-800">
                        {formatFromINR(room.basePrice)}
                      </span>
                      <span className="text-sm text-ink-muted">/ night</span>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-800 transition-transform group-hover:translate-x-0.5">
                      View
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            </TiltCard>
          </motion.div>
        );
      })}
    </div>
  );
}
