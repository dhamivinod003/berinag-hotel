// Configurable content & pricing endpoints. Wired to the admin shell so the
// owner can edit room types, photos, gallery, and offers from the dashboard.
//
// Every endpoint is multi-tenant: the resort is derived from req.staff.resortId.
// All writes are audited via the `audit()` middleware. RBAC permission keys
// follow the existing pattern (ROOM_TYPE_EDIT, OFFER_*, GALLERY_*, etc.).

import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../config/database.js";
import { audit } from "../middleware/audit.js";
import { NotFoundError, BadRequestError } from "../utils/errors.js";

// ─── Helpers ─────────────────────────────────────────────────────────

async function getResortId(req: Request): Promise<string> {
  const id = req.staff!.resortId;
  if (!id) throw new BadRequestError("Staff has no resort assignment");
  return id;
}

// ─── Room Types ───────────────────────────────────────────────────────

export const updateRoomTypeSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  shortDesc: z.string().max(300).optional(),
  description: z.string().max(4000).optional(),
  basePrice: z.coerce.number().int().positive().max(100_000_000).optional(), // paise
  maxAdults: z.coerce.number().int().positive().max(20).optional(),
  maxChildren: z.coerce.number().int().nonnegative().max(20).optional(),
  maxOccupancy: z.coerce.number().int().positive().max(40).optional(),
  bedConfiguration: z.string().max(120).optional(),
  areaSqft: z.coerce.number().int().positive().max(100_000).optional(),
  view: z.string().max(120).optional(),
  totalUnits: z.coerce.number().int().positive().max(10_000).optional(),
  status: z.enum(["ACTIVE", "HIDDEN", "ARCHIVED"]).optional(),
  displayOrder: z.coerce.number().int().min(0).max(9999).optional(),
});

