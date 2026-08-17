"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, ArrowRight, Eye, EyeOff, ShieldCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { login, ApiError } from "@/lib/api";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("owner@sunandwaterresort.com");
  const [password, setPassword] = useState("changeme123");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ email, password });
      router.push("/admin");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Login failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-muted">
          Email
        </span>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field pl-10"
          />
        </div>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-muted">
          Password
        </span>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field pl-10 pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </label>

      <div className="flex items-center justify-between text-sm">
        <label className="inline-flex items-center gap-2 text-ink-muted">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border-soft text-forest-800 focus:ring-forest-800/30"
          />
          Remember me
        </label>
        <a href="#" className="font-medium text-forest-800 hover:underline">
          Forgot password?
        </a>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button
        type="submit"
        size="lg"
        variant="primary"
        className="w-full gap-2"
        isLoading={submitting}
      >
        Sign in
        <ArrowRight className="h-4 w-4" />
      </Button>

      <p className="text-center text-xs text-ink-muted">
        <ShieldCheck className="mr-1 inline h-3 w-3" />
        Demo: <span className="font-mono">owner@sunandwaterresort.com</span> /
        <span className="font-mono"> changeme123</span>
      </p>
    </form>
  );
}
