import { Suspense } from "react";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/sections/PageHero";
import { BookingDetails } from "./BookingDetails";

export const metadata = { title: "Your details" };

export default function BookingDetailsPage() {
  return (
    <>
      <PageHero eyebrow="Step 2" title="Your details" subtitle="Almost there. We'll hold your room for 10 minutes once you submit.">
        <Suspense fallback={<div className="skeleton h-96" />}>
          <BookingDetails />
        </Suspense>
      </PageHero>
    </>
  );
}
