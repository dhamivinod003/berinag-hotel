import { Mountain, Waves, UtensilsCrossed, HeartHandshake } from "lucide-react";

const FEATURES = [
  {
    icon: Mountain,
    title: "Scenic Location",
    body: "In the lap of the Himalayas",
  },
  {
    icon: Waves,
    title: "Swimming Pool",
    body: "Clean & relaxing",
  },
  {
    icon: UtensilsCrossed,
    title: "Multi-cuisine Restaurant",
    body: "Delicious food",
  },
  {
    icon: HeartHandshake,
    title: "Best Hospitality",
    body: "We treat you like family",
  },
];

export function QuickFeatures() {
  return (
    <section className="relative -mt-8 sm:-mt-12 lg:-mt-16">
      <div className="container mx-auto">
        <div className="rounded-3xl border border-border-soft bg-card px-6 py-6 shadow-soft sm:px-8 sm:py-7">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-6 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <li
                key={f.title}
                className="flex items-center gap-3 sm:gap-4"
              >
                <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-forest-50 text-forest-800 sm:h-12 sm:w-12">
                  <f.icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-ink sm:text-base">
                    {f.title}
                  </h3>
                  <p className="mt-0.5 text-xs text-ink-muted sm:text-sm">
                    {f.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
