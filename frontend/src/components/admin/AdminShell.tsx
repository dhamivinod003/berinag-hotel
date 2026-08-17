"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Calendar,
  CalendarDays,
  MessageSquare,
  BedDouble,
  Users,
  Tag,
  Sparkles,
  UserCog,
  BarChart3,
  Image as ImageIcon,
  Settings,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Star,
  Globe,
  ExternalLink,
} from "lucide-react";
import { Logo } from "@/components/icons/Logo";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";
import { fetchMe, logout, ApiError } from "@/lib/api";
import { connectRealtime, disconnectRealtime } from "@/lib/realtime";
import { NotificationBell } from "@/components/admin/NotificationBell";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/bookings", label: "Bookings", icon: Calendar },
  { href: "/admin/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/admin/enquiries", label: "Enquiries", icon: MessageSquare },
  { href: "/admin/rooms", label: "Rooms & Inventory", icon: BedDouble },
  { href: "/admin/guests", label: "Guests", icon: Users },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  { href: "/admin/pricing", label: "Pricing", icon: Tag },
  { href: "/admin/offers", label: "Offers", icon: Sparkles },
  { href: "/admin/gallery", label: "Gallery", icon: ImageIcon },
  { href: "/admin/housekeeping", label: "Housekeeping", icon: Sparkles },
  { href: "/admin/staff", label: "Staff", icon: UserCog },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/content", label: "Website Content", icon: ImageIcon },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

interface StaffState {
  id: string;
  name: string;
  email: string;
  roleKey: string;
  resort?: { name: string; slug: string };
  permissions: string[];
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [staff, setStaff] = useState<StaffState | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathname === "/admin/login") {
      setAuthChecked(true);
      return;
    }
    let cancelled = false;
    fetchMe()
      .then((data) => {
        if (cancelled) return;
        setStaff({
          id: data.staff.id,
          name: data.staff.name,
          email: data.staff.email,
          roleKey: data.staff.roleKey,
          resort: data.staff.resort,
          permissions: data.permissions,
        });
        setAuthChecked(true);
        // Open the realtime channel now that we have a session.
        connectRealtime();
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          disconnectRealtime();
          router.replace("/admin/login");
        } else {
          // Network error or other — show shell but no user info.
          setAuthChecked(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  // Disconnect on logout / unload.
  useEffect(() => {
    const handler = () => disconnectRealtime();
    window.addEventListener("swr:auth:expired", handler);
    return () => {
      window.removeEventListener("swr:auth:expired", handler);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => router.replace("/admin/login");
    window.addEventListener("swr:auth:expired", handler);
    return () => window.removeEventListener("swr:auth:expired", handler);
  }, [router]);

  async function handleLogout() {
    await logout();
    disconnectRealtime();
    router.push("/admin/login");
  }

  // Login page: no shell.
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  // First-load / auth-checking skeleton.
  if (!authChecked) {
    return (
      <div className="grid min-h-screen place-items-center bg-page">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-pill border-2 border-forest-800/20 border-t-forest-800" />
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-muted">
            Loading admin
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border-soft bg-card px-4 py-3 lg:hidden">
        <button
          onClick={() => setOpen(true)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-pill bg-surface"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Logo />
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 w-10 items-center justify-center rounded-pill bg-surface text-ink"
          aria-label="View website"
        >
          <Globe className="h-5 w-5" />
        </a>
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border-soft bg-card transition-transform duration-200 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex h-20 items-center justify-between border-b border-border-soft px-5">
          <Logo />
          <button
            onClick={() => setOpen(false)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-pill hover:bg-surface lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-0.5">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-forest-800 text-white shadow-soft"
                        : "text-ink/80 hover:bg-surface hover:text-ink"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4.5 w-4.5",
                        active ? "text-white" : "text-ink-muted group-hover:text-forest-800"
                      )}
                      strokeWidth={1.75}
                    />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="space-y-2 border-t border-border-soft p-3">
          <ThemeSwitcher variant="sidebar" />
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-ink/80 transition-colors hover:bg-surface hover:text-ink"
          >
            <Globe className="h-4 w-4 text-ink-muted" strokeWidth={1.75} />
            View website
            <ExternalLink className="ml-auto h-3.5 w-3.5 text-ink-subtle" />
          </a>

          <div className="flex items-center gap-3 rounded-2xl bg-page p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-pill bg-forest-800 text-sm font-medium text-white">
              {staff?.name?.[0] ?? "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">
                {staff?.name ?? "Loading…"}
              </p>
              <p className="truncate text-xs text-ink-muted">
                {staff?.roleKey === "OWNER" ? "Super Admin" : staff?.roleKey ?? "—"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-ink/80 transition-colors hover:bg-red-50 hover:text-red-700"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
            Logout
          </button>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 hidden h-20 items-center justify-between border-b border-border-soft bg-card/80 px-8 backdrop-blur-xl lg:flex">
          <div>
            <h1 className="font-display text-2xl font-normal text-ink">
              {NAV.find((n) =>
                n.exact ? n.href === pathname : pathname.startsWith(n.href)
              )?.label ?? "Dashboard"}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-pill border border-border-soft bg-card px-4 text-sm font-medium text-ink hover:bg-page"
            >
              <Globe className="h-4 w-4" />
              View website
              <ExternalLink className="h-3.5 w-3.5 text-ink-muted" />
            </a>
            <button className="inline-flex h-10 items-center gap-2 rounded-pill border border-border-soft bg-card px-4 text-sm font-medium text-ink hover:bg-page">
              <Calendar className="h-4 w-4" />
              {new Date().toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <NotificationBell />
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
