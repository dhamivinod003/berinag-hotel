import { Suspense } from "react";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/sections/PageHero";
import { BookingResults } from "./BookingResults";

export const metadata = {
  title: "Book Your Stay",
  description: "Check availability and book your stay at Sun & Water Resort.",
};

export default function BookingPage() {
  return (
    <>
      <PageHero
        eyebrow="Step 1"
        title="Your stay"
        subtitle="Pick your dates, choose your room, and we'll hold it for 10 minutes while you fill in the details."
      >
        <Suspense
          fallback={
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="skeleton h-24" />
              <div className="skeleton h-24" />
              <div className="skeleton h-24" />
            </div>
          }
        >
          <BookingResults />
        </Suspense>
      </PageHero>
    </>
  );
}
