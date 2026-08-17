import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../config/database.js";
import { getAvailability } from "../services/availabilityService.js";
import {
  createHold,
  generateSessionId,
  getHold,
  releaseHold,
} from "../services/reservationHoldService.js";
import { createFromHold, lookupReservation } from "../services/reservationService.js";
import {
  createOrderForReservation,
  verifyAndCapture,
  isRazorpayConfigured,
  getPublicKeyId,
} from "../services/paymentService.js";
import { NotFoundError } from "../utils/errors.js";
import { sanitizeInput, sanitizeOptional } from "../utils/sanitize.js";

// ─── Resort / Content ─────────────────────────────────────────────

export async function getResort(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resort = await prisma.resort.findFirst({ where: { status: "ACTIVE" } });
    if (!resort) throw new NotFoundError("No active resort");
    res.json(resort);
  } catch (err) {
    next(err);
  }
}

export async function getRoomTypes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resort = await prisma.resort.findFirst({ where: { status: "ACTIVE" } });
    if (!resort) throw new NotFoundError("No active resort");
    const rts = await prisma.roomType.findMany({
      where: { resortId: resort.id, status: "ACTIVE", deletedAt: null },
      include: {
        photos: { where: { isCover: true }, take: 1 },
        amenities: { include: { amenity: true } },
      },
      orderBy: { displayOrder: "asc" },
    });
    res.json(rts);
  } catch (err) {
    next(err);
  }
}

export async function getRoomTypeBySlug(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const resort = await prisma.resort.findFirst({ where: { status: "ACTIVE" } });
    if (!resort) throw new NotFoundError();
    const rt = await prisma.roomType.findFirst({
      where: { resortId: resort.id, slug: req.params.slug, status: "ACTIVE", deletedAt: null },
      include: {
        photos: { orderBy: { displayOrder: "asc" } },
        amenities: { include: { amenity: true } },
      },
    });
    if (!rt) throw new NotFoundError();
    res.json(rt);
  } catch (err) {
    next(err);
  }
}

export async function getOffers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resort = await prisma.resort.findFirst({ where: { status: "ACTIVE" } });
    if (!resort) throw new NotFoundError();
    const now = new Date();
    const offers = await prisma.offer.findMany({
      where: {
        resortId: resort.id,
        status: "PUBLISHED",
        deletedAt: null,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      include: { roomTypes: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(offers);
  } catch (err) {
    next(err);
  }
}

export async function getReviews(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resort = await prisma.resort.findFirst({ where: { status: "ACTIVE" } });
    if (!resort) throw new NotFoundError();
    const reviews = await prisma.review.findMany({
      where: { resortId: resort.id, status: "PUBLISHED" },
      orderBy: [{ isFeatured: "desc" }, { reviewDate: "desc" }],
    });
    res.json(reviews);
  } catch (err) {
    next(err);
  }
}

export async function getAggregateRating(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const resort = await prisma.resort.findFirst({ where: { status: "ACTIVE" } });
    if (!resort) throw new NotFoundError();
    const googleReviews = await prisma.review.findMany({
      where: { resortId: resort.id, status: "PUBLISHED", source: "GOOGLE" },
      select: { rating: true },
    });
    if (googleReviews.length === 0) {
      res.json({ average: 0, count: 0 });
      return;
    }
    const sum = googleReviews.reduce((acc, r) => acc + r.rating, 0);
    const average = Math.round((sum / googleReviews.length) * 10) / 10;
    // Configurable — for now, mirror the actual count of Google reviews.
    // Admins can override the displayed count via the website settings.
    const settings = await prisma.websiteSetting.findUnique({
      where: { resortId_key: { resortId: resort.id, key: "reviews.google_count" } },
    });
    const count = settings
      ? Number(JSON.parse(settings.value))
      : googleReviews.length;
    res.json({ average, count });
  } catch (err) {
    next(err);
  }
}

export async function getGallery(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resort = await prisma.resort.findFirst({ where: { status: "ACTIVE" } });
    if (!resort) throw new NotFoundError();
    const categories = await prisma.galleryCategory.findMany({
      where: { resortId: resort.id },
      include: {
        images: {
          where: { hidden: false },
          orderBy: { displayOrder: "asc" },
        },
      },
      orderBy: { order: "asc" },
    });
    res.json(categories);
  } catch (err) {
    next(err);
  }
}

export async function getAttractions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resort = await prisma.resort.findFirst({ where: { status: "ACTIVE" } });
    if (!resort) throw new NotFoundError();
    const items = await prisma.nearbyAttraction.findMany({
      where: { resortId: resort.id, active: true },
      orderBy: { order: "asc" },
    });
    res.json(items);
  } catch (err) {
    next(err);
  }
}

export async function getAmenities(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resort = await prisma.resort.findFirst({ where: { status: "ACTIVE" } });
    if (!resort) throw new NotFoundError();
    const items = await prisma.amenitySection.findMany({
      where: { resortId: resort.id, active: true },
      orderBy: { order: "asc" },
    });
    res.json(items);
  } catch (err) {
    next(err);
  }
}

