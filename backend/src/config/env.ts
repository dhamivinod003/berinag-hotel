// Validated environment variables. Import this anywhere you need config.

import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().nonnegative().default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),

  DATABASE_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 chars"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 chars"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),
  BCRYPT_COST: z.coerce.number().int().min(8).max(15).default(12),

  COOKIE_SECURE: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  COOKIE_DOMAIN: z.string().default("localhost"),

  RATE_LIMIT_GLOBAL: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_LOGIN: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_AVAILABILITY: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_HOLD: z.coerce.number().int().positive().default(10),

  // ─── Redis (optional) ───────────────────────────────────────────────
  // When set, rate limiters share a Redis-backed store. When empty, each
  // backend instance has its own in-memory store. In dev, leaving it empty
  // is fine. In prod with >1 backend instance, set this to a real Redis URL.
  REDIS_URL: z.string().default(""),

  RAZORPAY_KEY_ID: z.string().default(""),
  RAZORPAY_KEY_SECRET: z.string().default(""),
  RAZORPAY_WEBHOOK_SECRET: z.string().default(""),

  WHATSAPP_PHONE_NUMBER_ID: z.string().default(""),
  WHATSAPP_ACCESS_TOKEN: z.string().default(""),
  WHATSAPP_VERIFY_TOKEN: z.string().default(""),

  // Email (Nodemailer)
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  SMTP_FROM: z.string().default(""),
  SMTP_SECURE: z.string().default("false").transform((v) => v === "true"),

  // File upload
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(8 * 1024 * 1024), // 8MB
  UPLOAD_DIR: z.string().default("uploads"),

  HOLD_DURATION_MINUTES: z.coerce.number().int().positive().default(10),
  HOLD_EXPIRY_CHECK_INTERVAL_SEC: z.coerce.number().int().positive().default(60),

  FRONTEND_URL: z.string().url().default("http://localhost:3000"),

  // Empty = /metrics is hidden (404). Set a long random token in production.
  METRICS_TOKEN: z.string().default(""),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("❌ Invalid environment variables:\n", parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;

export const corsOrigins = env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean);
