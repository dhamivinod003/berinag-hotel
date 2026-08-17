import { Container } from "@/components/ui/Container";

interface PageHeroProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
  children?: React.ReactNode;
}

export function PageHero({
  eyebrow,
  title,
  subtitle,
  align = "left",
  children,
}: PageHeroProps) {
  return (
    <section className="relative overflow-hidden bg-page pt-32 pb-12 sm:pt-36 sm:pb-16">
      <div className="pointer-events-none absolute inset-x-0 -top-40 h-80 bg-[radial-gradient(60%_60%_at_50%_0%,rgb(var(--hero-glow)_/_0.16),transparent_70%)]" />
      <Container className="relative">
        <div className={align === "center" ? "text-center" : "max-w-3xl"}>
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-forest-800">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-3 font-display text-4xl font-light leading-[1.05] text-ink sm:text-5xl lg:text-6xl text-balance">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-5 max-w-2xl text-base text-ink-muted sm:text-lg text-pretty">
              {subtitle}
            </p>
          )}
        </div>
        {children && <div className="mt-10">{children}</div>}
      </Container>
    </section>
  );
}
