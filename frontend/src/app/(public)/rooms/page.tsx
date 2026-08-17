import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/sections/PageHero";
import { RoomsGrid } from "@/components/sections/RoomsGrid";
import { AvailabilityCard } from "@/components/sections/AvailabilityCard";
import { getRoomTypes } from "@/lib/api";

export const metadata: Metadata = {
  title: "Rooms & Suites",
  description:
    "Deluxe rooms, premium rooms, family suites, and private luxury cottages — all with sweeping Himalayan views.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RoomsPage() {
  const roomTypes = await getRoomTypes().catch(() => []);

  return (
    <>
      <PageHero
        eyebrow="Stay with us"
        title="Rooms & Suites"
        subtitle="Deluxe rooms, premium rooms, family suites, and private luxury cottages — all with sweeping Himalayan views and warm wood interiors."
      />
      <section className="bg-page pb-20 sm:pb-24 lg:pb-32">
        <Container>
          <div className="mb-12 rounded-3xl border border-border-soft bg-card p-2 shadow-soft">
            <AvailabilityCard variant="solid" />
          </div>
          <RoomsGrid roomTypes={roomTypes} />
        </Container>
      </section>
    </>
  );
}
