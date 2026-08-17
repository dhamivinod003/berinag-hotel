import type { PermissionKey } from "./permissions.js";

export interface PrincipalLike {
  roleKey?: string | null;
  permissions?: string[] | null;
}

export function can(principal: PrincipalLike, key: PermissionKey): boolean {
  if (!principal) return false;
  // Owners have everything.
  if (principal.roleKey === "OWNER") return true;
  if (!principal.permissions) return false;
  return principal.permissions.includes(key);
}

export function canAny(principal: PrincipalLike, keys: PermissionKey[]): boolean {
  return keys.some((k) => can(principal, k));
}

export function missingKeys(principal: PrincipalLike, keys: PermissionKey[]): PermissionKey[] {
  return keys.filter((k) => !can(principal, k));
}
