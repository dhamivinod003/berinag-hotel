"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Palette } from "lucide-react";
import { THEME_LIST, type ThemeId } from "@/lib/themes";
import { useTheme } from "./ThemeProvider";
import { cn } from "@/lib/cn";

interface ThemeSwitcherProps {
  variant?: "glass" | "solid" | "sidebar";
  className?: string;
}

export function ThemeSwitcher({
  variant = "solid",
  className,
}: ThemeSwitcherProps) {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const labelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className={cn(
          "items-center gap-1.5 rounded-pill p-1",
          variant === "sidebar"
            ? "flex w-full flex-wrap justify-between border border-border-soft bg-surface px-2 py-1.5"
            : "hidden lg:inline-flex",
          variant === "glass" &&
            "border border-white/25 bg-black/25 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.35)] backdrop-blur-xl",
          variant === "solid" && "border border-border-soft bg-card shadow-soft"
        )}
      >
        <span id={labelId} className="sr-only">
          Choose a visual theme
        </span>
        {variant === "sidebar" && (
          <span className="w-full px-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
            Themes
          </span>
        )}
        {THEME_LIST.map((item) => (
          <ThemeThumb
            key={item.id}
            id={item.id}
            name={item.name}
            image={item.heroImage}
            selected={theme === item.id}
            onSelect={setTheme}
          />
        ))}
      </div>

      <button
        type="button"
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-pill px-3 text-sm font-medium transition-colors",
          variant === "sidebar" && "hidden",
          variant !== "sidebar" && "lg:hidden",
          variant === "glass" &&
            "border border-white/25 bg-white/15 text-white backdrop-blur-md",
          variant !== "glass" && "border border-border-soft bg-card text-ink hover:bg-surface"
        )}
        aria-label="Choose a visual theme"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Palette className="h-4 w-4" />
        <span>Themes</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose a visual theme"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-80 overflow-hidden rounded-3xl border border-border-soft bg-card p-3 shadow-lift"
        >
          <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
            Choose a theme
          </p>
          <div className="grid grid-cols-1 gap-1.5">
            {THEME_LIST.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTheme(item.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center gap-3 rounded-2xl p-1.5 text-left transition-colors",
                  theme === item.id
                    ? "bg-forest-50 text-forest-800"
                    : "text-ink hover:bg-surface"
                )}
              >
                <span
                  className="relative h-12 w-20 shrink-0 overflow-hidden rounded-xl bg-surface"
                  aria-hidden="true"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.heroImage}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{item.name}</span>
                  <span className="block truncate text-xs text-ink-muted">
                    {item.description}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ThemeThumb({
  id,
  name,
  image,
  selected,
  onSelect,
}: {
  id: ThemeId;
  name: string;
  image: string;
  selected: boolean;
  onSelect: (id: ThemeId) => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={name}
      title={name}
      onClick={() => onSelect(id)}
      className={cn(
        "relative h-9 w-9 overflow-hidden rounded-full transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-800/50",
        selected
          ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-black/40"
          : "hover:scale-105 opacity-85 hover:opacity-100"
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt="" className="h-full w-full object-cover" />
    </button>
  );
}
