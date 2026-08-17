import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: "ROUTE_NOT_FOUND",
      message: `No route matched ${req.method} ${req.path}`,
      requestId: req.id,
    },
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Zod validation
  if (err instanceof ZodError) {
    res.status(422).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        details: err.flatten(),
        requestId: req.id,
      },
    });
    return;
  }

  // AppError
  if (err instanceof AppError) {
    if (err.status >= 500) {
      logger.error({ err, reqId: req.id }, err.message);
    }
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.expose ? err.details : undefined,
        requestId: req.id,
      },
    });
    return;
  }

  // Prisma known errors — never leak query text, meta, or file paths.
  const e = err as { code?: string; meta?: unknown; message?: string };
  if (e?.code && typeof e.code === "string" && e.code.startsWith("P")) {
    const status = e.code === "P2002" ? 409 : e.code === "P2025" ? 404 : 400;
    logger.warn({ code: e.code, reqId: req.id }, "Prisma error");
    res.status(status).json({
      error: {
        code: status === 409 ? "CONFLICT" : status === 404 ? "NOT_FOUND" : "BAD_REQUEST",
        message: status === 409 ? "Conflict" : status === 404 ? "Not found" : "Database error",
        requestId: req.id,
      },
    });
    return;
  }

  // Express body-parser errors (e.g., malformed JSON)
  const errObj = err as any;
  if (err instanceof SyntaxError && 'status' in errObj && errObj.status === 400 && 'body' in errObj) {
    res.status(400).json({
      error: {
        code: "BAD_REQUEST",
        message: "Invalid JSON payload",
        requestId: req.id,
      },
    });
    return;
  }

  // Unknown
  const message = err instanceof Error ? err.message : "Internal server error";
  const finalStatus = errObj?.status && typeof errObj.status === 'number' && errObj.status >= 400 && errObj.status < 600 ? errObj.status : 500;
  const exposeInternals = env.NODE_ENV === "development";

  if (finalStatus >= 500) {
    logger.error({ err, reqId: req.id }, "Unhandled error");
  }

  const payload: Record<string, unknown> = {
    code: finalStatus >= 500 ? "INTERNAL_ERROR" : "BAD_REQUEST",
    message: exposeInternals && finalStatus < 500 ? message : finalStatus >= 500 ? "Internal server error" : "Request failed",
    requestId: req.id,
  };
  if (exposeInternals && err instanceof Error && err.stack) {
    payload.stack = err.stack;
  }

  res.status(finalStatus).json({ error: payload });
}

import { env } from "../config/env.js";
