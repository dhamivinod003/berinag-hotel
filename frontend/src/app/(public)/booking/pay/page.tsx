"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Script from "next/script";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, CreditCard, Lock, AlertCircle, Check, ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { PriceBreakdown } from "@/components/ui/PriceBreakdown";
import { BillFormula } from "@/components/ui/BillFormula";
import {
  createPaymentOrder,
  verifyPayment,
  getPaymentConfig,
  lookupReservation,
  ApiError,
  type PaymentOrderResult,
} from "@/lib/api";
import type { ReservationDto } from "@/lib/types";
import { formatINR, formatDateShort } from "@/lib/format";

// Razorpay window typings
declare global {
  interface Window {
    Razorpay?: new (opts: RazorpayOptions) => RazorpayInstance;
  }
}
interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  image?: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string; backdrop_color?: string };
  modal?: { ondismiss?: () => void; escape?: boolean; animation?: boolean };
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
}
interface RazorpayInstance {
  open: () => void;
  close: () => void;
  on: (event: string, handler: () => void) => void;
}

type Step = "loading" | "ready" | "paying" | "verifying" | "success" | "error";

export default function PaymentPage() {
  const router = useRouter();
  const params = useSearchParams();
  const reservationId = params.get("reservationId") || "";
  const ref = params.get("ref") || "";
  const phone = params.get("phone") || "";

  const [step, setStep] = useState<Step>("loading");
  const [error, setError] = useState<string | null>(null);
  const [reservation, setReservation] = useState<ReservationDto | null>(null);
  const [order, setOrder] = useState<PaymentOrderResult | null>(null);
  const [razorpayReady, setRazorpayReady] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const orderRef = useRef<PaymentOrderResult | null>(null);

  // Load the reservation and payment config.
  useEffect(() => {
    if (!reservationId || !ref || !phone) {
      setError("Missing booking reference. Open this page from your booking confirmation link.");
      setStep("error");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [r, c] = await Promise.all([
          lookupReservation({ bookingReference: ref, phone }),
          getPaymentConfig(),
        ]);
        if (cancelled) return;
        if (!r || r.id !== reservationId) {
          setError("Booking not found.");
          setStep("error");
          return;
        }
        setReservation(r);
        setConfigured(c.configured);
        if (!c.configured) {
          setError("Payment gateway is not configured. Please contact the resort.");
          setStep("error");
          return;
        }
        if (r.amountDue <= 0) {
          // Already fully paid — go to confirmation
          router.replace(`/booking/confirmation?ref=${ref}&phone=${encodeURIComponent(phone)}`);
          return;
        }
        setStep("ready");
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof ApiError ? e.message : "Failed to load booking.");
        setStep("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reservationId, ref, phone, router]);

  // Create the Razorpay order.
  const startPayment = async () => {
    if (!reservation) return;
    setStep("paying");
    setError(null);
    try {
      const o = await createPaymentOrder({ reservationId: reservation.id, phone });
      orderRef.current = o;
      setOrder(o);
      openCheckout(o);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to start payment.");
      setStep("error");
    }
  };

  const openCheckout = (o: PaymentOrderResult) => {
    if (!window.Razorpay) {
      setError("Payment widget is still loading. Please refresh and try again.");
      setStep("error");
      return;
    }
    const rzp = new window.Razorpay({
      key: o.keyId,
      amount: o.amount,
      currency: o.currency,
      name: "Sun & Water Resort",
      description: `Booking ${reservation?.bookingReference ?? ref}`,
      order_id: o.orderId,
      prefill: o.prefill,
      notes: {
        reservationId: o.reservationId,
        bookingReference: reservation?.bookingReference ?? ref,
      },
      theme: { color: "#1f3a2e" },
      modal: {
        ondismiss: () => {
          if (step !== "success" && step !== "verifying") {
            setStep("ready");
          }
        },
        escape: true,
        animation: true,
      },
      handler: async (response) => {
        setStep("verifying");
        try {
          await verifyPayment({
            reservationId: o.reservationId,
            phone,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          });
          setStep("success");
          // Redirect to confirmation after a moment.
          setTimeout(() => {
            router.replace(
              `/booking/confirmation?ref=${encodeURIComponent(ref)}&phone=${encodeURIComponent(phone)}&paid=1`
            );
          }, 1500);
        } catch (e) {
          setError(e instanceof ApiError ? e.message : "Payment verification failed.");
          setStep("error");
        }
      },
    });
    rzp.on("payment.failed", () => {
      setError("Payment failed. Please try again.");
      setStep("error");
    });
    rzp.open();
  };

  if (step === "loading" || configured === null) {
    return (
      <section className="relative bg-cream-50 pb-20 pt-24 sm:pt-28">
        <Container>
          <div className="mx-auto max-w-2xl">
            <div className="glass rounded-3xl p-8">
              <div className="skeleton h-8 w-1/2" />
              <div className="mt-4 skeleton h-32 w-full" />
            </div>
          </div>
        </Container>
      </section>
    );
  }

  if (step === "error") {
    return (
      <section className="relative bg-cream-50 pb-20 pt-24 sm:pt-28">
        <Container>
          <div className="mx-auto max-w-2xl rounded-3xl border border-border-soft bg-card p-8 text-center shadow-soft">
            <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-pill bg-red-50 text-red-600">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h1 className="mt-6 font-display text-3xl text-ink">We couldn't load your payment</h1>
            <p className="mt-2 text-sm text-ink-muted">{error ?? "Please try again."}</p>
            <div className="mt-6 flex justify-center gap-3">
              <Button onClick={() => router.push("/contact")} variant="outline" size="lg">
                Contact us
              </Button>
              <Button onClick={() => router.refresh()} size="lg">
                Retry
              </Button>
            </div>
          </div>
        </Container>
      </section>
    );
  }

  if (step === "success") {
    return (
      <section className="relative bg-cream-50 pb-20 pt-24 sm:pt-28">
        <Container>
          <div className="mx-auto max-w-2xl rounded-3xl border border-forest-200 bg-card p-8 text-center shadow-lift">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="mx-auto inline-flex h-20 w-20 items-center justify-center rounded-pill bg-forest-800 text-white"
            >
              <Check className="h-9 w-9" strokeWidth={2.5} />
            </motion.div>
            <h1 className="mt-8 font-display text-4xl text-ink">Payment received 🎉</h1>
            <p className="mt-3 text-base text-ink-muted">
              Taking you to your confirmation…
            </p>
          </div>
        </Container>
      </section>
    );
  }

  // ready or paying or verifying
  const total = reservation?.amountDue ?? 0;
  const amountInr = (total / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
        onLoad={() => setRazorpayReady(true)}
        onReady={() => setRazorpayReady(true)}
      />
      <section className="relative bg-cream-50 pb-20 pt-24 sm:pt-28">
        <Container>
          <div className="mx-auto max-w-2xl">
            <div className="glass rounded-3xl p-8">
              <div className="flex items-center gap-3 text-sm text-ink-muted">
                <Lock className="h-4 w-4" />
                <span>Secure payment via Razorpay (test mode)</span>
              </div>
              <h1 className="mt-4 font-display text-3xl text-ink">Pay to confirm your booking</h1>
              <p className="mt-2 text-sm text-ink-muted">
                Booking <span className="font-mono font-semibold text-ink">#{ref}</span> ·{" "}
                {reservation?.checkIn && formatDateShort(reservation.checkIn)} →{" "}
                {reservation?.checkOut && formatDateShort(reservation.checkOut)}
              </p>

              <div className="mt-6 space-y-4">
                {/* Step-by-step bill formula — shown above the receipt so the
                    guest can verify the math before paying. Pure presentational
                    addition; the numbers come from the same reservation
                    payload the PriceBreakdown uses, so they can never disagree. */}
                <BillFormula
                  nightlyRate={reservation?.nightlyRate ?? 0}
                  nights={reservation?.nights ?? 0}
                  roomCount={reservation?.roomCount ?? 1}
                  subtotal={reservation?.subtotal ?? 0}
                  discount={reservation?.discount ?? 0}
                  taxAmount={reservation?.taxAmount ?? 0}
                  totalAmount={reservation?.totalAmount ?? 0}
                  amountPaid={reservation?.amountPaid ?? 0}
                  amountDue={reservation?.amountDue ?? 0}
                  roomLabel={reservation?.roomType?.name}
                  offerLabel={reservation?.promoCode ?? undefined}
                />

                <PriceBreakdown
                  nightlyRate={reservation?.nightlyRate ?? 0}
                  nights={reservation?.nights ?? 0}
                  roomCount={reservation?.roomCount ?? 1}
                  subtotal={reservation?.subtotal ?? 0}
                  discount={reservation?.discount ?? 0}
                  taxAmount={reservation?.taxAmount ?? 0}
                  totalAmount={reservation?.totalAmount ?? 0}
                  amountPaid={reservation?.amountPaid ?? 0}
                  amountDue={reservation?.amountDue ?? 0}
                  roomLabel={reservation?.roomType?.name}
                  offerLabel={reservation?.promoCode ?? undefined}
                />
              </div>

              <div className="mt-6 flex items-start gap-3 rounded-2xl border border-forest-200 bg-forest-50 p-4 text-sm text-forest-900">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-forest-800" />
                <p>
                  You can pay with UPI, cards, or netbanking. The hold on your room is still active
                  and will be released if you don't complete the payment.
                </p>
              </div>

              {error && (
                <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                size="lg"
                variant="primary"
                className="mt-6 w-full gap-2"
                isLoading={step === "paying" || step === "verifying"}
                disabled={!razorpayReady || step === "paying" || step === "verifying"}
                onClick={startPayment}
              >
                <CreditCard className="h-4 w-4" />
                {step === "paying"
                  ? "Opening payment…"
                  : step === "verifying"
                  ? "Verifying payment…"
                  : `Pay ₹${amountInr}`}
                <ArrowRight className="h-4 w-4" />
              </Button>

              <p className="mt-4 text-center text-xs text-ink-muted">
                Test mode — use card{" "}
                <code className="rounded bg-cream-50 px-1.5 py-0.5 font-mono">4111 1111 1111 1111</code>{" "}
                with any future expiry and any CVV.
              </p>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}

