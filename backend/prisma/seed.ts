// Seed: 1 resort, 1 owner, 5 roles, 4 room types, 18 physical rooms,
// amenities, default settings, sample offers + reviews.

import { PrismaClient } from "@prisma/client";
import { PERMISSIONS } from "../src/rbac/permissions.js";
import { DEFAULT_ROLES } from "../src/rbac/roles.js";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding...");

  // ─── Resort ─────────────────────────────────────────────────────
  const resort = await prisma.resort.upsert({
    where: { slug: "sun-and-water" },
    update: {},
    create: {
      slug: "sun-and-water",
      name: "Sun & Water Resort",
      description:
        "A premium Himalayan retreat in the heart of Pithoragarh, Uttarakhand. Wake up to misty mountain views, dine by the water, and let the Himalayas slow you down.",
      phone: "+91 98765 43210",
      whatsapp: "919876543210",
      email: "info@sunandwaterresort.com",
      address: "Sun & Water Resort, Pithoragarh",
      city: "Pithoragarh",
      state: "Uttarakhand",
      country: "India",
      latitude: 29.5828,
      longitude: 80.2183,
      checkInTime: "14:00",
      checkOutTime: "11:00",
      timezone: "Asia/Kolkata",
      currency: "INR",
      status: "ACTIVE",
    },
  });

  // ─── Permissions ────────────────────────────────────────────────
  for (const key of PERMISSIONS) {
    const group = key.toLowerCase().split("_")[0];
    await prisma.permission.upsert({
      where: { key },
      update: { group },
      create: { key, group, description: key.replace(/_/g, " ").toLowerCase() },
    });
  }

  // ─── Roles ──────────────────────────────────────────────────────
  const allPerms = await prisma.permission.findMany();
  const permByKey = new Map(allPerms.map((p) => [p.key, p]));

  for (const roleTpl of DEFAULT_ROLES) {
    const role = await prisma.role.upsert({
      where: { resortId_key: { resortId: resort.id, key: roleTpl.key } },
      update: { name: roleTpl.name, description: roleTpl.description },
      create: {
        resortId: resort.id,
        key: roleTpl.key,
        name: roleTpl.name,
        description: roleTpl.description,
        isSystem: roleTpl.isSystem,
      },
    });

    // Wipe and re-grant permissions from the template.
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });

    if (roleTpl.key === "OWNER") {
      // Owner gets every permission.
      await prisma.rolePermission.createMany({
        data: allPerms.map((p) => ({
          roleId: role.id,
          permissionId: p.id,
          resortId: resort.id,
        })),
      });
    } else {
      const ids = roleTpl.permissions
        .map((k) => permByKey.get(k)?.id)
        .filter((x): x is string => Boolean(x));
      await prisma.rolePermission.createMany({
        data: ids.map((pid) => ({
          roleId: role.id,
          permissionId: pid,
          resortId: resort.id,
        })),
      });
    }
  }

  // ─── Staff (random password — never the old default) ─────────────
  const { generateSeedPassword, hashSeedPassword, hashIsForbiddenPassword } = await import(
    "../src/utils/seedPassword.js"
  );
  const seedPassword = generateSeedPassword();
  const passwordHash = await hashSeedPassword(seedPassword);
  let issuedTemporaryPassword = false;

  async function upsertStaff(opts: {
    email: string;
    name: string;
    roleKey: string;
    forceRotate?: boolean;
  }): Promise<void> {
    const existing = await prisma.staff.findFirst({
      where: { resortId: resort.id, email: opts.email },
    });
    const mustRotate =
      Boolean(opts.forceRotate) || !existing || (await hashIsForbiddenPassword(existing.passwordHash));
    if (mustRotate) issuedTemporaryPassword = true;
    await prisma.staff.upsert({
      where: { resortId_email: { resortId: resort.id, email: opts.email } },
      update: {
        ...(mustRotate ? { passwordHash } : {}),
        roleKey: opts.roleKey,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
      create: {
        resortId: resort.id,
        email: opts.email,
        name: opts.name,
        roleKey: opts.roleKey,
        passwordHash,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });
  }

  await upsertStaff({
    email: "owner@sunandwaterresort.com",
    name: "Resort Owner",
    roleKey: "OWNER",
    forceRotate: true,
  });
  await upsertStaff({
    email: "manager@sunandwaterresort.com",
    name: "Resort Manager",
    roleKey: "MANAGER",
  });
  await upsertStaff({
    email: "reception@sunandwaterresort.com",
    name: "Front Desk",
    roleKey: "RECEPTION",
  });

  // ─── Amenities ──────────────────────────────────────────────────
  const amenityList = [
    { key: "wifi", name: "High-speed Wi-Fi", icon: "Wifi", category: "tech" },
    { key: "ac", name: "Air conditioning", icon: "Snowflake", category: "comfort" },
    { key: "tv", name: "Smart TV", icon: "Tv", category: "comfort" },
    { key: "balcony", name: "Private balcony", icon: "Mountain", category: "view" },
    { key: "room_service", name: "Room service", icon: "Coffee", category: "service" },
    { key: "hot_water", name: "24/7 hot water", icon: "Bath", category: "comfort" },
    { key: "minibar", name: "Mini-bar", icon: "Coffee", category: "comfort" },
    { key: "lounge", name: "Lounge area", icon: "Coffee", category: "space" },
    { key: "fireplace", name: "Fireplace", icon: "Flame", category: "comfort" },
    { key: "tub", name: "Deep tub", icon: "Bath", category: "comfort" },
  ];
  for (const a of amenityList) {
    await prisma.amenity.upsert({
      where: { key: a.key },
      update: { name: a.name, icon: a.icon, category: a.category },
      create: a,
    });
  }
  const allAmenities = await prisma.amenity.findMany();
  const amenityByKey = new Map(allAmenities.map((a) => [a.key, a]));

  // ─── Room types ─────────────────────────────────────────────────
  const roomTypeDefs = [
    {
      slug: "deluxe-room",
      name: "Deluxe Room",
      shortDesc: "Mountain-view comfort with a private balcony.",
      description:
        "Our signature Deluxe Room offers sweeping views of the Himalayan foothills, a private balcony, and warm wood interiors. Perfect for couples and solo travellers looking to unwind.",
      maxAdults: 2,
      maxChildren: 1,
      maxOccupancy: 3,
      bedConfiguration: "1 King Bed",
      areaSqft: 250,
      view: "Mountain",
      basePrice: 450000,
      totalUnits: 10,
      displayOrder: 1,
      coverImage:
        "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1200&q=80",
      gallery: [
        "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1493770348161-369560ae357d?auto=format&fit=crop&w=400&q=80",
      ],
      amenities: ["wifi", "ac", "tv", "balcony", "room_service", "hot_water"],
    },
    {
      slug: "premium-room",
      name: "Premium Room",
      shortDesc: "Larger layout, premium bedding, panoramic windows.",
      description:
        "Step up to a Premium Room with a larger layout, premium king bedding, panoramic windows, and an upgraded bath.",
      maxAdults: 2,
      maxChildren: 1,
      maxOccupancy: 3,
      bedConfiguration: "1 King Bed",
      areaSqft: 300,
      view: "Mountain & Garden",
      basePrice: 600000,
      totalUnits: 4,
      displayOrder: 2,
      coverImage:
        "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
      gallery: [
        "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=80",
      ],
      amenities: ["wifi", "ac", "tv", "balcony", "room_service", "hot_water", "minibar"],
    },
    {
      slug: "family-suite",
      name: "Family Suite",
      shortDesc: "Two bedrooms, a lounge, and a wide mountain terrace.",
      description:
        "Our Family Suite is built for togetherness. Two bedrooms, a cosy lounge, and a wide mountain-facing terrace make this the obvious choice for families travelling through Kumaon.",
      maxAdults: 4,
      maxChildren: 2,
      maxOccupancy: 6,
      bedConfiguration: "2 Double Beds",
      areaSqft: 450,
      view: "Mountain",
      basePrice: 850000,
      totalUnits: 2,
      displayOrder: 3,
      coverImage:
        "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80",
      gallery: [
        "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1493770348161-369560ae357d?auto=format&fit=crop&w=400&q=80",
        "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",
      ],
      amenities: ["wifi", "ac", "tv", "balcony", "room_service", "hot_water", "lounge"],
    },
    {
      slug: "luxury-cottage",
      name: "Luxury Cottage",
      shortDesc: "A standalone cottage with a private sit-out and fireplace.",
      description:
        "Our Luxury Cottages are tucked into the property's quietest corner — standalone, private, and finished with a fireplace, deep tub, and a private sit-out under the stars.",
      maxAdults: 2,
      maxChildren: 1,
      maxOccupancy: 3,
      bedConfiguration: "1 King Bed",
      areaSqft: 550,
      view: "Garden & Mountain",
      basePrice: 950000,
      totalUnits: 2,
      displayOrder: 4,
      coverImage:
        "https://images.unsplash.com/photo-1518733057094-95b53143d2a7?auto=format&fit=crop&w=1200&q=80",
      gallery: [
        "https://images.unsplash.com/photo-1518733057094-95b53143d2a7?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1493770348161-369560ae357d?auto=format&fit=crop&w=400&q=80",
      ],
      amenities: ["wifi", "ac", "tv", "balcony", "fireplace", "tub", "room_service", "hot_water"],
    },
  ];

  const roomTypeBySlug = new Map<string, string>();
  for (const rt of roomTypeDefs) {
    const created = await prisma.roomType.upsert({
      where: { resortId_slug: { resortId: resort.id, slug: rt.slug } },
      update: {
        name: rt.name,
        shortDesc: rt.shortDesc,
        description: rt.description,
        maxAdults: rt.maxAdults,
        maxChildren: rt.maxChildren,
        maxOccupancy: rt.maxOccupancy,
        bedConfiguration: rt.bedConfiguration,
        areaSqft: rt.areaSqft,
        view: rt.view,
        basePrice: rt.basePrice,
        totalUnits: rt.totalUnits,
        displayOrder: rt.displayOrder,
      },
      create: {
        resortId: resort.id,
        slug: rt.slug,
        name: rt.name,
        shortDesc: rt.shortDesc,
        description: rt.description,
        maxAdults: rt.maxAdults,
        maxChildren: rt.maxChildren,
        maxOccupancy: rt.maxOccupancy,
        bedConfiguration: rt.bedConfiguration,
        areaSqft: rt.areaSqft,
        view: rt.view,
        basePrice: rt.basePrice,
        totalUnits: rt.totalUnits,
        displayOrder: rt.displayOrder,
        status: "ACTIVE",
      },
    });
    roomTypeBySlug.set(rt.slug, created.id);

    // Photos
    await prisma.roomTypePhoto.deleteMany({ where: { roomTypeId: created.id } });
    for (let i = 0; i < rt.gallery.length; i++) {
      await prisma.roomTypePhoto.create({
        data: {
          resortId: resort.id,
          roomTypeId: created.id,
          url: rt.gallery[i],
          publicId: `seed-${rt.slug}-${i}`,
          isCover: i === 0,
          displayOrder: i,
        },
      });
    }

    // Amenities
    await prisma.roomTypeAmenity.deleteMany({ where: { roomTypeId: created.id } });
    for (const aKey of rt.amenities) {
      const amenity = amenityByKey.get(aKey);
      if (!amenity) continue;
      await prisma.roomTypeAmenity.create({
        data: { roomTypeId: created.id, amenityId: amenity.id },
      });
    }
  }

  // ─── Physical rooms ─────────────────────────────────────────────
  // Child rows reference Room without ON DELETE CASCADE — wipe them first.
  await prisma.roomAssignment.deleteMany({ where: { resortId: resort.id } });
  await prisma.roomMovement.deleteMany({ where: { resortId: resort.id } });
  await prisma.housekeepingTask.deleteMany({ where: { resortId: resort.id } });
  await prisma.maintenanceRecord.deleteMany({ where: { resortId: resort.id } });
  await prisma.room.deleteMany({ where: { resortId: resort.id } });
  const roomAssignments: Array<{ slug: string; numbers: string[] }> = [
    { slug: "deluxe-room", numbers: ["101", "102", "103", "104", "201", "202", "203", "204", "301", "302"] },
    { slug: "premium-room", numbers: ["105", "106", "205", "206"] },
    { slug: "family-suite", numbers: ["303", "304"] },
    { slug: "luxury-cottage", numbers: ["C1", "C2"] },
  ];
  for (const ra of roomAssignments) {
    const rtId = roomTypeBySlug.get(ra.slug);
    if (!rtId) continue;
    for (const num of ra.numbers) {
      await prisma.room.create({
        data: {
          resortId: resort.id,
          roomTypeId: rtId,
          roomNumber: num,
          floor: num.startsWith("C") ? "Ground" : num[0],
          status: "READY",
          isActive: true,
        },
      });
    }
  }

  // ─── Sample reviews ─────────────────────────────────────────────
  const reviewDefs = [
    {
      source: "GOOGLE",
      authorName: "Ankit Verma",
      authorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
      rating: 5,
      content:
        "Amazing stay! The view, food and hospitality were beyond our expectations. Will definitely visit again. The staff made us feel like family.",
      reviewDate: new Date("2026-07-15"),
      isFeatured: true,
    },
    {
      source: "GOOGLE",
      authorName: "Priya Sharma",
      authorAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80",
      rating: 5,
      content:
        "Beautiful property with a peaceful environment. Perfect for family vacations. The cottage was spotless and the food was outstanding.",
      reviewDate: new Date("2026-06-22"),
      isFeatured: true,
    },
    {
      source: "GOOGLE",
      authorName: "Rohit Singh",
      authorAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
      rating: 5,
      content:
        "Very clean rooms, great service and the staff is very polite and helpful. The pool at sunset is something I will remember for a long time.",
      reviewDate: new Date("2026-06-03"),
      isFeatured: true,
    },
    {
      source: "DIRECT",
      authorName: "Sneha Kapoor",
      authorAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80",
      rating: 4,
      content: "Loved the food and the view from the room. The check-in was quick and the staff was very attentive.",
      reviewDate: new Date("2026-05-18"),
    },
  ];
  await prisma.review.deleteMany({ where: { resortId: resort.id } });
  for (const r of reviewDefs) {
    await prisma.review.create({
      data: { ...r, resortId: resort.id, status: "PUBLISHED" },
    });
  }

  // ─── Hero section ───────────────────────────────────────────────
  await prisma.websiteSection.upsert({
    where: { resortId_key: { resortId: resort.id, key: "hero" } },
    update: {},
    create: {
      resortId: resort.id,
      key: "hero",
      title: "Hero",
      active: true,
      content: JSON.stringify({
        headline: "Relax. Refresh. Reconnect.",
        subheadline:
          "Experience the perfect blend of nature, comfort and warm hospitality in Pithoragarh.",
        imageUrl:
          "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=2400&q=80",
        imagePublicId: "seed-hero",
        primaryCtaLabel: "Book Your Stay",
        primaryCtaHref: "/booking",
        secondaryCtaLabel: "Chat on WhatsApp",
        secondaryCtaHref: "https://wa.me/919876543210",
      }),
    },
  });

  // ─── Default settings ───────────────────────────────────────────
  const defaultSettings: Record<string, unknown> = {
    "booking.hold_minutes": 10,
    "booking.min_nights": 1,
    "booking.max_nights": 30,
    "booking.allow_pending_balance": true,
    "cancellation.free_until_hours": 168,
    "cancellation.partial_charge_pct": 50,
    "tax.gst_pct": 12,
    "whatsapp.number": "919876543210",
    "social.instagram": "https://instagram.com/sunandwaterresort",
    "social.facebook": "https://facebook.com/sunandwaterresort",
  };
  for (const [key, value] of Object.entries(defaultSettings)) {
    await prisma.websiteSetting.upsert({
      where: { resortId_key: { resortId: resort.id, key } },
      update: { value: JSON.stringify(value) },
      create: { resortId: resort.id, key, value: JSON.stringify(value) },
    });
  }

  console.log("Seed complete.");
  if (issuedTemporaryPassword) {
    console.warn("⚠️  TEMPORARY OWNER PASSWORD — change it immediately after first login.");
    console.warn(`    owner@sunandwaterresort.com / ${seedPassword}`);
    console.warn("    This password is shown once. It is not stored in plaintext.");
  } else {
    console.log("Staff accounts already had unique passwords; existing hashes were left unchanged.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
