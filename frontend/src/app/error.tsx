"use client";

import { useEffect } from "react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // TODO: send to Sentry
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-page px-4">
      <Container className="text-center" size="md">
        <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-pill bg-red-50 text-red-600">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h1 className="mt-6 font-display text-4xl font-light leading-[1.05] text-ink sm:text-5xl text-balance">
          Something went wrong
        </h1>
        <p className="mt-3 text-base text-ink-muted">
          We've been notified. Please try again, or head back home.
        </p>
        {error.digest && (
          <p className="mt-3 text-xs text-ink-subtle">
            Error ID: <span className="font-mono">{error.digest}</span>
          </p>
        )}
        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row">
          <Button size="lg" variant="primary" className="gap-2" onClick={reset}>
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
          <Link href="/">
            <Button size="lg" variant="outline" className="gap-2">
              <Home className="h-4 w-4" />
              Back to home
            </Button>
          </Link>
        </div>
      </Container>
    </main>
  );
}