// ─── Availability ─────────────────────────────────────────────────

export const availabilityQuerySchema = z.object({
  checkIn: z.string(),
  checkOut: z.string(),
  adults: z.coerce.number().int().positive().optional(),
  children: z.coerce.number().int().nonnegative().optional(),
  rooms: z.coerce.number().int().positive().optional(),
});

export async function availabilityHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const resort = await prisma.resort.findFirst({ where: { status: "ACTIVE" } });
    if (!resort) throw new NotFoundError();
    const q = req.query as unknown as z.infer<typeof availabilityQuerySchema>;
    const ci = new Date(q.checkIn);
    const co = new Date(q.checkOut);
    if (co <= ci) {
      res.status(400).json({ error: { code: "INVALID_DATES", message: "Check-out must be after check-in" } });
      return;
    }
    const nights = Math.round((co.getTime() - ci.getTime()) / 86400_000);
    if (nights > 30) {
      res.status(400).json({ error: { code: "MAX_STAY_EXCEEDED", message: "Maximum stay duration is 30 nights" } });
      return;
    }
    const result = await getAvailability({
      resortId: resort.id,
      checkIn: q.checkIn,
      checkOut: q.checkOut,
      adults: q.adults,
      children: q.children,
      rooms: q.rooms,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ─── Hold ──────────────────────────────────────────────────────────

export const createHoldSchema = z.object({
  roomTypeId: z.string(),
  checkIn: z.string(),
  checkOut: z.string(),
  rooms: z.coerce.number().int().positive().default(1),
  quantity: z.coerce.number().int().positive().optional(),
  amount: z.coerce.number().int().positive().optional(),
  totalAmount: z.coerce.number().int().positive().optional(),
  nightlyRate: z.coerce.number().int().positive().optional(),
});

function hasNegativeNumericFields(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const keys = ["rooms", "quantity", "adults", "children", "amount", "totalAmount", "nightlyRate"];
  for (const key of keys) {
    const v = (body as Record<string, unknown>)[key];
    if (typeof v === "number" && !Number.isNaN(v) && v < 0) return key;
    if (typeof v === "string" && v.trim() !== "" && Number(v) < 0) return key;
  }
  return null;
}

function getOrSetSessionId(req: Request, res: Response): string {
  let sid = req.cookies?.["swr_sid"];
  if (!sid) {
    sid = generateSessionId();
    res.cookie("swr_sid", sid, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
  return sid;
}

export async function createHoldHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const resort = await prisma.resort.findFirst({ where: { status: "ACTIVE" } });
    if (!resort) throw new NotFoundError();
    const negative = hasNegativeNumericFields(req.body);
    if (negative) {
      res.status(400).json({
        error: { code: "INVALID_AMOUNT", message: `${negative} must not be negative` },
      });
      return;
    }
    const parsed = createHoldSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Validation failed" } });
      return;
    }
    const body = parsed.data;
    const ci = new Date(body.checkIn);
    const co = new Date(body.checkOut);
    if (co <= ci) {
      res.status(400).json({ error: { code: "INVALID_DATES", message: "Check-out must be after check-in" } });
      return;
    }
    if (Math.round((co.getTime() - ci.getTime()) / 86400_000) > 30) {
      res.status(400).json({ error: { code: "MAX_STAY_EXCEEDED", message: "Maximum stay duration is 30 nights" } });
      return;
    }
    const sid = getOrSetSessionId(req, res);
    const hold = await createHold({
      resortId: resort.id,
      roomTypeId: body.roomTypeId,
      quantity: body.rooms,
      checkIn: new Date(body.checkIn),
      checkOut: new Date(body.checkOut),
      sessionId: sid,
    });
    res.status(201).json({
      holdId: hold.id,
      expiresAt: hold.expiresAt,
      secondsLeft: Math.max(0, Math.floor((hold.expiresAt.getTime() - Date.now()) / 1000)),
      pricing: {
        nightlyRate: hold.nightlyRate,
        subtotal: hold.nightlyRate * hold.quantity,
        total: hold.totalAmount,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getHoldHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const hold = await getHold(req.params.holdId);
    if (!hold) throw new NotFoundError();
    res.json({
      holdId: hold.id,
      status: hold.status,
      expiresAt: hold.expiresAt,
      secondsLeft: Math.max(0, Math.floor((hold.expiresAt.getTime() - Date.now()) / 1000)),
    });
  } catch (err) {
    next(err);
  }
}

export async function releaseHoldHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await releaseHold(req.params.holdId, "user_cancelled");
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ─── Booking creation from hold ────────────────────────────────────

export const createFromHoldSchema = z.object({
  holdId: z.string(),
  guest: z.object({
    fullName: z.string().min(1),
    phone: z.string().min(6),
    countryCode: z.string().default("+91"),
    email: z.string().email().optional(),
    address: z.string().optional(),
    idType: z.string().optional(),
    idNumber: z.string().optional(),
  }),
  specialRequests: z.string().optional(),
  arrivalTime: z.string().optional(),
  adults: z.coerce.number().int().positive().optional(),
  children: z.coerce.number().int().nonnegative().optional(),
});

export async function createFromHoldHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const resort = await prisma.resort.findFirst({ where: { status: "ACTIVE" } });
    if (!resort) throw new NotFoundError();
    const negative = hasNegativeNumericFields(req.body);
    if (negative) {
      res.status(400).json({
        error: { code: "INVALID_AMOUNT", message: `${negative} must not be negative` },
      });
      return;
    }
    const parsed = createFromHoldSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Validation failed" } });
      return;
    }
    const body = parsed.data;
    const r = await createFromHold({
      resortId: resort.id,
      holdId: body.holdId,
      guest: {
        ...body.guest,
        fullName: sanitizeInput(body.guest.fullName),
        phone: sanitizeInput(body.guest.phone),
        email: sanitizeOptional(body.guest.email) ?? undefined,
        address: sanitizeOptional(body.guest.address) ?? undefined,
      },
      specialRequests: sanitizeOptional(body.specialRequests) ?? undefined,
      arrivalTime: body.arrivalTime,
      adults: body.adults,
      children: body.children,
      source: req.staff ? "ADMIN" : "WEBSITE",
      ip: req.ip ?? undefined,
      userAgent: req.header("user-agent") ?? undefined,
    });
    res.status(201).json(r);
  } catch (err) {
    next(err);
  }
}

// ─── Lookup ────────────────────────────────────────────────────────

export const lookupSchema = z.object({
  id: z.string(),
  phone: z.string().min(6),
});

export async function lookupHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resort = await prisma.resort.findFirst({ where: { status: "ACTIVE" } });
    if (!resort) throw new NotFoundError();
    const q = req.query as unknown as z.infer<typeof lookupSchema>;
    const r = await lookupReservation({
      resortId: resort.id,
      bookingReference: q.id,
      phone: q.phone,
    });
    res.json(r);
  } catch (err) {
    next(err);
  }
}

