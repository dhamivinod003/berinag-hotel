import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  confirmPasswordReset,
  login,
  logout,
  refresh,
  requestPasswordReset,
} from "../services/authService.js";
import { refreshCookieName, refreshCookieOptions } from "../config/cookieOptions.js";
import { prisma } from "../config/database.js";
import { NotFoundError } from "../utils/errors.js";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function loginHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body as z.infer<typeof loginSchema>;
    const result = await login({
      email,
      password,
      userAgent: req.header("user-agent") ?? null,
      ip: req.ip ?? null,
    });
    res.cookie(refreshCookieName, result.refreshToken, refreshCookieOptions);
    res.json({
      accessToken: result.accessToken,
      expiresAt: result.expiresAt,
      staff: result.staff,
    });
  } catch (err: any) {
    if (err?.name === "UnauthorizedError" || err?.code === "UNAUTHORIZED") {
      res.status(401).json({ error: { code: "INVALID_CREDENTIALS" } });
      return;
    }
    if (err?.name === "LockedError" || err?.code === "ACCOUNT_LOCKED") {
      res.status(423).json({ error: { code: "ACCOUNT_LOCKED", message: err.message } });
      return;
    }
    next(err);
  }
}

export async function refreshHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rt = req.cookies?.[refreshCookieName];
    if (!rt) {
      res.status(401).json({ error: { code: "NO_REFRESH", message: "No refresh cookie" } });
      return;
    }
    const result = await refresh({
      refreshToken: rt,
      userAgent: req.header("user-agent") ?? null,
      ip: req.ip ?? null,
    });
    if (!result) {
      res.status(401).json({ error: { code: "REFRESH_INVALID", message: "Refresh failed" } });
      return;
    }
    res.cookie(refreshCookieName, result.refreshToken, refreshCookieOptions);
    res.json({
      accessToken: result.accessToken,
      expiresAt: result.expiresAt,
      staff: result.staff,
    });
  } catch (err) {
    next(err);
  }
}

export async function logoutHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rt = req.cookies?.[refreshCookieName];
    if (rt) await logout(rt);
    res.clearCookie(refreshCookieName, refreshCookieOptions);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export const passwordResetRequestSchema = z.object({
  email: z.string().email(),
});

export async function passwordResetRequestHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email } = req.body as z.infer<typeof passwordResetRequestSchema>;
    const token = await requestPasswordReset(email);
    // Don't leak existence; in dev, return the token for testing.
    res.json({ ok: true, ...(process.env.NODE_ENV !== "production" && token ? { devToken: token } : {}) });
  } catch (err) {
    next(err);
  }
}

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(20),
  newPassword: z.string().min(8),
});

export async function passwordResetConfirmHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { token, newPassword } = req.body as z.infer<typeof passwordResetConfirmSchema>;
    await confirmPasswordReset({ token, newPassword });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function meHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.staff) throw new NotFoundError("Not authenticated");
    const staff = await prisma.staff.findUnique({
      where: { id: req.staff.id },
      select: {
        id: true,
        email: true,
        name: true,
        roleKey: true,
        lastLoginAt: true,
        resort: { select: { id: true, name: true, slug: true } },
      },
    });
    res.json({ staff, permissions: req.staff.permissions });
  } catch (err) {
    next(err);
  }
}
