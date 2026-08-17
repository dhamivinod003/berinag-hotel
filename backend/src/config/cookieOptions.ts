import { env } from "./env.js";

export const refreshCookieName = "swr_refresh";
export const csrfCookieName = "swr_csrf";
export const csrfHeaderName = "x-csrf-token";

export const refreshCookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: "lax" as const,
  domain: env.COOKIE_DOMAIN,
  path: "/api/auth",
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};

export const csrfCookieOptions = {
  httpOnly: false, // readable by JS for double-submit
  secure: env.COOKIE_SECURE,
  sameSite: "lax" as const,
  domain: env.COOKIE_DOMAIN,
  path: "/",
  maxAge: 24 * 60 * 60 * 1000, // 24h
};
