"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export interface LegalAccordionItem {
  id: string;
  title: string;
  children: ReactNode;
}

export function LegalAccordion({
  items,
  defaultOpen = items[0]?.id,
}: {
  items: LegalAccordionItem[];
  defaultOpen?: string;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    defaultOpen ? { [defaultOpen]: true } : {}
  );

  return (
    <div className="overflow-hidden rounded-3xl border border-white/50 bg-white/70 shadow-soft backdrop-blur-xl">
      {items.map((item, i) => {
        const isOpen = Boolean(open[item.id]);
        return (
          <div
            key={item.id}
            className={cn(i > 0 && "border-t border-border-soft/80")}
          >
            <h2>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`legal-acc-${item.id}`}
                id={`legal-acc-btn-${item.id}`}
                onClick={() =>
                  setOpen((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                }
                className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left sm:px-7 sm:py-6"
              >
                <span className="font-display text-xl font-normal text-ink sm:text-2xl">
                  {item.title}
                </span>
                <span
                  className={cn(
                    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-pill border border-border-soft bg-cream-50 text-forest-800 transition-transform duration-300 ease-spring-smooth",
                    isOpen && "rotate-180 bg-forest-800 text-white"
                  )}
                >
                  <ChevronDown className="h-4 w-4" />
                </span>
              </button>
            </h2>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  id={`legal-acc-${item.id}`}
                  role="region"
                  aria-labelledby={`legal-acc-btn-${item.id}`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="space-y-3 px-5 pb-6 text-base leading-relaxed text-ink-muted sm:px-7 [&_strong]:font-medium [&_strong]:text-ink [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
                    {item.children}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
