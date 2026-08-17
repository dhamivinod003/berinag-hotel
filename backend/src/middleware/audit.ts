// Audit log helper. Call from controllers/services to record an action.
// Writes are best-effort; failures are logged but never throw.

import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";

export interface AuditOpts {
  resortId: string;
  actorType: "staff" | "guest" | "system";
  actorId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
  userAgent?: string;
}

export async function audit(opts: AuditOpts): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        resortId: opts.resortId,
        actorType: opts.actorType,
        actorId: opts.actorId ?? null,
        action: opts.action,
        entity: opts.entity ?? null,
        entityId: opts.entityId ?? null,
        beforeData: opts.before === undefined ? null : JSON.stringify(opts.before),
        afterData: opts.after === undefined ? null : JSON.stringify(opts.after),
        ip: opts.ip ?? null,
        userAgent: opts.userAgent ?? null,
      },
    });
  } catch (err) {
    logger.error({ err, opts }, "Failed to write audit log");
  }
}
