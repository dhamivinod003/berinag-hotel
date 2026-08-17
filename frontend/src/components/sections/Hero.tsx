"use client";

import { motion } from "framer-motion";
import { ArrowRight, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AvailabilityCard } from "./AvailabilityCard";
import { useTheme } from "@/components/theme/ThemeProvider";
import { ThemedImage } from "@/components/theme/ThemedImage";
import { whatsappHref } from "@/lib/whatsapp";

interface HeroProps {
  resortName?: string;
  rating?: { average: number; count: number };
}

/**
 * Split the accent line into the part before the script word, the script
 * word itself, and the trailing punctuation. The script word is always
 * the LAST whitespace-delimited token.
 *
 *   "Meets Luxury"      -> { before: "Meets ",  script: "Luxury",  after: "" }
 *   "Found in Luxury."  -> { before: "Found in ", script: "Luxury", after: "." }
 *   "Infinite Universe" -> { before: "",          script: "Infinite", after: " Universe" }
 *   "Beyond Imagination." -> { before: "Beyond ", script: "Imagination", after: "." }
 */
function splitAccent(line: string): { before: string; script: string; after: string } {
  const trimmed = line.trimEnd();
  // Find the last whitespace in the trimmed string so the script word
  // captures trailing punctuation.
  const lastSpace = trimmed.lastIndexOf(" ");
  if (lastSpace === -1) return { before: "", script: trimmed, after: "" };
  // Strip a trailing period/comma/etc from the script word — it should
  // render in display serif, not script.
  const scriptMatch = trimmed.slice(lastSpace + 1).match(/^([A-Za-z']+)(.*)$/);
  const script = scriptMatch ? scriptMatch[1] : trimmed.slice(lastSpace + 1);
  const after = scriptMatch ? scriptMatch[2] : "";
  return { before: trimmed.slice(0, lastSpace + 1), script, after };
}

export function Hero({ resortName, rating }: HeroProps) {
  const { definition } = useTheme();
  const copy = definition.hero;

  return (
    <section className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-page">
        <ThemedImage
          kind="hero"
          alt={resortName ?? "Resort"}
          priority
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="theme-hero-wash" />
      </div>

      {/* Content */}
      <div className="container mx-auto relative pt-32 pb-12 sm:pt-36 sm:pb-16 lg:pt-44 lg:pb-20">
        <div className="grid items-end gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-7">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="inline-flex items-center gap-2 rounded-pill border border-white/30 bg-white/15 px-3.5 py-1.5 text-xs font-medium text-white backdrop-blur-md"
            >
              <span className="h-1.5 w-1.5 rounded-pill bg-sun-400" />
              {copy.eyebrow}
              {rating && rating.count > 0 && (
                <span className="ml-1 text-white/70">· {rating.average}★ ({rating.count})</span>
              )}
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.8,
                delay: 0.05,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="mt-6 font-display text-5xl font-light leading-[0.95] text-white text-balance sm:text-6xl lg:text-7xl"
            >
              {copy.title}
              <br />
              {(() => {
                const { before, script, after } = splitAccent(copy.accent);
                return (
                  <>
                    {before}
                    <span
                      className="font-script text-sun-400"
                      style={{ fontSize: "1.4em", lineHeight: 0.9 }}
                    >
                      {script}
                    </span>
                    {after}
                  </>
                );
              })()}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.7,
                delay: 0.2,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="mt-6 max-w-xl text-lg leading-relaxed text-white/85 text-pretty sm:text-xl"
            >
              {copy.body}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.6,
                delay: 0.35,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
            >
              <Button
                size="lg"
                variant="primary"
                className="gap-2"
                onClick={() => {
                  document
                    .getElementById("availability")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Book Your Stay
                <ArrowRight className="h-4 w-4" />
              </Button>
              <a
                href={whatsappHref()}
                target="_blank"
                rel="noopener noreferrer"
                className="pill border border-white/50 bg-white/10 text-white backdrop-blur-md hover:bg-white/20 gap-2"
              >
                <MessageCircle className="h-4 w-4" />
                Chat on WhatsApp
              </a>
            </motion.div>
          </div>

          {/* Right side is empty on small screens — card sits below */}
          <div className="hidden lg:col-span-5 lg:block" />
        </div>
      </div>

      {/* Floating availability card — on top of the hero, anchored to the bottom */}
      <div
        id="availability"
        className="container mx-auto relative pb-12 lg:pb-20"
      >
        <div className="mx-auto max-w-5xl lg:translate-y-8">
          <AvailabilityCard variant="glass" />
        </div>
      </div>
    </section>
  );
}
