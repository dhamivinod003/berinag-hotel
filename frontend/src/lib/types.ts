// Shared types — match backend-spec.md §9.5 conventions and the actual
// Prisma schema (snake_case in DB, camelCase in API JSON).

export type ReservationStatus =
  | "PENDING"
  | "HELD"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "CHECKED_OUT"
  | "CANCELLED"
  | "NO_SHOW"
  | "EXPIRED";

export type RoomStatus =
  | "READY"
  | "OCCUPIED"
  | "CLEANING"
  | "DIRTY"
  | "MAINTENANCE"
  | "OUT_OF_ORDER";

export type ReservationSource =
  | "WEBSITE"
  | "WALK_IN"
  | "PHONE"
  | "WHATSAPP"
  | "ADMIN"
  | "OTA";

export interface RoomAmenityRef {
  roomTypeId: string;
  amenityId: string;
  amenity: {
    id: string;
    key: string;
    name: string;
    icon?: string;
    category?: string;
  };
}

export interface RoomType {
  id: string;
  slug: string;
  name: string;
  shortDesc?: string | null;
  description?: string | null;
  maxAdults: number;
  maxChildren: number;
  maxOccupancy?: number;
  bedConfiguration?: string | null;
  areaSqft?: number | null;
  view?: string | null;
  basePrice: number; // paise
  totalUnits: number;
  coverImage?: string | null;
  galleryImages?: string[];
  amenities: RoomAmenityRef[];
  photos?: Array<{ id: string; url: string; alt?: string | null; isCover: boolean }>;
}

export interface AvailabilityResult {
  stay: {
    checkIn: string; // ISO date
    checkOut: string;
    nights: number;
  };
  roomTypes: Array<RoomType & {
    available: number;
    soldOut: boolean;
    nightlyRate: number;
    totalForStay: number;
  }>;
}

export interface Review {
  id: string;
  authorName: string;
  authorAvatar?: string | null;
  rating: 1 | 2 | 3 | 4 | 5;
  body: string;
  source: "GOOGLE" | "DIRECT" | "WEBSITE" | "TRIPADVISOR" | "BOOKING_COM";
  stayDate?: string | null;
  isFeatured?: boolean;
}

export interface ResortInfo {
  id?: string;
  name: string;
  tagline?: string;
  description: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  city: string;
  state: string;
  country: string;
  checkInTime: string;
  checkOutTime: string;
  social?: { instagram?: string; facebook?: string };
}

export interface GuestDto {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  countryCode?: string;
}

export interface RoomAssignmentDto {
  id: string;
  roomId: string;
  room?: { id: string; roomNumber: string };
  assignedAt: string;
  releasedAt: string | null;
}

export interface PaymentDto {
  id: string;
  amount: number; // paise
  currency: string;
  method: string;
  status: string;
  provider: string | null;
  providerPaymentId: string | null;
  createdAt: string;
}

export interface ReservationDto {
  id: string;
  bookingReference: string;
  guestId: string;
  guest?: GuestDto;
  roomTypeId: string;
  roomType?: { name: string; slug: string };
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  roomCount: number;
  status: ReservationStatus;
  source: ReservationSource;
  nightlyRate: number;
  subtotal: number;
  discount: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  currency: string;
  offerId?: string | null;
  promoCode?: string | null;
  specialRequests?: string | null;
  arrivalTime?: string | null;
  internalNotes?: string | null;
  holdExpiresAt?: string | null;
  confirmedAt?: string | null;
  checkedInAt?: string | null;
  checkedOutAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  noShowAt?: string | null;
  assignments?: RoomAssignmentDto[];
  payments?: PaymentDto[];
  createdAt?: string;
  updatedAt?: string;
}

export interface RoomDto {
  id: string;
  roomNumber: string;
  status: RoomStatus;
  floor: string | null;
  building: string | null;
  roomType: { name: string; slug: string; basePrice: number };
  isActive?: boolean;
}

export interface StaffDto {
  id: string;
  name: string;
  email: string;
  roleKey: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface EnquiryDto {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  status: "NEW" | "CONTACTED" | "AWAITING_RESPONSE" | "CONVERTED" | "LOST" | "SPAM";
  source: "WEBSITE_FORM" | "WHATSAPP" | "PHONE" | "WALK_IN" | "OTHER";
  message?: string | null;
  requestedCheckIn?: string | null;
  requestedCheckOut?: string | null;
  adults?: number | null;
  children?: number | null;
  roomTypeId?: string | null;
  createdAt: string;
}

export interface OfferDto {
  id: string;
  slug: string;
  name: string;
  description: string;
  shortDesc?: string | null;
  discountType: "PERCENT" | "FLAT";
  discountValue: number;
  minNights?: number | null;
  promoCode?: string | null;
  startDate: string;
  endDate: string;
  status: "DRAFT" | "PUBLISHED" | "PAUSED" | "EXPIRED";
  imageUrl?: string | null;
  terms?: string | null;
}

export interface HkTaskDto {
  id: string;
  roomId: string;
  type: string;
  status: string;
  priority: string;
  notes: string | null;
  assignedToId: string | null;
}

export interface AuditLogDto {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  actorType: string;
  actorId: string | null;
  createdAt: string;
}
