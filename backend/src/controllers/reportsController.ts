// Reports controller. Every endpoint is multi-tenant and requires either
// DASHBOARD_VIEW (for the rollup) or REVENUE_VIEW (for money numbers).

import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  bookingsSummary,
  enquiryFunnel,
  getReportBundle,
  occupancyByDay,
  occupancyByRoomType,
  revenueSummary,
  roomPerformance,
} from "../services/reportsService.js";
import { ForbiddenError, BadRequestError } from "../utils/errors.js";

const rangeSchema = z.object({
  from: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid from date"),
  to: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid to date"),
});

function parseRange(q: unknown): { from: Date; to: Date } {
  const parsed = rangeSchema.safeParse(q);
  if (!parsed.success) throw new BadRequestError("Invalid date range");
  const from = new Date(parsed.data.from);
  const to = new Date(parsed.data.to);
  if (to.getTime() < from.getTime()) throw new BadRequestError("`to` must be after `from`");
  if (to.getTime() - from.getTime() > 366 * 86400_000) {
    throw new BadRequestError("Range too wide (max 1 year)");
  }
  return { from, to };
}

function requireRevenue(req: Request): void {
  // Owner can always see money. Other roles need the explicit permission.
  if (req.staff?.roleKey === "OWNER") return;
  const perms = (req.staff?.permissions as string[] | undefined) ?? [];
  if (!perms.includes("REVENUE_VIEW")) {
    throw new ForbiddenError("REVENUE_VIEW permission required to see financial data");
  }
}

export async function getDashboardReport(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const range = parseRange(req.query);
    const bundle = await getReportBundle(req.staff!.resortId, range);
    res.json(bundle);
  } catch (err) {
    next(err);
  }
}

export async function getOccupancyReport(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const range = parseRange(req.query);
    const [byDay, byType] = await Promise.all([
      occupancyByDay(req.staff!.resortId, range),
      occupancyByRoomType(req.staff!.resortId, range),
    ]);
    res.json({ range, byDay, byType });
  } catch (err) {
    next(err);
  }
}

export async function getRevenueReport(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    requireRevenue(req);
    const range = parseRange(req.query);
    const rev = await revenueSummary(req.staff!.resortId, range);
    res.json({ range, ...rev });
  } catch (err) {
    next(err);
  }
}

export async function getBookingsReport(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const range = parseRange(req.query);
    const book = await bookingsSummary(req.staff!.resortId, range);
    res.json({ range, ...book });
  } catch (err) {
    next(err);
  }
}

export async function getRoomPerformanceReport(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    requireRevenue(req);
    const range = parseRange(req.query);
    const perf = await roomPerformance(req.staff!.resortId, range);
    res.json({ range, items: perf });
  } catch (err) {
    next(err);
  }
}

export async function getEnquiryReport(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const range = parseRange(req.query);
    const enq = await enquiryFunnel(req.staff!.resortId, range);
    res.json({ range, ...enq });
  } catch (err) {
    next(err);
  }
}
