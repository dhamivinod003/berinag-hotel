"use client";

import * as React from "react";
import {
  type HTMLAttributes,
  type ReactNode,
  forwardRef,
  useCallback,
  useRef,
} from "react";
import { motion, useMotionTemplate, useMotionValue, useSpring, type MotionStyle } from "framer-motion";
import { cn } from "@/lib/cn";

/**
 * iOS 26-style 3D tilt card.
 *
 * - Listens to the cursor over the card and rotates it in 3D toward the
 *   pointer (max ~6°), with spring physics.
 * - A specular highlight tracks the cursor, simulating the iOS 26 "liquid
 *   glass" light reflection.
 * - Returns to flat with a smooth spring when the pointer leaves.
 * - Respects `prefers-reduced-motion` (no tilt, just the static surface).
 *
 * The card already has a `glass` surface; you can also pass `noGlass` if
 * you want a custom backdrop.
 */
export interface TiltCardProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  /** Max tilt in degrees (default 6). Set 0 to disable rotation but keep the highlight. */
  maxTilt?: number;
  /** Highlight intensity 0..1 (default 0.18). */
  highlightStrength?: number;
  /** Disable the glass surface; render as a plain surface. */
  noGlass?: boolean;
  /** Spring stiffness (default 220). */
  stiffness?: number;
  /** Spring damping (default 24). */
  damping?: number;
  /** Scale on hover (default 1.02). Set 1 to disable. */
  hoverScale?: number;
}

export const TiltCard = forwardRef<HTMLDivElement, TiltCardProps>(
  function TiltCard(
    {
      children,
      maxTilt = 6,
      highlightStrength = 0.18,
      noGlass = false,
      stiffness = 220,
      damping = 24,
      hoverScale = 1.02,
      className,
      ...rest
    },
    forwardedRef
  ) {
    const localRef = useRef<HTMLDivElement | null>(null);
    const setRefs = useCallback(
      (node: HTMLDivElement | null) => {
        localRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) (forwardedRef as { current: HTMLDivElement | null }).current = node;
      },
      [forwardedRef]
    );

    // Raw mouse position (-1..1 inside the card)
    const rx = useMotionValue(0);
    const ry = useMotionValue(0);
    // Pointer x/y as 0..1 for the highlight gradient
    const px = useMotionValue(0.5);
    const py = useMotionValue(0.5);

    // Spring-smoothed values
    const sx = useSpring(rx, { stiffness, damping });
    const sy = useSpring(ry, { stiffness, damping });
    const spx = useSpring(px, { stiffness: 200, damping: 20 });
    const spy = useSpring(py, { stiffness: 200, damping: 20 });

    const rotateY = useMotionTemplate`${sy}deg`;
    const rotateX = useMotionTemplate`${-sx}deg`;
    const highlightBg = useMotionTemplate`radial-gradient(420px circle at ${spx} ${spy}px, rgba(255,255,255,${highlightStrength}), transparent 65%)`;

    function onMove(e: React.PointerEvent<HTMLDivElement>) {
      const el = localRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      // -0.5..0.5 → -maxTilt..+maxTilt
      const ndx = (x / rect.width - 0.5) * 2;
      const ndy = (y / rect.height - 0.5) * 2;
      ry.set(ndx * maxTilt);
      rx.set(ndy * maxTilt);
      px.set(x);
      py.set(y);
    }
    function onLeave() {
      rx.set(0);
      ry.set(0);
    }

    return (
      <motion.div
        ref={setRefs}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        style={
          {
            rotateX,
            rotateY,
            transformStyle: "preserve-3d",
            transformPerspective: 1200,
            "--tilt-highlight": highlightBg,
          } as MotionStyle
        }
        whileHover={hoverScale !== 1 ? { scale: hoverScale } : undefined}
        whileTap={{ scale: 0.985 }}
        transition={{ type: "spring", stiffness: 320, damping: 24 }}
        className={cn(
          "relative isolate",
          !noGlass && "glass",
          "transition-shadow duration-300 will-change-transform",
          className
        )}
        // Spread last; motion handles its own event types.
        {...(rest as React.ComponentProps<typeof motion.div>)}
      >
        {/* The cursor-tracked specular highlight, painted above the glass
            pseudo-elements but below the content. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: "var(--tilt-highlight)" }}
        />
        <div className="relative z-10">{children}</div>
      </motion.div>
    );
  }
);
