"use client";

import { type HTMLAttributes, type ReactNode, forwardRef } from "react";
import { cn } from "@/lib/cn";

/**
 * iOS 26 Liquid Glass surface.
 *
 * Wraps content in a frosted, refracted panel that catches a moving
 * specular highlight on hover. The animation is CSS-driven (no JS overhead)
 * and respects `prefers-reduced-motion`.
 *
 * Variants:
 *  - `default`   — clear glass on a neutral background
 *  - `forest`    — green-tinted glass for use on the hero / brand surfaces
 *  - `sun`       — warm-tinted glass for accent surfaces
 *  - `ink`       — dark glass for use on light hero photos
 *
 * Strengths:
 *  - `soft`    — 35% white, md blur. Subtle, for stacking.
 *  - `medium`  — 55% white, xl blur. Default.
 *  - `strong`  — 70% white, 2xl blur. For primary panels on busy backgrounds.
 *
 * `liquid` adds the slow ambient float. `sheen` triggers the moving
 * highlight on hover.
 */
export interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "forest" | "sun" | "ink";
  strength?: "soft" | "medium" | "strong";
  liquid?: boolean;
  sheen?: boolean;
  delay?: boolean; // staggered float
  as?: "div" | "section" | "article" | "aside" | "header" | "nav";
  children?: ReactNode;
}

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  function GlassPanel(
    {
      variant = "default",
      strength = "medium",
      liquid = false,
      sheen = false,
      delay = false,
      className,
      children,
      ...rest
    },
    ref
  ) {
    const variantClass =
      variant === "forest"
        ? "glass-tint-forest"
        : variant === "sun"
        ? "glass-tint-sun"
        : variant === "ink"
        ? "glass-tint-ink"
        : "";

    const strengthClass =
      strength === "soft"
        ? "glass-soft"
        : strength === "strong"
        ? "glass-strong"
        : "";

    return (
      <div
        ref={ref}
        className={cn(
          "glass",
          variantClass,
          strengthClass,
          liquid && (delay ? "liquid-float-delay" : "liquid-float"),
          sheen && "liquid-sheen",
          className
        )}
        {...rest}
      >
        {sheen && <span className="liquid-sheen-track" aria-hidden="true" />}
        {children}
      </div>
    );
  }
);
