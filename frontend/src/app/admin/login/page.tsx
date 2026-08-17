import Link from "next/link";
import { LoginForm } from "./LoginForm";
import { Logo } from "@/components/icons/Logo";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export const metadata = { title: "Sign in" };

export default function AdminLoginPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Soft gradient backdrop */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-forest-50 via-cream-50 to-sun-50" />
      <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-pill bg-forest-200/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-pill bg-sun-200/30 blur-3xl" />

      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <ThemeSwitcher variant="solid" />
      </div>

      <div className="container mx-auto grid min-h-screen place-items-center px-4">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-forest-800 transition-colors hover:text-forest-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to website
          </Link>

          <div className="text-center">
            <Logo className="mx-auto" />
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-forest-800">
              Staff &amp; Admin
            </p>
            <h1 className="mt-3 font-display text-3xl font-light text-ink sm:text-4xl text-balance">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-ink-muted">
              Sign in to manage bookings, rooms, and content.
            </p>
          </div>

          <div className="mt-8 rounded-3xl border border-border-soft bg-card p-6 shadow-lift sm:p-8">
            <LoginForm />
          </div>

          <div className="mt-6 flex flex-col items-center gap-3 text-xs text-ink-muted">
            <p className="inline-flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5" />
              Your session is protected with end-to-end encryption.
            </p>
            <Link href="/" className="font-medium text-forest-800 underline underline-offset-2">
              Return to the public site
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
