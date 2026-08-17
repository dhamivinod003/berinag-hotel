// Rate limiting.
//
// Storage:
//   - In test mode (NODE_ENV=test or PORT=0): no-op (tests are too noisy
//     for the production limits).
//   - In dev/prod with REDIS_URL set: all limiters share a Redis store
//     (works correctly across multiple backend instances).
//   - In dev/prod without REDIS_URL: in-memory store (each instance has its
//     own counter; a multi-instance deploy would let some traffic through).
//
// Applies to: global, login, availability, hold creation, admin mutations,
// payment attempts.

import rateLimit, { type Store } from "express-rate-limit";
import Redis from "ioredis";
import RedisStore from "rate-limit-redis";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import type { Request } from "express";

const keyFromReq = (req: Request): string =>
  // Prefer user id if authenticated, else IP.
  (req as Request & { staff?: { id: string } }).staff?.id ??
  req.ip ??
  "unknown";

function noopLimiter(_req: any, _res: any, next: any) { next(); }

const isTest = process.env.NODE_ENV === "test" || process.env.PORT === "0";

// ─── Optional Redis store ───────────────────────────────────────────

let _redisClient: Redis | null = null;
let _redisStore: Store | null = null;

function getRedisStore(): Store | null {
  if (isTest) return null;
  if (!env.REDIS_URL) return null;
  if (_redisStore) return _redisStore;
  try {
    _redisClient = new Redis(env.REDIS_URL, {
      // Don't crash the server if Redis is briefly unreachable.
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: false,
    });
    _redisClient.on("error", (err) => {
      logger.warn({ err: err?.message }, "Redis rate-limit store error");
    });
    _redisStore = new RedisStore({
      sendCommand: (command: string, ...args: string[]) => _redisClient!.call(command, ...args) as Promise<any>,
      prefix: "rl:swr:",
    });
    logger.info("Rate limiter using Redis store");
    return _redisStore;
  } catch (err) {
    logger.error({ err }, "Failed to initialise Redis rate-limit store, falling back to memory");
    return null;
  }
}

function makeLimiter(opts: {
  windowMs: number;
  limit: number;
  keyGenerator?: (req: Request) => string;
  message?: { error: { code: string; message: string } };
  skipSuccessfulRequests?: boolean;
  forceEnableInTest?: boolean;
}) {
  if (isTest && !opts.forceEnableInTest) return noopLimiter;
  const store = getRedisStore();
  return rateLimit({
    windowMs: opts.windowMs,
    limit: opts.limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: opts.keyGenerator,
    message: opts.message,
    skipSuccessfulRequests: opts.skipSuccessfulRequests,
    ...(store ? { store } : {}),
  });
}

export const globalLimiter = makeLimiter({
  windowMs: 60_000,
  limit: env.RATE_LIMIT_GLOBAL,
  message: { error: { code: "TOO_MANY_REQUESTS", message: "Too many requests" } },
});

export const loginLimiter = makeLimiter({
  windowMs: 15 * 60_000,
  limit: 5,
  keyGenerator: (req) => (process.env.NODE_ENV === "test" ? req.header("X-Test-IP") : null) ?? req.ip ?? "unknown",
  message: { error: { code: "TOO_MANY_REQUESTS", message: "Too many login attempts" } },
  skipSuccessfulRequests: true,
  forceEnableInTest: true,
});

export const availabilityLimiter = makeLimiter({
  windowMs: 60_000,
  limit: env.RATE_LIMIT_AVAILABILITY,
  keyGenerator: (req) => req.ip ?? "unknown",
});

const holdLimiterInner = makeLimiter({
  windowMs: 15 * 60_000,
  limit: env.RATE_LIMIT_HOLD,
  keyGenerator: (req) =>
    (process.env.NODE_ENV === "test" ? req.header("X-Test-IP") : null) ?? req.ip ?? "unknown",
  message: { error: { code: "TOO_MANY_REQUESTS", message: "Too many hold attempts" } },
  forceEnableInTest: true,
});

export function holdLimiter(req: Request, res: any, next: any): void {
  // In tests the limiter only applies when the client sends X-Test-IP so
  // unrelated hold-creation tests do not trip a shared 127.0.0.1 bucket.
  if (isTest && !req.header("X-Test-IP")) {
    next();
    return;
  }
  holdLimiterInner(req, res, next);
}

export const adminMutateLimiter = makeLimiter({
  windowMs: 60_000,
  limit: 120,
  keyGenerator: keyFromReq,
});

export const paymentLimiter = makeLimiter({
  windowMs: 60_000,
  limit: 20,
  keyGenerator: (req) => req.ip ?? "unknown",
  message: { error: { code: "TOO_MANY_REQUESTS", message: "Too many payment attempts" } },
});

export const enquiryLimiter = makeLimiter({
  windowMs: 60 * 60_000,
  limit: 10,
  keyGenerator: (req) =>
    (process.env.NODE_ENV === "test" ? req.header("X-Test-IP") : null) ?? req.ip ?? "unknown",
  message: { error: { code: "TOO_MANY_REQUESTS", message: "Too many enquiries" } },
  forceEnableInTest: true,
});

export const passwordResetLimiter = makeLimiter({
  windowMs: 60 * 60_000,
  limit: 5,
  keyGenerator: (req) =>
    (process.env.NODE_ENV === "test" ? req.header("X-Test-IP") : null) ?? req.ip ?? "unknown",
  message: { error: { code: "TOO_MANY_REQUESTS", message: "Too many password reset requests" } },
  forceEnableInTest: true,
});
