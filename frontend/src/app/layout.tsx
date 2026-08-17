import type { Metadata, Viewport } from "next";
import {
  Inter,
  Fraunces,
  Playfair_Display,
  Cormorant_Garamond,
  Outfit,
  Italianno,
} from "next/font/google";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { THEME_STORAGE_KEY, THEME_IDS, DEFAULT_THEME } from "@/lib/themes";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["SOFT", "opsz"],
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

/* Italianno — used for the cursive "Luxury" / "Infinite" / "Imagination"
   script accent on each theme's hero title. Single weight (400). */
const italianno = Italianno({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-italianno",
  display: "swap",
});

const THEME_INIT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var a=${JSON.stringify(THEME_IDS)};var t=localStorage.getItem(k);document.documentElement.setAttribute("data-theme",a.indexOf(t)!==-1?t:${JSON.stringify(DEFAULT_THEME)});}catch(e){document.documentElement.setAttribute("data-theme",${JSON.stringify(DEFAULT_THEME)});}})();`;

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ),
  title: {
    default: "Sun & Water Resort — Premium Himalayan Stay in Pithoragarh",
    template: "%s · Sun & Water Resort",
  },
  description:
    "Experience the perfect blend of nature, comfort and warm hospitality at Sun & Water Resort, Pithoragarh. Book your mountain escape today.",
  keywords: [
    "Pithoragarh resort",
    "Uttarakhand hotel",
    "Himalayan resort",
    "Sun & Water Resort",
    "mountain stay",
    "Pithoragarh accommodation",
  ],
  authors: [{ name: "Sun & Water Resort" }],
  openGraph: {
    type: "website",
    locale: "en_IN",
    title: "Sun & Water Resort — Premium Himalayan Stay in Pithoragarh",
    description:
      "Relax. Refresh. Reconnect. Premium accommodation in the lap of the Himalayas.",
    siteName: "Sun & Water Resort",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sun & Water Resort",
    description:
      "Relax. Refresh. Reconnect. Premium Himalayan stay in Pithoragarh.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#2D3F34",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} ${playfair.variable} ${cormorant.variable} ${outfit.variable} ${italianno.variable}`}
      data-theme={DEFAULT_THEME}
      suppressHydrationWarning
    >
      <body className="font-sans">
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
