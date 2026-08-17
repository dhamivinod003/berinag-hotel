// HTTP metrics middleware. Records duration + counts to Prometheus.

import type { Request, Response, NextFunction } from "express";
import { httpRequestDuration, httpRequestsTotal } from "../utils/metrics.js";

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const seconds = Number(process.hrtime.bigint() - start) / 1e9;
    const route = (req.route?.path as string) || req.path || "unknown";
    const labels = {
      method: req.method,
      route,
      status: String(res.statusCode),
    };
    httpRequestDuration.observe(labels, seconds);
    httpRequestsTotal.inc(labels);
  });
  next();
}
