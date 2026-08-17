import type { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "../utils/errors.js";
import { can, missingKeys, type PrincipalLike } from "../rbac/can.js";
import type { PermissionKey } from "../rbac/permissions.js";

export function requirePermission(...required: PermissionKey[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.staff) {
      next(new ForbiddenError("No authenticated principal"));
      return;
    }
    const principal: PrincipalLike = {
      roleKey: req.staff.roleKey,
      permissions: req.staff.permissions,
    };
    if (required.length === 0) {
      next();
      return;
    }
    if (can(principal, required[0])) {
      next();
      return;
    }
    const missing = missingKeys(principal, required);
    next(
      new ForbiddenError("Insufficient permission", {
        required,
        missing,
      })
    );
  };
}