// ─── Payments (Razorpay) ───────────────────────────────────────────

export const createPaymentOrderSchema = z.object({
  reservationId: z.string().min(1),
  phone: z.string().min(6),
});

export async function createPaymentOrderHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const negative = hasNegativeNumericFields(req.body);
    if (negative) {
      res.status(400).json({
        error: { code: "INVALID_AMOUNT", message: `${negative} must not be negative` },
      });
      return;
    }
    const parsed = createPaymentOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Validation failed" } });
      return;
    }
    const body = parsed.data;
    const result = await createOrderForReservation({
      reservationId: body.reservationId,
      phone: body.phone,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export const verifyPaymentSchema = z.object({
  reservationId: z.string().min(1),
  phone: z.string().min(6),
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

export async function verifyPaymentHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as z.infer<typeof verifyPaymentSchema>;
    const result = await verifyAndCapture({
      reservationId: body.reservationId,
      phone: body.phone,
      razorpayOrderId: body.razorpayOrderId,
      razorpayPaymentId: body.razorpayPaymentId,
      razorpaySignature: body.razorpaySignature,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getPaymentConfigHandler(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    res.json({
      configured: isRazorpayConfigured(),
      keyId: getPublicKeyId() || null,
    });
  } catch (err) {
    next(err);
  }
}

// ─── Enquiry ───────────────────────────────────────────────────────

export const enquirySchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(6),
  email: z.string().email().optional(),
  requestedCheckIn: z.string().optional(),
  requestedCheckOut: z.string().optional(),
  adults: z.coerce.number().int().positive().optional(),
  children: z.coerce.number().int().nonnegative().optional(),
  message: z.string().optional(),
  source: z.enum(["WEBSITE_FORM", "WHATSAPP", "PHONE", "WALK_IN", "OTHER"]).default("WEBSITE_FORM"),
});

export async function createEnquiryHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const resort = await prisma.resort.findFirst({ where: { status: "ACTIVE" } });
    if (!resort) throw new NotFoundError();
    const body = req.body as z.infer<typeof enquirySchema>;
    const e = await prisma.enquiry.create({
      data: {
        resortId: resort.id,
        name: sanitizeInput(body.name),
        phone: sanitizeInput(body.phone),
        email: sanitizeOptional(body.email) ?? undefined,
        requestedCheckIn: body.requestedCheckIn ? new Date(body.requestedCheckIn) : null,
        requestedCheckOut: body.requestedCheckOut ? new Date(body.requestedCheckOut) : null,
        adults: body.adults,
        children: body.children,
        message: sanitizeOptional(body.message) ?? undefined,
        source: body.source ?? "WEBSITE_FORM",
        status: "NEW",
      },
    });
    res.status(201).json({ id: e.id });
  } catch (err) {
    next(err);
  }
}
