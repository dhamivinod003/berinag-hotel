import { getResort, getRoomTypes, getFeaturedReviews, getAggregateRating } from "@/lib/api";
import { Hero } from "@/components/sections/Hero";
import { QuickFeatures } from "@/components/sections/QuickFeatures";
import { RoomsSection } from "@/components/sections/RoomsSection";
import { ReviewsSection } from "@/components/sections/ReviewsSection";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  // Fetch in parallel. Reviews section is client-side; the rest of the
  // homepage is mostly client too (Hero, AvailabilityCard, RoomsSection).
  // We do this to surface server-rendered data for SEO.
  const [resort, roomTypes, reviews, rating] = await Promise.all([
    getResort().catch(() => null),
    getRoomTypes().catch(() => []),
    getFeaturedReviews(3).catch(() => []),
    getAggregateRating().catch(() => ({ average: 0, count: 0 })),
  ]);

  return (
    <>
      <Hero
        resortName={resort?.name}
        rating={rating}
      />
      <QuickFeatures />
      <RoomsSection roomTypes={roomTypes} />
      <ReviewsSection reviews={reviews} rating={rating} />
    </>
  );
}
