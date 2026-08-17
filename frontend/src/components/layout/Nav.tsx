"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "@/components/icons/Logo";
import { Button } from "@/components/ui/Button";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { cn } from "@/lib/cn";
import { whatsappHref } from "@/lib/whatsapp";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/rooms", label: "Rooms" },
  { href: "/amenities", label: "Amenities" },
  { href: "/offers", label: "Offers" },
  { href: "/gallery", label: "Gallery" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function Nav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const isHome = pathname === "/";
  // On home, the nav floats as a glass pill over the hero.
  // On other pages (or after scroll), it pins to the top as a flat glass bar.
  const transparent = isHome && !scrolled;

  return (
    <header className="fixed inset-x-0 top-0 z-50 transition-all duration-500 ease-spring-smooth">
      <div
        className={cn(
          "transition-all duration-500 ease-spring-smooth",
          transparent
            ? "mt-5"
            : "mt-0 border-b border-border-soft/70 bg-card/80 backdrop-blur-xl backdrop-saturate-[180%] shadow-soft"
        )}
      >
        <div className="container mx-auto">
          <div className="flex h-20 items-center justify-between gap-4">
            {/* Logo */}
            <Link
              href="/"
              className={cn(
                "transition-opacity hover:opacity-80",
                transparent ? "text-white [&_*]:!text-white" : ""
              )}
              aria-label="Sun & Water Resort — home"
            >
              <Logo className={transparent ? "[&_span]:!text-white" : ""} />
            </Link>

            {/* Desktop nav — pill-shaped floating glass capsule when over hero */}
            <nav
              className={cn(
                "hidden lg:flex items-center gap-1 rounded-pill px-2 py-1.5 transition-all duration-500 ease-spring-smooth",
                transparent
                  ? "bg-white/10 backdrop-blur-xl backdrop-saturate-[180%] border border-white/20 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.18)]"
                  : "bg-transparent border border-transparent"
              )}
            >
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-pill px-4 py-2 text-sm font-medium transition-all duration-200",
                      transparent
                        ? active
                          ? "bg-white/25 text-white"
                          : "text-white/85 hover:text-white hover:bg-white/15"
                        : active
                        ? "bg-card text-ink shadow-soft"
                        : "text-ink/70 hover:text-ink hover:bg-surface"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Right CTA — springy glass button over hero, solid when scrolled */}
            <div className="hidden lg:flex items-center gap-3">
              <ThemeSwitcher variant={transparent ? "glass" : "solid"} />
              <Link
                href="/admin/login"
                className={cn(
                  "text-sm font-medium transition-colors",
                  transparent ? "text-white/80 hover:text-white" : "text-ink/60 hover:text-ink"
                )}
              >
                Staff
              </Link>
              <Button
                variant={transparent ? "glass" : "primary"}
                size="md"
                className={cn("gap-2", transparent && "text-ink")}
                onClick={() => (window.location.href = "/booking")}
              >
                <Calendar className="h-4 w-4" />
                Book Your Stay
              </Button>
            </div>

            <div className="flex items-center gap-2 lg:hidden">
              <ThemeSwitcher variant={transparent ? "glass" : "solid"} />
              <button
                onClick={() => setMobileOpen((v) => !v)}
                className={cn(
                  "inline-flex h-10 w-10 items-center justify-center rounded-pill transition-colors",
                  transparent
                    ? "bg-white/15 text-white backdrop-blur-md"
                    : "bg-surface text-ink"
                )}
                aria-label={mobileOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="lg:hidden border-t border-border-soft/50 bg-card/95 backdrop-blur-xl"
          >
            <div className="container mx-auto py-4">
              <div className="flex flex-col gap-1">
                {NAV_ITEMS.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "rounded-2xl px-4 py-3 text-base font-medium transition-colors",
                        active
                          ? "bg-forest-50 text-forest-800"
                          : "text-ink hover:bg-surface"
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
                <div className="mt-3 flex flex-col gap-2 border-t border-border-soft/50 pt-4">
                  <Link
                    href="/admin/login"
                    className="rounded-2xl px-4 py-3 text-base font-medium text-ink hover:bg-surface"
                  >
                    Staff login
                  </Link>
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    className="gap-2"
                    onClick={() => (window.location.href = "/booking")}
                  >
                    <Calendar className="h-4 w-4" />
                    Book Your Stay
                  </Button>
                  <a
                    href={whatsappHref()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pill border border-forest-800/20 bg-card text-forest-800 hover:bg-forest-50"
                  >
                    Chat on WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
