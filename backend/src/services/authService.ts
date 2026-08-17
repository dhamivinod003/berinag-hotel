// Auth: login, logout, password reset, account lockout.

import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { prisma } from "../config/database.js";
import { env } from "../config/env.js";
import { adminAuthFailure } from "../utils/metrics.js";
import {
  LockedError,
  UnauthorizedError,
  ValidationError,
} from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import {
  createStaffSession,
  rotateStaffSession,
  revokeAllForStaff,
  revokeSession,
  signAccessToken,
} from "./tokenService.js";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  staff: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export async function login(opts: {
  email: string;
  password: string;
  userAgent?: string | null;
  ip?: string | null;
}): Promise<LoginResult> {
  const email = opts.email.trim().toLowerCase();
  const staff = await prisma.staff.findFirst({
    where: { email, status: "ACTIVE", deletedAt: null },
  });
  if (!staff) {
    adminAuthFailure.inc();
    throw new UnauthorizedError("Invalid email or password");
  }

  if (staff.lockedUntil && staff.lockedUntil.getTime() > Date.now()) {
    adminAuthFailure.inc();
    throw new LockedError();
  }

  const ok = await bcrypt.compare(opts.password, staff.passwordHash);
  if (!ok) {
    const failed = staff.failedLoginCount + 1;
    const lockedUntil =
      failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null;
    await prisma.staff.update({
      where: { id: staff.id },
      data: { failedLoginCount: failed, lockedUntil },
    });
    adminAuthFailure.inc();
    if (lockedUntil) throw new LockedError();
    throw new UnauthorizedError("Invalid email or password");
  }

  // Success — clear counters, update lastLogin.
  await prisma.staff.update({
    where: { id: staff.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  });

  const accessToken = signAccessToken({
    sub: staff.id,
    resortId: staff.resortId,
    role: staff.roleKey,
    email: staff.email,
    name: staff.name,
  });

  const { raw: refreshToken, expiresAt } = await createStaffSession({
    staffId: staff.id,
    resortId: staff.resortId,
    userAgent: opts.userAgent,
    ip: opts.ip,
  });

  return {
    accessToken,
    refreshToken,
    expiresAt,
    staff: {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.roleKey,
    },
  };
}

export async function refresh(opts: {
  refreshToken: string;
  userAgent?: string | null;
  ip?: string | null;
}): Promise<LoginResult | null> {
  // Find staff id by validating against any non-revoked session.
  const crypto = await import("node:crypto");
  const hash = crypto.createHash("sha256").update(opts.refreshToken).digest("hex");
  const session = await prisma.staffSession.findUnique({ where: { refreshTokenHash: hash } });
  if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
    return null;
  }
  const rotated = await rotateStaffSession({
    presentedToken: opts.refreshToken,
    staffId: session.staffId,
    userAgent: opts.userAgent,
    ip: opts.ip,
  });
  if (!rotated) {
    adminAuthFailure.inc();
    return null;
  }
  const staff = await prisma.staff.findFirst({
    where: { id: session.staffId, status: "ACTIVE", deletedAt: null },
  });
  if (!staff) {
    adminAuthFailure.inc();
    return null;
  }
  const accessToken = signAccessToken({
    sub: staff.id,
    resortId: staff.resortId,
    role: staff.roleKey,
    email: staff.email,
    name: staff.name,
  });
  return {
    accessToken,
    refreshToken: rotated.raw,
    expiresAt: rotated.expiresAt,
    staff: { id: staff.id, name: staff.name, email: staff.email, role: staff.roleKey },
  };
}

export async function logout(refreshToken: string): Promise<void> {
  await revokeSession(refreshToken);
}

export async function logoutAll(staffId: string): Promise<void> {
  await revokeAllForStaff(staffId, "user_logout_all");
}

export async function requestPasswordReset(email: string): Promise<string | null> {
  // Returns the raw token (would normally be emailed). Returns null if no user.
  const staff = await prisma.staff.findFirst({
    where: { email: email.trim().toLowerCase(), deletedAt: null },
  });
  if (!staff) return null;
  const raw = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
  await prisma.passwordReset.create({
    data: {
      staffId: staff.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 30 * 60_000),
    },
  });
  return raw;
}

export async function confirmPasswordReset(opts: {
  token: string;
  newPassword: string;
}): Promise<void> {
  if (opts.newPassword.length < 8) {
    throw new ValidationError("Password must be at least 8 characters");
  }
  const tokenHash = crypto.createHash("sha256").update(opts.token).digest("hex");
  const reset = await prisma.passwordReset.findUnique({ where: { tokenHash } });
  if (!reset || reset.usedAt || reset.expiresAt.getTime() <= Date.now()) {
    throw new ValidationError("Reset token is invalid or expired");
  }
  const passwordHash = await bcrypt.hash(opts.newPassword, env.BCRYPT_COST);
  await prisma.$transaction([
    prisma.staff.update({
      where: { id: reset.staffId },
      data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
    }),
    prisma.passwordReset.update({
      where: { id: reset.id },
      data: { usedAt: new Date() },
    }),
    // Force re-auth everywhere.
    prisma.staffSession.updateMany({
      where: { staffId: reset.staffId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
  logger.info({ staffId: reset.staffId }, "Password reset completed");
}
