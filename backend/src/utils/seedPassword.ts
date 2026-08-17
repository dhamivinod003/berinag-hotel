import crypto from "node:crypto";
import bcrypt from "bcryptjs";

export const FORBIDDEN_SEED_PASSWORD = "changeme123";

export function generateSeedPassword(): string {
  const raw = crypto.randomBytes(12).toString("base64url");
  return raw === FORBIDDEN_SEED_PASSWORD ? generateSeedPassword() : raw;
}

export async function hashSeedPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function hashIsForbiddenPassword(hash: string): Promise<boolean> {
  return bcrypt.compare(FORBIDDEN_SEED_PASSWORD, hash);
}
