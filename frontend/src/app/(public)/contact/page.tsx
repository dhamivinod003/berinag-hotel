import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/sections/PageHero";
import { ContactForm } from "./ContactForm";
import { Phone, Mail, MapPin, MessageCircle, Clock } from "lucide-react";
import { resort } from "@/lib/mock-data";
import { WHATSAPP_NUMBER, whatsappHref } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Phone, email, WhatsApp, address, and a contact form. We reply within a few hours during the day.",
};

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Get in touch"
        title="We'd love to hear from you"
        subtitle="For bookings, please use the availability widget on the home page. For everything else — this is the place."
      />
      <section className="bg-page pb-20 sm:pb-24 lg:pb-32">
        <Container>
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-5">
              <div className="space-y-6">
                <ContactItem
                  icon={Phone}
                  label="Phone"
                  value={resort.phone}
                  href={`tel:${resort.phone.replace(/\s/g, "")}`}
                />
                <ContactItem
                  icon={MessageCircle}
                  label="WhatsApp"
                  value={`+${WHATSAPP_NUMBER}`}
                  href={whatsappHref()}
                />
                <ContactItem
                  icon={Mail}
                  label="Email"
                  value={resort.email}
                  href={`mailto:${resort.email}`}
                />
                <ContactItem
                  icon={MapPin}
                  label="Address"
                  value={`${resort.address}, ${resort.city}, ${resort.state}, ${resort.country}`}
                />
                <ContactItem
                  icon={Clock}
                  label="Check-in / Check-out"
                  value={`In ${resort.checkInTime} · Out ${resort.checkOutTime}`}
                />
              </div>

              <div className="mt-10 aspect-[4/3] overflow-hidden rounded-3xl border border-border-soft bg-cream-100">
                <iframe
                  title="Sun & Water Resort — Pithoragarh"
                  src="https://www.openstreetmap.org/export/embed.html?bbox=80.16%2C29.55%2C80.27%2C29.62&layer=mapnik&marker=29.5828%2C80.2183"
                  className="h-full w-full"
                  style={{ border: 0 }}
                  loading="lazy"
                />
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="rounded-3xl border border-border-soft bg-card p-6 shadow-soft sm:p-8">
                <h2 className="font-display text-2xl font-normal text-ink">
                  Send us a message
                </h2>
                <p className="mt-1.5 text-sm text-ink-muted">
                  We typically reply within a few hours during the day.
                </p>
                <div className="mt-6">
                  <ContactForm />
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}

function ContactItem({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: any;
  label: string;
  value: string;
  href?: string;
}) {
  const inner = (
    <>
      <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-forest-50 text-forest-800">
        <Icon className="h-4.5 w-4.5" strokeWidth={1.75} />
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">
          {label}
        </p>
        <p className="mt-0.5 text-base text-ink">{value}</p>
      </div>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
        className="flex items-start gap-4 transition-opacity hover:opacity-80"
      >
        {inner}
      </a>
    );
  }
  return <div className="flex items-start gap-4">{inner}</div>;
}
