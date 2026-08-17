import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-page">
      <Container className="text-center" size="md">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-forest-800">
          404
        </p>
        <h1 className="mt-3 font-display text-5xl font-light leading-[1.05] text-ink sm:text-6xl text-balance">
          We couldn't find that page
        </h1>
        <p className="mt-4 text-base text-ink-muted sm:text-lg">
          The page may have been moved, or the link is no longer valid.
        </p>
        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row">
          <Link href="/">
            <Button size="lg" variant="primary" className="gap-2">
              <Home className="h-4 w-4" />
              Back to home
            </Button>
          </Link>
          <Link href="/rooms">
            <Button size="lg" variant="outline" className="gap-2">
              <Search className="h-4 w-4" />
              Browse rooms
            </Button>
          </Link>
        </div>
      </Container>
    </main>
  );
}
