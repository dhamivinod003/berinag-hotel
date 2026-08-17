"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { Container } from "@/components/ui/Container";
import type { Review } from "@/lib/types";

interface ReviewsSectionProps {
  reviews: Review[];
  rating?: { average: number; count: number };
}

export function ReviewsSection({ reviews, rating }: ReviewsSectionProps) {
  const featured = (reviews ?? []).filter((r) => r.source === "GOOGLE").slice(0, 3);
  const avg = rating?.average ?? 0;
  const count = rating?.count ?? 0;

  return (
    <section className="relative overflow-hidden bg-forest-950 py-20 text-inverse sm:py-24 lg:py-32">
      <div className="pointer-events-none absolute inset-x-0 -top-32 h-64 bg-[radial-gradient(60%_60%_at_50%_0%,rgb(var(--sun-400)_/_0.22),transparent_70%)]" />

      <Container className="relative">
        <div className="text-center">
          <h2 className="font-display text-4xl font-light text-inverse sm:text-5xl text-balance">
            Loved by {count > 0 ? `${count}+ ` : ""}Guests
          </h2>
          <p className="mt-3 text-base text-inverse/70 sm:text-lg">
            Real experiences from our happy guests
          </p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-12 lg:gap-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-4"
          >
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur-sm">
              <div className="flex items-center gap-5">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card text-3xl font-semibold text-ink">
                  {avg}
                </div>
                <div>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${
                          i < Math.round(avg)
                            ? "fill-sun-400 text-sun-400"
                            : "fill-white/20 text-white/20"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="mt-1.5 text-sm text-inverse/75">
                    {count > 0 ? `${count} Google Reviews` : "Reviews"}
                  </p>
                </div>
              </div>
              <p className="mt-5 text-sm leading-relaxed text-inverse/70">
                Every review is verified through Google. We never mix
                manually-added testimonials into the rating.
              </p>
            </div>
          </motion.div>

          <div className="grid gap-5 sm:grid-cols-2 lg:col-span-8 lg:grid-cols-3">
            {featured.length === 0 ? (
              <div className="col-span-full rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center text-inverse/60">
                No reviews yet.
              </div>
            ) : (
              featured.map((review, i) => (
                <motion.article
                  key={review.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{
                    duration: 0.5,
                    delay: i * 0.08,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="group flex h-full flex-col rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm transition-colors hover:border-white/20"
                >
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star
                        key={j}
                        className={`h-3.5 w-3.5 ${
                          j < review.rating
                            ? "fill-sun-400 text-sun-400"
                            : "fill-white/15 text-white/15"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="mt-4 flex-1 text-sm leading-relaxed text-inverse/85">
                    {review.body ?? (review as any).content}
                  </p>
                  <div className="mt-5 flex items-center gap-3 border-t border-white/10 pt-4">
                    {review.authorAvatar ? (
                      <div className="relative h-10 w-10 overflow-hidden rounded-pill">
                        <Image
                          src={review.authorAvatar}
                          alt={review.authorName}
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-pill bg-forest-800 text-sm font-medium text-inverse">
                        {review.authorName[0]}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-inverse">
                        {review.authorName}
                      </p>
                      {review.stayDate && (
                        <p className="text-xs text-inverse/55">
                          {new Date(review.stayDate).toLocaleDateString(
                            "en-IN",
                            { day: "2-digit", month: "short", year: "numeric" }
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.article>
              ))
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}
