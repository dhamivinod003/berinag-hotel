import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env, corsOrigins } from "./config/env.js";
import { globalLimiter } from "./middleware/rateLimit.js";
import { requestId } from "./middleware/requestId.js";
import { metricsMiddleware } from "./middleware/metrics.js";
import { csrfProtection } from "./middleware/csrf.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { publicRouter } from "./routes/public.js";
import { authRouter } from "./routes/auth.js";
import { adminRouter } from "./routes/admin.js";
import { webhookRouter } from "./routes/webhooks.js";
import { register } from "./utils/metrics.js";
import { logger } from "./utils/logger.js";
import { startHoldExpiryWorker } from "./jobs/holdExpiry.js";

export function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // API only; CSP is for the frontend
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );
  app.use(
    cors({
      origin: (origin, cb) => {
        // Allow same-origin / curl (no origin header) and any configured origin.
        if (!origin) return cb(null, true);
        if (corsOrigins.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
      credentials: true,
    })
  );

  // Request ID + structured logging
  app.use(requestId);
  app.use(
    morgan("combined", {
      stream: { write: (msg) => logger.info(msg.trim()) },
    })
  );

  // Metrics
  app.use(metricsMiddleware);

  // Webhooks must read the raw body before any JSON parser.
  app.use("/api/webhooks", webhookRouter);

  // Body parsers
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.use(cookieParser());

  // Global rate limit
  app.use(globalLimiter);

  // CSRF on state-changing routes (skip webhooks; skip refresh on path /api/auth/refresh — see csrf.ts)
  app.use(csrfProtection);

  // Health & metrics
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });
  app.get("/metrics", async (req, res) => {
    const expected = env.METRICS_TOKEN;
    if (!expected) {
      res.status(404).json({ error: { code: "ROUTE_NOT_FOUND", message: "Not found" } });
      return;
    }
    const provided =
      req.header("x-metrics-token") ||
      req.header("authorization")?.replace(/^Bearer\s+/i, "") ||
      "";
    if (provided !== expected) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid metrics token" } });
      return;
    }
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  });

  // Routes
  app.use("/api/public", publicRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/admin", adminRouter);

  // Static file serving for local dev uploads.
  // In production, this would be replaced by S3/Cloudinary URLs.
  app.use(
    "/uploads",
    express.static(env.UPLOAD_DIR, {
      maxAge: "7d",
      index: false,
      fallthrough: true,
      setHeaders: (res) => {
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Content-Security-Policy", "default-src 'none'");
        res.setHeader("Content-Disposition", "attachment");
      },
    })
  );

  // 404 + errors
  app.use(notFoundHandler);
  app.use(errorHandler);

  // Start the in-process hold-expiry sweeper. In production with multiple
  // instances, replace with BullMQ + Redis.
  if (env.NODE_ENV !== "test") {
    startHoldExpiryWorker();
  }

  return app;
}
