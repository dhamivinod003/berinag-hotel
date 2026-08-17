import type { AvailabilityResult, ResortInfo, Review, RoomAmenityRef, RoomType } from "./types";

// Build a RoomAmenityRef[] from a list of amenity keys. Mock fallback.
const AMENITY_LABELS: Record<string, string> = {
  wifi: "High-speed Wi-Fi",
  ac: "Air conditioning",
  tv: "Smart TV",
  balcony: "Private balcony",
  room_service: "Room service",
  hot_water: "24/7 hot water",
  minibar: "Mini-bar",
  lounge: "Lounge area",
  fireplace: "Fireplace",
  tub: "Deep tub",
};
const amen = (key: string): RoomAmenityRef => ({
  roomTypeId: "rt-mock",
  amenityId: `am-${key}`,
  amenity: { id: `am-${key}`, key, name: AMENITY_LABELS[key] ?? key, category: "general" },
});
const amenities = (...keys: string[]): RoomAmenityRef[] => keys.map(amen);

// Curated Himalayan / mountain imagery from Unsplash (royalty-free).
const IMG = {
  hero: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=2400&q=80",
  deluxe: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1200&q=80",
  premium: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
  family: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80",
  cottage: "https://images.unsplash.com/photo-1518733057094-95b53143d2a7?auto=format&fit=crop&w=1200&q=80",
  pool: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80",
  restaurant: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=80",
  mountain: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",
  trek: "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=1200&q=80",
  breakfast: "https://images.unsplash.com/photo-1493770348161-369560ae357d?auto=format&fit=crop&w=400&q=80",
  avatar1: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
  avatar2: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80",
  avatar3: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
};

export const resort: ResortInfo = {
  name: "Sun & Water Resort",
  tagline: "Relax. Refresh. Reconnect.",
  description:
    "A premium Himalayan retreat in the heart of Pithoragarh, Uttarakhand. Wake up to misty mountain views, dine by the water, and let the Himalayas slow you down.",
  phone: "+91 98765 43210",
  whatsapp: "916395628206",
  email: "info@sunandwaterresort.com",
  address: "Sun & Water Resort, Pithoragarh",
  city: "Pithoragarh",
  state: "Uttarakhand",
  country: "India",
  checkInTime: "14:00",
  checkOutTime: "11:00",
  social: {
    instagram: "https://instagram.com/sunandwaterresort",
    facebook: "https://facebook.com/sunandwaterresort",
  },
};

export const roomTypes: RoomType[] = [
  {
    id: "rt-deluxe",
    slug: "deluxe-room",
    name: "Deluxe Room",
    shortDesc: "Mountain-view comfort with a private balcony.",
    description:
      "Our signature Deluxe Room offers sweeping views of the Himalayan foothills, a private balcony, and warm wood interiors. Perfect for couples and solo travellers looking to unwind.",
    maxAdults: 2,
    maxChildren: 1,
    bedConfiguration: "1 King Bed",
    areaSqft: 250,
    view: "Mountain",
    basePrice: 450000, // ₹4,500
    totalUnits: 10,
    coverImage: IMG.deluxe,
    galleryImages: [IMG.deluxe, IMG.pool, IMG.mountain, IMG.breakfast],
    amenities: amenities("wifi", "ac", "tv", "balcony", "room_service", "hot_water"),
  },
  {
    id: "rt-premium",
    slug: "premium-room",
    name: "Premium Room",
    shortDesc: "Larger layout, premium bedding, panoramic windows.",
    description:
      "Step up to a Premium Room with a larger layout, premium king bedding, panoramic windows, and an upgraded bath. Ideal for guests who want a little extra space and quiet.",
    maxAdults: 2,
    maxChildren: 1,
    bedConfiguration: "1 King Bed",
    areaSqft: 300,
    view: "Mountain & Garden",
    basePrice: 600000, // ₹6,000
    totalUnits: 4,
    coverImage: IMG.premium,
    galleryImages: [IMG.premium, IMG.mountain, IMG.restaurant],
    amenities: amenities("wifi", "ac", "tv", "balcony", "room_service", "hot_water", "minibar"),
  },
  {
    id: "rt-family",
    slug: "family-suite",
    name: "Family Suite",
    shortDesc: "Two bedrooms, a lounge, and a wide mountain terrace.",
    description:
      "Our Family Suite is built for togetherness. Two bedrooms, a cosy lounge, and a wide mountain-facing terrace make this the obvious choice for families travelling through Kumaon.",
    maxAdults: 4,
    maxChildren: 2,
    bedConfiguration: "2 Double Beds",
    areaSqft: 450,
    view: "Mountain",
    basePrice: 850000, // ₹8,500
    totalUnits: 2,
    coverImage: IMG.family,
    galleryImages: [IMG.family, IMG.breakfast, IMG.mountain],
    amenities: amenities("wifi", "ac", "tv", "balcony", "room_service", "hot_water", "lounge"),
  },
  {
    id: "rt-cottage",
    slug: "luxury-cottage",
    name: "Luxury Cottage",
    shortDesc: "A standalone cottage with a private sit-out and fireplace.",
    description:
      "Our Luxury Cottages are tucked into the property's quietest corner — standalone, private, and finished with a fireplace, deep tub, and a private sit-out under the stars.",
    maxAdults: 2,
    maxChildren: 1,
    bedConfiguration: "1 King Bed",
    areaSqft: 550,
    view: "Garden & Mountain",
    basePrice: 950000, // ₹9,500
    totalUnits: 2,
    coverImage: IMG.cottage,
    galleryImages: [IMG.cottage, IMG.pool, IMG.mountain, IMG.breakfast],
    amenities: amenities("wifi", "ac", "tv", "balcony", "fireplace", "tub", "room_service", "hot_water"),
  },
];

