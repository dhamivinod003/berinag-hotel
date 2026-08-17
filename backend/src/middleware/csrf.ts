// CSRF: double-submit cookie. Admin mutation routes must include the
// X-CSRF-Token header matching the value of the `swr_csrf` cookie.

import type { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { csrfCookieName, csrfCookieOptions, csrfHeaderName } from "../config/cookieOptions.js";
import { ForbiddenError } from "../utils/errors.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Ensure a CSRF cookie exists for the browser to read.
  let cookieToken = req.cookies?.[csrfCookieName];
  if (!cookieToken) {
    cookieToken = uuidv4();
    res.cookie(csrfCookieName, cookieToken, csrfCookieOptions);
  }

  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  // Allow webhooks (HMAC-verified separately) and auth (no session yet).
  if (
    req.path.startsWith("/api/webhooks") ||
    req.path.startsWith("/api/auth") ||
    req.path.startsWith("/api/public/")
  ) {
    next();
    return;
  }

  // Requests authenticated with an explicit Bearer token header cannot be forged
  // by standard cross-origin browser requests (CSRF), so allow them.
  const authHeader = req.header("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    next();
    return;
  }

  const headerToken = req.header(csrfHeaderName);
  if (!headerToken || headerToken !== cookieToken) {
    next(new ForbiddenError("CSRF token missing or invalid"));
    return;
  }
  next();
}
