// Server wrapper for the dynamic guest detail route.
// Use dynamic to opt out of static export (these routes are accessed only in
// the live admin at runtime).
export const dynamic = "force-dynamic";
export const revalidate = 0;

import GuestDetailClient from "./GuestDetailClient";

export default function Page({ params }: { params: { id: string } }) {
  return <GuestDetailClient id={params.id} />;
}
