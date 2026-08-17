"use client";

import { forwardRef, type ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/cn";

type Variant = "primary" | "ghost" | "outline" | "secondary" | "glass" | "glass-strong";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "size" | "children"> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  fullWidth?: boolean;
  asChild?: boolean;
  children?: ReactNode;
}

const sizeStyles: Record<Size, string> = {
  sm: "px-4 py-2 text-sm",
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3.5 text-base",
};

const variantStyles: Record<Variant, string> = {
  // Primary: warm gold/amber accent that ties to the theme's --theme-color
  // token. Replaces the previous forest-green primary with a more
  // luxurious metallic feel that matches the resort's "Luxury" hero.
  primary:
    "bg-sun-500 text-ink shadow-soft hover:bg-sun-400 active:bg-sun-600",
  ghost:
    "border border-white/60 bg-white/10 text-white backdrop-blur-md hover:bg-white/20",
  outline:
    "border border-sun-500/40 bg-card text-ink hover:border-sun-500 hover:bg-sun-50",
  secondary: "bg-surface text-ink hover:bg-surface-2",
  // iOS 26 Liquid Glass button — frosted, light-catches, springy press.
  glass:
    "border border-white/40 bg-white/30 text-ink shadow-glass backdrop-blur-xl backdrop-saturate-[180%] hover:bg-white/45 hover:border-white/60",
  // Stronger glass — more opaque, for the primary CTA over photos.
  "glass-strong":
    "border border-white/55 bg-white/60 text-ink shadow-glass-lg backdrop-blur-2xl backdrop-saturate-[180%] hover:bg-white/70 hover:border-white/70",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      fullWidth = false,
      className,
      children,
      disabled,
      ...rest
    },
    ref
  ) {
    // Glass variants get a stronger spring on tap (0.94 instead of 0.98)
    // and a slightly slower release for that "settle" feeling.
    const tapScale = variant === "glass" || variant === "glass-strong" ? 0.94 : 0.98;
    const tapSpring =
      variant === "glass" || variant === "glass-strong"
        ? { type: "spring" as const, stiffness: 480, damping: 18 }
        : { type: "spring" as const, stiffness: 380, damping: 22 };

    return (
      <motion.button
        ref={ref}
        whileTap={disabled || isLoading ? undefined : { scale: tapScale }}
        transition={tapSpring}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-pill font-medium transition-all duration-300",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-500/40 focus-visible:ring-offset-2",
          "disabled:opacity-50 disabled:pointer-events-none",
          sizeStyles[size],
          variantStyles[variant],
          fullWidth && "w-full",
          className
        )}
        {...rest}
      >
        {isLoading ? (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : null}
        {children}
      </motion.button>
    );
  }
);
