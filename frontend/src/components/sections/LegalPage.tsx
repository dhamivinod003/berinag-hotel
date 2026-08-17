"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, MessageCircle } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { cn } from "@/lib/cn";
import { whatsappHref } from "@/lib/whatsapp";

export const LEGAL_NAV = [
  { href: "/policies", label: "All policies" },
  { href: "/cancellation", label: "Cancellation" },
  { href: "/house-rules", label: "House rules" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
] as const;

const ease = [0.22, 1, 0.36, 1] as const;

interface LegalPageProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  currentPath: string;
  lastUpdated?: string;
  children: ReactNode;
}

export function LegalPage({
  eyebrow,
  title,
  subtitle,
  currentPath,
  lastUpdated = "16 August 2026",
  children,
}: LegalPageProps) {
  return (
    <>
      <section className="relative overflow-hidden bg-page pt-32 pb-10 sm:pt-36 sm:pb-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 -top-32 h-[420px] w-[420px] rounded-full bg-forest-500/15 blur-3xl animate-glow-drift"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 top-10 h-[380px] w-[380px] rounded-full bg-sun-400/15 blur-3xl animate-glow-drift"
          style={{ animationDelay: "-4s" }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-40 h-80 bg-[radial-gradient(60%_60%_at_50%_0%,rgb(var(--hero-glow)_/_0.16),transparent_70%)]"
        />

        <Container className="relative">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease }}
          >
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-pill border border-forest-800/15 bg-card/60 px-3.5 py-1.5 text-sm font-medium text-forest-800 shadow-soft backdrop-blur-md transition-colors hover:border-forest-800/30 hover:bg-card"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to home
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.05, ease }}
            className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-forest-800"
          >
            {eyebrow}
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08, ease }}
            className="mt-3 max-w-3xl font-display text-4xl font-light leading-[1.05] text-ink sm:text-5xl lg:text-6xl text-balance"
          >
            {title}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.16, ease }}
            className="mt-5 max-w-2xl text-base text-ink-muted sm:text-lg text-pretty"
          >
            {subtitle}
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.24 }}
            className="mt-4 text-xs font-medium uppercase tracking-[0.16em] text-ink-subtle"
          >
            Last updated {lastUpdated}
          </motion.p>

          <motion.nav
            aria-label="Legal pages"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.22, ease }}
            className="mt-8"
          >
            <ul className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {LEGAL_NAV.map((item) => {
                const active = item.href === currentPath;
                return (
                  <li key={item.href} className="shrink-0">
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "inline-flex rounded-pill border px-4 py-2 text-sm transition-all duration-300",
                        active
                          ? "border-forest-800 bg-forest-800 text-white shadow-soft"
                          : "border-border-soft bg-card/70 text-ink shadow-soft backdrop-blur-xl hover:border-forest-800/25 hover:bg-card"
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </motion.nav>
        </Container>
      </section>

      <section className="relative bg-page pb-16 sm:pb-20">
        <Container>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.12, ease }}
            className="space-y-8 sm:space-y-10"
          >
            {children}
          </motion.div>
        </Container>
      </section>

      <section className="relative overflow-hidden bg-forest-950 py-16 text-inverse sm:py-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-sun-400/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-10 bottom-0 h-56 w-56 rounded-full bg-wave-500/10 blur-3xl"
        />
        <Container className="relative">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sun-400">
              Still deciding
            </p>
            <h2 className="mt-3 font-display text-3xl font-light text-inverse sm:text-4xl text-balance">
              Have a question?
            </h2>
            <p className="mt-3 text-sm text-inverse/70 sm:text-base">
              Reception can walk you through any of these policies before you book.
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <a
                href={whatsappHref(
                  "Hello, I have a question about Sun & Water Resort policies."
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="pill border border-white/25 bg-white/10 text-inverse backdrop-blur-md hover:bg-white/20 gap-2 px-6 py-3.5 text-base"
              >
                <MessageCircle className="h-4 w-4" />
                Contact Resort
              </a>
              <Link
                href="/rooms"
                className="btn-primary gap-2 px-6 py-3.5 text-base"
              >
                Book your stay
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}

export function LegalReveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-48px" }}
      transition={{ duration: 0.5, delay, ease }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function LegalProse({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "space-y-3 text-base leading-relaxed text-ink-muted",
        "[&_strong]:font-medium [&_strong]:text-ink",
        "[&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5",
        className
      )}
    >
      {children}
    </div>
  );
}

export function LegalSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-3xl border border-border-soft bg-card/80 p-6 shadow-soft backdrop-blur-xl sm:p-8",
        className
      )}
    >
      <h2 className="font-display text-2xl font-normal text-ink">{title}</h2>
      <LegalProse className="mt-3">{children}</LegalProse>
    </section>
  );
}

export function LegalCallout({
  title,
  children,
  tone = "forest",
  icon,
}: {
  title?: string;
  children: ReactNode;
  tone?: "forest" | "sun" | "wave";
  icon?: ReactNode;
}) {
  const tones = {
    forest: "border-forest-200/60 bg-forest-50/70",
    sun: "border-sun-200/70 bg-sun-50/80",
    wave: "border-wave-500/20 bg-wave-500/10",
  };

  return (
    <aside className={cn("rounded-3xl border p-5 shadow-soft sm:p-6", tones[tone])}>
      <div className="flex items-start gap-3">
        {icon && (
          <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-card/80 text-forest-800 shadow-soft">
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          {title && (
            <h3 className="font-display text-xl font-normal text-ink">{title}</h3>
          )}
          <LegalProse className={title ? "mt-2" : undefined}>{children}</LegalProse>
        </div>
      </div>
    </aside>
  );
}
