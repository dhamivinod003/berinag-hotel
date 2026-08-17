import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import {
  LegalPage,
  LegalCallout,
  LegalReveal,
} from "@/components/sections/LegalPage";
import { LegalAccordion } from "@/components/sections/LegalAccordion";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Sun & Water Resort collects, uses, and protects guest data — including Razorpay payments, cookies, and rights under the DPDP Act and IT Act.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Policies"
      title="Privacy policy"
      subtitle="We collect only what we need to host you, take payment, and stay in touch. This page explains what that is, who sees it, and how to ask us to change or delete it."
      currentPath="/privacy"
    >
      <LegalCallout
        tone="forest"
        title="We never sell your data"
        icon={<ShieldCheck className="h-5 w-5" strokeWidth={1.75} />}
      >
        <p>
          We do not sell guest lists, and we do not use your data for unrelated advertising networks.
        </p>
      </LegalCallout>

      <LegalReveal>
        <LegalAccordion
          defaultOpen="collect"
          items={[
            {
              id: "collect",
              title: "What we collect",
              children: (
                <>
                  <p>When you browse, enquire, or book, we may collect:</p>
                  <ul>
                    <li>
                      <strong className="font-medium text-ink">Identity &amp; contact</strong>{" "}
                      — name, phone number, email, and postal address if you give one.
                    </li>
                    <li>
                      <strong className="font-medium text-ink">Stay details</strong> — dates,
                      room type, guest count, special requests, and government ID shown
                      at check-in (as required for hotels in India).
                    </li>
                    <li>
                      <strong className="font-medium text-ink">Payment metadata</strong> —
                      amount, status, and Razorpay order / payment identifiers. We do
                      not store full card numbers, CVV, or UPI PINs.
                    </li>
                    <li>
                      <strong className="font-medium text-ink">Messages</strong> — enquiries,
                      WhatsApp chats you start with us, and emails.
                    </li>
                    <li>
                      <strong className="font-medium text-ink">Technical data</strong> —
                      browser type, approximate location from IP, and cookies needed to
                      keep a booking session working.
                    </li>
                  </ul>
                </>
              ),
            },
            {
              id: "use",
              title: "How we use data",
              children: (
                <>
                  <ul>
                    <li>To check availability, hold a room, confirm a booking, and take payment.</li>
                    <li>To send booking confirmations, receipts, and service messages by email or WhatsApp.</li>
                    <li>To meet hotel registration and tax requirements.</li>
                    <li>To answer enquiries and, if you opt in, occasional offers from this resort only.</li>
                    <li>To keep the website secure and understand which pages guests use.</li>
                  </ul>
                </>
              ),
            },
            {
              id: "razorpay",
              title: "Razorpay payments (no card storage)",
              children: (
                <>
                  <p>
                    Online payments are processed by Razorpay Software Private Limited,
                    a Reserve Bank of India–authorised payment aggregator. When you pay,
                    you leave our site’s checkout and complete the transaction on
                    Razorpay’s secure flow (cards, UPI, net banking, and wallets they
                    support). Razorpay’s own privacy policy governs the card and UPI
                    details you type there.
                  </p>
                  <p>
                    We receive only what we need to reconcile the stay: payment id,
                    order id, amount, method type, and success or failure. Refunds, when
                    due under our{" "}
                    <Link
                      href="/cancellation"
                      className="font-medium text-forest-800 underline underline-offset-2"
                    >
                      cancellation policy
                    </Link>
                    , go back through the same channel.
                  </p>
                </>
              ),
            },
            {
              id: "cookies",
              title: "Cookies",
              children: (
                <>
                  <p>We use a small set of cookies and similar storage:</p>
                  <ul>
                    <li>
                      <strong className="font-medium text-ink">Essential</strong> — to keep
                      you signed in to staff tools, to protect forms from CSRF, and to
                      remember a room hold while you finish booking.
                    </li>
                    <li>
                      <strong className="font-medium text-ink">Preferences</strong> — optional
                      settings such as a dismissed banner.
                    </li>
                    <li>
                      <strong className="font-medium text-ink">Analytics</strong> — only if we
                      enable a tool such as Google Analytics. That would be disclosed
                      here and can be refused via your browser.
                    </li>
                  </ul>
                  <p>
                    You can block non-essential cookies in your browser. Essential
                    cookies cannot be turned off if you want the booking flow to work.
                  </p>
                </>
              ),
            },
            {
              id: "legal",
              title: "Legal basis (DPDP Act, IT Act)",
              children: (
                <>
                  <p>
                    Sun & Water Resort (“we”, “us”) is a hospitality property in
                    Pithoragarh, Uttarakhand, India. For questions about this policy,
                    write to{" "}
                    <a
                      href="mailto:info@sunandwaterresort.com"
                      className="font-medium text-forest-800 underline underline-offset-2"
                    >
                      info@sunandwaterresort.com
                    </a>{" "}
                    or use the{" "}
                    <Link
                      href="/contact"
                      className="font-medium text-forest-800 underline underline-offset-2"
                    >
                      contact form
                    </Link>
                    .
                  </p>
                  <p>
                    We handle personal data in line with the Digital Personal Data
                    Protection Act, 2023 (DPDP Act) and the Information Technology Act,
                    2000, including the SPDI Rules.
                  </p>
                </>
              ),
            },
            {
              id: "rights",
              title: "Your rights",
              children: (
                <p>
                  Subject to the DPDP Act and applicable exceptions, you may ask us
                  to access, correct, or erase personal data we hold, or to withdraw
                  consent for marketing messages. Hotel law still requires us to keep
                  certain check-in records. To make a request, email{" "}
                  <a
                    href="mailto:info@sunandwaterresort.com"
                    className="font-medium text-forest-800 underline underline-offset-2"
                  >
                    info@sunandwaterresort.com
                  </a>{" "}
                  from the address on the booking. We will respond within a reasonable
                  period.
                </p>
              ),
            },
            {
              id: "share",
              title: "Who we share with",
              children: (
                <>
                  <p>
                    We do not share personal data except as needed to run the stay or as
                    required by law:
                  </p>
                  <ul>
                    <li>Razorpay, to take and refund payment.</li>
                    <li>Email and WhatsApp delivery providers, to send confirmations you asked for.</li>
                    <li>Our hosting and database providers, under contract, to store booking records.</li>
                    <li>
                      Police, tax, or other authorities when Indian law requires a guest
                      register or a lawful request.
                    </li>
                  </ul>
                  <p>Staff see only what their role needs. We do not publish reviews with your full name unless you ask us to.</p>
                </>
              ),
            },
            {
              id: "retain",
              title: "How long we keep it",
              children: (
                <p>
                  Booking, invoice, and guest-register records are kept for the period
                  Indian tax and hotel rules require (typically several years).
                  Enquiry messages we no longer need are deleted or anonymised.
                  Payment tokens live with Razorpay, not on our servers.
                </p>
              ),
            },
            {
              id: "children",
              title: "Children",
              children: (
                <p>
                  We do not knowingly collect data from children for their own
                  accounts. A parent or guardian provides children’s names and ages
                  only as needed for the stay.
                </p>
              ),
            },
            {
              id: "changes",
              title: "Changes",
              children: (
                <p>
                  If this policy changes in a material way, we will update the date at
                  the top of this page. Continued use of the website after that date
                  is acceptance of the revised policy.
                </p>
              ),
            },
          ]}
        />
      </LegalReveal>
    </LegalPage>
  );
}
