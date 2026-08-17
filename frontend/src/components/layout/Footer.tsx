import Link from "next/link";
import { Phone, Mail, MapPin, Instagram, Facebook, MessageCircle } from "lucide-react";
import { Logo } from "@/components/icons/Logo";
import { resort } from "@/lib/mock-data";
import { whatsappHref } from "@/lib/whatsapp";

const FOOTER_LINKS = [
  {
    title: "Discover",
    links: [
      { href: "/rooms", label: "Rooms & Suites" },
      { href: "/amenities", label: "Amenities" },
      { href: "/gallery", label: "Gallery" },
      { href: "/offers", label: "Offers" },
    ],
  },
  {
    title: "Stay",
    links: [
      { href: "/booking", label: "Book Your Stay" },
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/admin/login", label: "Staff Login" },
    ],
  },
  {
    title: "Policies",
    links: [
      { href: "/policies", label: "All Policies" },
      { href: "/cancellation", label: "Cancellation" },
      { href: "/house-rules", label: "House Rules" },
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-forest-950 text-inverse">
      {/* Grain texture for premium feel */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.04] grain" />
      {/* Subtle radial highlight from top */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sun-400/40 to-transparent" />

      <div className="container mx-auto relative">
        {/* Top — wordmark + tagline */}
        <div className="grid gap-12 py-16 lg:grid-cols-12 lg:py-20">
          <div className="lg:col-span-5">
            <div className="[&_*]:!text-inverse">
              <Logo className="mb-6" />
            </div>
            <p className="max-w-md text-base leading-relaxed text-inverse/70">
              {resort.description}
            </p>

            <div className="mt-8 flex flex-col gap-3 text-sm">
              <a
                href={`tel:${resort.phone.replace(/\s/g, "")}`}
                className="inline-flex items-center gap-3 text-inverse/85 transition-colors hover:text-inverse"
              >
                <Phone className="h-4 w-4 text-sun-400" />
                {resort.phone}
              </a>
              <a
                href={`mailto:${resort.email}`}
                className="inline-flex items-center gap-3 text-inverse/85 transition-colors hover:text-inverse"
              >
                <Mail className="h-4 w-4 text-sun-400" />
                {resort.email}
              </a>
              <a
                href={whatsappHref()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 text-inverse/85 transition-colors hover:text-inverse"
              >
                <MessageCircle className="h-4 w-4 text-sun-400" />
                WhatsApp · {resort.phone}
              </a>
              <div className="inline-flex items-start gap-3 text-inverse/85">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sun-400" />
                <span>
                  {resort.address}, {resort.city}, {resort.state}, {resort.country}
                </span>
              </div>
            </div>

            <div className="mt-8 flex items-center gap-3">
              {resort.social?.instagram && (
                <a
                  href={resort.social.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-pill border border-inverse/20 text-inverse/80 transition-colors hover:border-sun-400/60 hover:bg-sun-400/10 hover:text-sun-400"
                  aria-label="Instagram"
                >
                  <Instagram className="h-4 w-4" />
                </a>
              )}
              {resort.social?.facebook && (
                <a
                  href={resort.social.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-pill border border-inverse/20 text-inverse/80 transition-colors hover:border-sun-400/60 hover:bg-sun-400/10 hover:text-sun-400"
                  aria-label="Facebook"
                >
                  <Facebook className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-7 lg:grid-cols-3 lg:pl-8">
            {FOOTER_LINKS.map((col) => (
              <div key={col.title}>
                <h4 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-sun-400">
                  {col.title}
                </h4>
                <ul className="space-y-3">
                  {col.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-inverse/75 transition-colors hover:text-inverse"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col items-start justify-between gap-3 border-t border-inverse/10 py-6 text-xs text-inverse/55 sm:flex-row sm:items-center">
          <p>
            © {new Date().getFullYear()} {resort.name}. Crafted for quiet
            Himalayan mornings.
          </p>
          <p className="flex items-center gap-2">
            <span>Check-in {resort.checkInTime}</span>
            <span className="opacity-50">·</span>
            <span>Check-out {resort.checkOutTime}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
