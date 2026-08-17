// Server wrapper for the dynamic booking detail route.
// Use dynamic to opt out of static export (these routes are accessed only in
// the live admin at runtime).
export const dynamic = "force-dynamic";
export const revalidate = 0;

import BookingDetailClient from "./BookingDetailClient";

export default function Page({ params }: { params: { id: string } }) {
  return <BookingDetailClient id={params.id} />;
}