export async function updateRoomType(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const resortId = await getResortId(req);
    const body = req.body as z.infer<typeof updateRoomTypeSchema>;
    const existing = await prisma.roomType.findFirst({
      where: { id: req.params.id, resortId, deletedAt: null },
    });
    if (!existing) throw new NotFoundError("Room type not found");
    const before = { basePrice: existing.basePrice, name: existing.name };
    const updated = await prisma.roomType.update({
      where: { id: existing.id },
      data: body,
    });
    await audit({
      resortId,
      actorType: "staff",
      actorId: req.staff?.id,
      action: "roomType.update",
      entity: "RoomType",
      entityId: updated.id,
      before,
      after: body,
      ip: req.ip,
      userAgent: req.header("user-agent") ?? undefined,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// ─── Room Type Photos ────────────────────────────────────────────────

export const addRoomPhotoSchema = z.object({
  url: z.string().url(),
  publicId: z.string().default(""),
  alt: z.string().max(200).optional(),
  isCover: z.boolean().default(false),
  displayOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export async function addRoomPhoto(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const resortId = await getResortId(req);
    const body = req.body as z.infer<typeof addRoomPhotoSchema>;
    const roomType = await prisma.roomType.findFirst({
      where: { id: req.params.id, resortId, deletedAt: null },
    });
    if (!roomType) throw new NotFoundError("Room type not found");
    if (body.isCover) {
      // Reset other covers
      await prisma.roomTypePhoto.updateMany({
        where: { roomTypeId: roomType.id, isCover: true },
        data: { isCover: false },
      });
    }
    const photo = await prisma.roomTypePhoto.create({
      data: {
        resortId,
        roomTypeId: roomType.id,
        url: body.url,
        publicId: body.publicId,
        alt: body.alt,
        isCover: body.isCover,
        displayOrder: body.displayOrder,
      },
    });
    await audit({
      resortId,
      actorType: "staff",
      actorId: req.staff?.id,
      action: "roomType.photo.add",
      entity: "RoomTypePhoto",
      entityId: photo.id,
      after: { url: photo.url },
      ip: req.ip,
      userAgent: req.header("user-agent") ?? undefined,
    });
    res.status(201).json(photo);
  } catch (err) {
    next(err);
  }
}

export async function deleteRoomPhoto(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const resortId = await getResortId(req);
    const photo = await prisma.roomTypePhoto.findFirst({
      where: { id: req.params.photoId, resortId },
    });
    if (!photo) throw new NotFoundError("Photo not found");
    await prisma.roomTypePhoto.delete({ where: { id: photo.id } });
    await audit({
      resortId,
      actorType: "staff",
      actorId: req.staff?.id,
      action: "roomType.photo.delete",
      entity: "RoomTypePhoto",
      entityId: photo.id,
      before: { url: photo.url },
      ip: req.ip,
      userAgent: req.header("user-agent") ?? undefined,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ─── Gallery ──────────────────────────────────────────────────────────

export const addGalleryImageSchema = z.object({
  url: z.string().url(),
  publicId: z.string().default(""),
  categorySlug: z.string().min(1).max(60).default("general"),
  alt: z.string().max(200).optional(),
  caption: z.string().max(300).optional(),
  displayOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isFeatured: z.boolean().default(false),
});

async function getOrCreateCategory(resortId: string, slug: string, name?: string) {
  return prisma.galleryCategory.upsert({
    where: { resortId_slug: { resortId, slug } },
    update: {},
    create: { resortId, slug, name: name ?? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) },
  });
}

export async function addGalleryImage(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const resortId = await getResortId(req);
    const body = req.body as z.infer<typeof addGalleryImageSchema>;
    const category = await getOrCreateCategory(resortId, body.categorySlug);
    const img = await prisma.galleryImage.create({
      data: {
        resortId,
        categoryId: category.id,
        url: body.url,
        publicId: body.publicId,
        alt: body.alt,
        caption: body.caption,
        displayOrder: body.displayOrder,
        isFeatured: body.isFeatured,
      },
    });
    await audit({
      resortId,
      actorType: "staff",
      actorId: req.staff?.id,
      action: "gallery.add",
      entity: "GalleryImage",
      entityId: img.id,
      after: { url: img.url, category: category.slug },
      ip: req.ip,
      userAgent: req.header("user-agent") ?? undefined,
    });
    res.status(201).json(img);
  } catch (err) {
    next(err);
  }
}

export async function deleteGalleryImage(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const resortId = await getResortId(req);
    const img = await prisma.galleryImage.findFirst({
      where: { id: req.params.id, resortId },
    });
    if (!img) throw new NotFoundError("Image not found");
    await prisma.galleryImage.delete({ where: { id: img.id } });
    await audit({
      resortId,
      actorType: "staff",
      actorId: req.staff?.id,
      action: "gallery.delete",
      entity: "GalleryImage",
      entityId: img.id,
      before: { url: img.url },
      ip: req.ip,
      userAgent: req.header("user-agent") ?? undefined,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ─── Offers ───────────────────────────────────────────────────────────

export const offerUpsertSchema = z.object({
  id: z.string().optional(), // for update
  slug: z.string().min(1).max(60).optional(),
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(2000),
  shortDesc: z.string().max(300).optional(),
  imageUrl: z.string().url().optional(),
  discountType: z.enum(["PERCENT", "FLAT"]),
  discountValue: z.coerce.number().int().positive(),
  minNights: z.coerce.number().int().positive().optional(),
  promoCode: z.string().max(40).optional(),
  startDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  endDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  terms: z.string().max(2000).optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "PAUSED", "EXPIRED"]).default("DRAFT"),
  roomTypeIds: z.array(z.string()).default([]),
});

export async function upsertOffer(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const resortId = await getResortId(req);
    const body = req.body as z.infer<typeof offerUpsertSchema>;
    if (new Date(body.endDate) <= new Date(body.startDate)) {
      throw new BadRequestError("endDate must be after startDate");
    }
    const data = {
      resortId,
      name: body.name,
      description: body.description,
      shortDesc: body.shortDesc,
      imageUrl: body.imageUrl,
      discountType: body.discountType,
      discountValue: body.discountValue,
      minNights: body.minNights,
      promoCode: body.promoCode,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      terms: body.terms,
      status: body.status,
    };
    let offer;
    if (body.id) {
      const existing = await prisma.offer.findFirst({
        where: { id: body.id, resortId, deletedAt: null },
      });
      if (!existing) throw new NotFoundError("Offer not found");
      offer = await prisma.offer.update({ where: { id: existing.id }, data });
    } else {
      // Auto-slug if not provided
      const autoSlug = body.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 50);
      const slug = body.slug ?? (autoSlug || `offer-${Date.now()}`);
      try {
        offer = await prisma.offer.create({ data: { ...data, slug } });
      } catch (e: any) {
        if (e?.code === "P2002") {
          throw new BadRequestError("Slug or promo code already exists");
        }
        throw e;
      }
    }
    // Replace room type associations
    await prisma.offerRoomType.deleteMany({ where: { offerId: offer.id } });
    if (body.roomTypeIds.length > 0) {
      await prisma.offerRoomType.createMany({
        data: body.roomTypeIds.map((roomTypeId) => ({ offerId: offer.id, roomTypeId })),
      });
    }
    await audit({
      resortId,
      actorType: "staff",
      actorId: req.staff?.id,
      action: body.id ? "offer.update" : "offer.create",
      entity: "Offer",
      entityId: offer.id,
      after: { name: offer.name, status: offer.status },
      ip: req.ip,
      userAgent: req.header("user-agent") ?? undefined,
    });
    const full = await prisma.offer.findUnique({
      where: { id: offer.id },
      include: { roomTypes: true },
    });
    res.status(body.id ? 200 : 201).json(full);
  } catch (err) {
    next(err);
  }
}

export async function deleteOffer(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const resortId = await getResortId(req);
    const offer = await prisma.offer.findFirst({
      where: { id: req.params.id, resortId, deletedAt: null },
    });
    if (!offer) throw new NotFoundError("Offer not found");
    // Soft delete so historical bookings keep referential integrity.
    await prisma.offer.update({
      where: { id: offer.id },
      data: { deletedAt: new Date(), status: "EXPIRED" },
    });
    await audit({
      resortId,
      actorType: "staff",
      actorId: req.staff?.id,
      action: "offer.delete",
      entity: "Offer",
      entityId: offer.id,
      before: { name: offer.name },
      ip: req.ip,
      userAgent: req.header("user-agent") ?? undefined,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function getOffer(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const resortId = await getResortId(req);
    const offer = await prisma.offer.findFirst({
      where: { id: req.params.id, resortId, deletedAt: null },
      include: { roomTypes: { include: { roomType: { select: { id: true, name: true, slug: true } } } } },
    });
    if (!offer) throw new NotFoundError("Offer not found");
    res.json(offer);
  } catch (err) {
    next(err);
  }
}

// ─── Rate Plans / Seasonal Overrides ─────────────────────────────────

export const ratePlanSchema = z.object({
  roomTypeId: z.string(),
  startDate: z.string().refine((v) => !Number.isNaN(Date.parse(v))),
  endDate: z.string().refine((v) => !Number.isNaN(Date.parse(v))),
  rate: z.coerce.number().int().positive(),
  minNights: z.coerce.number().int().positive().optional(),
  maxNights: z.coerce.number().int().positive().optional(),
  priority: z.coerce.number().int().min(0).max(100).default(0),
  active: z.boolean().default(true),
});

export async function listRatePlans(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const resortId = await getResortId(req);
    const roomTypeId = req.query.roomTypeId as string | undefined;
    const rows = await prisma.roomRate.findMany({
      where: { resortId, ...(roomTypeId ? { roomTypeId } : {}) },
      orderBy: [{ startDate: "asc" }, { priority: "desc" }],
    });
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
}

export async function createRatePlan(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const resortId = await getResortId(req);
    const body = req.body as z.infer<typeof ratePlanSchema>;
    if (new Date(body.endDate) <= new Date(body.startDate)) {
      throw new BadRequestError("endDate must be after startDate");
    }
    const rt = await prisma.roomType.findFirst({
      where: { id: body.roomTypeId, resortId, deletedAt: null },
    });
    if (!rt) throw new NotFoundError("Room type not found");
    const plan = await prisma.roomRate.create({
      data: {
        resortId,
        roomTypeId: body.roomTypeId,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        rate: body.rate,
        minNights: body.minNights,
        maxNights: body.maxNights,
        priority: body.priority,
        active: body.active,
      },
    });
    await audit({
      resortId,
      actorType: "staff",
      actorId: req.staff?.id,
      action: "ratePlan.create",
      entity: "RoomRate",
      entityId: plan.id,
      after: { roomTypeId: rt.id, rate: plan.rate },
      ip: req.ip,
      userAgent: req.header("user-agent") ?? undefined,
    });
    res.status(201).json(plan);
  } catch (err) {
    next(err);
  }
}

export async function deleteRatePlan(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const resortId = await getResortId(req);
    const plan = await prisma.roomRate.findFirst({
      where: { id: req.params.id, resortId },
    });
    if (!plan) throw new NotFoundError("Rate plan not found");
    await prisma.roomRate.delete({ where: { id: plan.id } });
    await audit({
      resortId,
      actorType: "staff",
      actorId: req.staff?.id,
      action: "ratePlan.delete",
      entity: "RoomRate",
      entityId: plan.id,
      before: { rate: plan.rate },
      ip: req.ip,
      userAgent: req.header("user-agent") ?? undefined,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
