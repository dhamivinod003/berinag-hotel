// JWT issue + verify, with refresh-token rotation + reuse detection.

import jwt, { type SignOptions } from "jsonwebtoken";
import crypto from "node:crypto";
import { env } from "../config/env.js";
import { prisma } from "../config/database.js";
import { UnauthorizedError } from "../utils/errors.js";

export interface AccessTokenPayload {
  sub: string; // staff id
  resortId: string;
  role: string;
  email: string;
  name: string;
}

const ACCESS_AUDIENCE = "swr.api";
const ISSUER = "swr-backend";

export function signAccessToken(payload: AccessTokenPayload): string {
  const opts: SignOptions = {
    expiresIn: env.JWT_ACCESS_TTL as SignOptions["expiresIn"],
    issuer: ISSUER,
    audience: ACCESS_AUDIENCE,
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, opts);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: ISSUER,
      audience: ACCESS_AUDIENCE,
    }) as AccessTokenPayload;
    if (!decoded.sub || !decoded.resortId) {
      throw new UnauthorizedError("Malformed access token");
    }
    return decoded;
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError("Invalid or expired access token");
  }
}

function hashRefresh(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function generateRefreshToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(48).toString("base64url");
  return { raw, hash: hashRefresh(raw) };
}

export async function createStaffSession(opts: {
  staffId: string;
  resortId: string;
  userAgent?: string | null;
  ip?: string | null;
  rotatedFromId?: string | null;
}): Promise<{ raw: string; sessionId: string; expiresAt: Date }> {
  const { raw, hash } = generateRefreshToken();
  const ttlDays = parseTtlDays(env.JWT_REFRESH_TTL);
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
  const session = await prisma.staffSession.create({
    data: {
      resortId: opts.resortId,
      staffId: opts.staffId,
      refreshTokenHash: hash,
      userAgent: opts.userAgent ?? null,
      ip: opts.ip ?? null,
      expiresAt,
      rotatedFromId: opts.rotatedFromId ?? null,
    },
  });
  return { raw, sessionId: session.id, expiresAt };
}

export async function rotateStaffSession(opts: {
  presentedToken: string;
  staffId: string;
  userAgent?: string | null;
  ip?: string | null;
}): Promise<{ raw: string; sessionId: string; expiresAt: Date } | null> {
  const hash = hashRefresh(opts.presentedToken);
  const existing = await prisma.staffSession.findUnique({ where: { refreshTokenHash: hash } });

  // Token not found — could be expired, never existed, or already rotated.
  if (!existing) return null;

  if (existing.staffId !== opts.staffId) {
    // Wrong staff — revoke the session.
    await prisma.staffSession.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });
    return null;
  }

  if (existing.revokedAt) {
    // Reuse detection: revoke the entire family (all sessions for this staff).
    await revokeAllForStaff(opts.staffId, "refresh_token_reuse");
    return null;
  }

  if (existing.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  // Mark old as revoked, create new (rotated).
  await prisma.staffSession.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  });

  return createStaffSession({
    staffId: existing.staffId,
    resortId: existing.resortId,
    userAgent: opts.userAgent,
    ip: opts.ip,
    rotatedFromId: existing.id,
  });
}

export async function revokeSession(refreshToken: string): Promise<void> {
  const hash = hashRefresh(refreshToken);
  await prisma.staffSession.updateMany({
    where: { refreshTokenHash: hash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllForStaff(staffId: string, reason: string): Promise<void> {
  await prisma.staffSession.updateMany({
    where: { staffId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  const staff = await prisma.staff.findUnique({ where: { id: staffId }, select: { resortId: true } });
  if (staff?.resortId) {
    await prisma.auditLog.create({
      data: {
        resortId: staff.resortId,
        actorType: "system",
        action: "SESSION_REVOKED",
        entity: "staff",
        entityId: staffId,
        afterData: JSON.stringify({ reason }),
      },
    });
  }
}

function parseTtlDays(ttl: string): number {
  // Accepts "30d", "12h", "15m", "60s", or a plain number of seconds.
  const m = ttl.match(/^(\d+)\s*([smhd])?$/i);
  if (!m) return 30;
  const n = parseInt(m[1], 10);
  switch ((m[2] || "d").toLowerCase()) {
    case "s":
      return n / 86400;
    case "m":
      return n / 1440;
    case "h":
      return n / 24;
    case "d":
    default:
      return n;
  }
}