export const reviews: Review[] = [
  {
    id: "r1",
    authorName: "Ankit Verma",
    authorAvatar: IMG.avatar1,
    rating: 5,
    body: "Amazing stay! The view, food and hospitality were beyond our expectations. Will definitely visit again. The staff made us feel like family.",
    source: "GOOGLE",
    stayDate: "2026-07-15",
  },
  {
    id: "r2",
    authorName: "Priya Sharma",
    authorAvatar: IMG.avatar2,
    rating: 5,
    body: "Beautiful property with a peaceful environment. Perfect for family vacations. The cottage was spotless and the food was outstanding.",
    source: "GOOGLE",
    stayDate: "2026-06-22",
  },
  {
    id: "r3",
    authorName: "Rohit Singh",
    authorAvatar: IMG.avatar3,
    rating: 5,
    body: "Very clean rooms, great service and the staff is very polite and helpful. The pool at sunset is something I will remember for a long time.",
    source: "GOOGLE",
    stayDate: "2026-06-03",
  },
  {
    id: "r4",
    authorName: "Sneha Kapoor",
    authorAvatar: IMG.avatar2,
    rating: 4,
    body: "Loved the food and the view from the room. The check-in was quick and the staff was very attentive. Would recommend to friends.",
    source: "DIRECT",
    stayDate: "2026-05-18",
  },
  {
    id: "r5",
    authorName: "Manoj Tiwari",
    authorAvatar: IMG.avatar1,
    rating: 5,
    body: "We hosted a small family gathering here. The team helped with everything — from the decor to the dinner menu. Truly memorable.",
    source: "DIRECT",
    stayDate: "2026-04-29",
  },
];

// ─── Mock API surface ─────────────────────────────────────────────

export function getResort(): ResortInfo {
  return resort;
}

export function getRoomTypes(): RoomType[] {
  return roomTypes;
}

export function getFeaturedReviews(limit = 3): Review[] {
  return reviews.filter((r) => r.source === "GOOGLE").slice(0, limit);
}

export function getAggregateRating(): { average: number; count: number } {
  const googleReviews = reviews.filter((r) => r.source === "GOOGLE");
  if (googleReviews.length === 0) return { average: 0, count: 0 };
  const sum = googleReviews.reduce((acc, r) => acc + r.rating, 0);
  return {
    average: Math.round((sum / googleReviews.length) * 10) / 10,
    count: 814, // mock — admin-configured
  };
}

export function getAvailability(opts: {
  checkIn: string;
  checkOut: string;
  adults?: number;
  children?: number;
  rooms?: number;
}): AvailabilityResult {
  const ci = new Date(opts.checkIn);
  const co = new Date(opts.checkOut);
  const nights = Math.max(
    1,
    Math.round((co.getTime() - ci.getTime()) / (1000 * 60 * 60 * 24))
  );

  // Mock availability — pseudo-random but deterministic by day-of-year.
  const dayOfYear = Math.floor(
    (ci.getTime() - new Date(ci.getFullYear(), 0, 0).getTime()) /
      (1000 * 60 * 60 * 24)
  );
  const seed = dayOfYear % 7;

  return {
    stay: { checkIn: opts.checkIn, checkOut: opts.checkOut, nights },
    roomTypes: roomTypes.map((rt) => {
      // Vary available count by day; some days sold out.
      let available = rt.totalUnits - ((seed + rt.totalUnits) % (rt.totalUnits + 1));
      if (available < 0) available = 0;
      if (seed === 3 && rt.slug === "luxury-cottage") available = 0;
      const totalForStay = rt.basePrice * nights;
      return {
        ...rt,
        available,
        soldOut: available === 0,
        nightlyRate: rt.basePrice,
        totalForStay,
      };
    }),
  };
}

export const heroImage = IMG.hero;
export const amenitiesImage = IMG.pool;
export const restaurantImage = IMG.restaurant;
export const mountainImage = IMG.mountain;
export const trekImage = IMG.trek;
