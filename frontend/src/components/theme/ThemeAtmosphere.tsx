"use client";

/** Kept as a slot for theme-specific atmosphere. Worlds now come from photos. */
export function ThemeAtmosphere() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="theme-atmosphere absolute inset-0" />
    </div>
  );
}
