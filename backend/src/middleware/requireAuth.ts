import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../services/tokenService.js";
import { prisma } from "../config/database.js";
import { UnauthorizedError } from "../utils/errors.js";

declare global {
  namespace Express {
    interface Request {
      staff?: {
        id: string;
        resortId: string;
        email: string;
        name: string;
        roleKey: string;
        permissions: string[];
      };
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.header("authorization");
    if (!header || !header.toLowerCase().startsWith("bearer ")) {
      throw new UnauthorizedError("Missing or invalid Authorization header");
    }
    const token = header.slice(7).trim();
    if (!token) throw new UnauthorizedError("Empty bearer token");

    const payload = verifyAccessToken(token);

    const staff = await prisma.staff.findFirst({
      where: {
        id: payload.sub,
        resortId: payload.resortId,
        status: "ACTIVE",
        deletedAt: null,
      },
      include: {
        // The staff.roleKey string tells us which role template; permissions
        // are resolved dynamically by role. For perf, we cache the role's
        // permissions at request time. (For a higher-traffic system, attach
        // permissions to the JWT — but invalidate on RBAC changes.)
      },
    });
    if (!staff) throw new UnauthorizedError("Staff not found or inactive");

    // Resolve permissions from the role template.
    const role = await prisma.role.findFirst({
      where: { resortId: staff.resortId, key: staff.roleKey },
      include: { permissions: { include: { permission: true } } },
    });

    const permissions =
      staff.roleKey === "OWNER"
        ? [] // owner short-circuits
        : role?.permissions.map((rp) => rp.permission.key) ?? [];

    req.staff = {
      id: staff.id,
      resortId: staff.resortId,
      email: staff.email,
      name: staff.name,
      roleKey: staff.roleKey,
      permissions,
    };
    next();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      next(err);
      return;
    }
    next(new UnauthorizedError("Invalid or expired token"));
  }
}
