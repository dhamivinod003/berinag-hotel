import type { ReactNode } from "react";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { ThemeAtmosphere } from "@/components/theme/ThemeAtmosphere";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ThemeAtmosphere />
      <Nav />
      <main className="min-h-[60vh]">{children}</main>
      <Footer />
    </>
  );
}
