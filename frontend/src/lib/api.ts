// API client. When NEXT_PUBLIC_API_BASE_URL is set, talks to the real backend.
// Falls back to mock data only when explicitly set to "mock" or empty.

import * as mock from "./mock-data";
import type {
  AvailabilityResult,
  ResortInfo,
  Review,
  RoomType,
  RoomDto,
  ReservationDto,
  EnquiryDto,
  OfferDto,
  StaffDto,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";
const USE_MOCK = !API_BASE || API_BASE === "mock";

export const useMockData = USE_MOCK;

// ─── Generic fetch with auth + 401-refresh ────────────────────────

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(opts: { status: number; code: string; message: string; details?: unknown }) {
    super(opts.message);
    this.status = opts.status;
    this.code = opts.code;
    this.details = opts.details;
  }
}

interface RequestOpts {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  // For state-changing requests (POST/PUT/PATCH/DELETE), we attach the
  // CSRF token from the swr_csrf cookie.
  auth?: boolean;
  signal?: AbortSignal;
}

async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  if (USE_MOCK) {
    throw new ApiError({
      status: 0,
      code: "MOCK_MODE",
      message: "Mock mode — caller should use mock-data.ts directly",
    });
  }
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts.auth && accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }
  if (method !== "GET") {
    // Double-submit CSRF: read cookie and echo in header.
    if (typeof document !== "undefined") {
      const csrf = getCookie("swr_csrf");
      if (csrf) headers["X-CSRF-Token"] = csrf;
    }
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: "include", // send refresh cookie
    signal: opts.signal,
    cache: "no-store",
  });
  if (res.status === 401 && opts.auth) {
    // Try one silent refresh.
    const refreshed = await tryRefresh();
    if (refreshed) {
      // Retry once with new token.
      if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
      const retried = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        credentials: "include",
        signal: opts.signal,
        cache: "no-store",
      });
      if (!retried.ok) {
        const body = await retried.json().catch(() => ({}));
        throw new ApiError({
          status: retried.status,
          code: body?.error?.code ?? "HTTP_ERROR",
          message: body?.error?.message ?? `HTTP ${retried.status}`,
          details: body?.error?.details,
        });
      }
      return retried.json();
    }
    // Refresh failed — clear token, bubble up.
    setAccessToken(null);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("swr:auth:expired"));
    }
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError({
      status: res.status,
      code: body?.error?.code ?? "HTTP_ERROR",
      message: body?.error?.message ?? `HTTP ${res.status}`,
      details: body?.error?.details,
    });
  }
  return res.json();
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data?.accessToken) {
        setAccessToken(data.accessToken);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

// ─── Public read API ──────────────────────────────────────────────

export async function getResort(): Promise<ResortInfo> {
  if (USE_MOCK) return mock.getResort();
  return request<ResortInfo>("/api/public/resort");
}

export async function getRoomTypes(): Promise<RoomType[]> {
  if (USE_MOCK) return mock.getRoomTypes();
  return request<RoomType[]>("/api/public/rooms");
}

export async function getRoomType(slug: string): Promise<RoomType | null> {
  if (USE_MOCK) {
    return mock.getRoomTypes().find((r) => r.slug === slug) ?? null;
  }
  try {
    return await request<RoomType>(`/api/public/rooms/${encodeURIComponent(slug)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

function normalizeReview(raw: Review & { content?: string; reviewDate?: string | null }): Review {
  return {
    ...raw,
    body: raw.body ?? raw.content ?? "",
    stayDate: raw.stayDate ?? raw.reviewDate ?? null,
  };
}

export async function getFeaturedReviews(limit = 3): Promise<Review[]> {
  if (USE_MOCK) return mock.getFeaturedReviews(limit);
  const reviews = await request<Array<Review & { content?: string; reviewDate?: string | null }>>(
    `/api/public/reviews?featured=1&limit=${limit}`
  );
  return reviews.map(normalizeReview);
}

export async function getAggregateRating(): Promise<{ average: number; count: number }> {
  if (USE_MOCK) return mock.getAggregateRating();
  return request<{ average: number; count: number }>(`/api/public/reviews/aggregate`);
}

export async function getAvailability(opts: {
  checkIn: string;
  checkOut: string;
  adults?: number;
  children?: number;
  rooms?: number;
}): Promise<AvailabilityResult> {
  if (USE_MOCK) return mock.getAvailability(opts);
  const q = new URLSearchParams({
    checkIn: opts.checkIn,
    checkOut: opts.checkOut,
    adults: String(opts.adults ?? 2),
    children: String(opts.children ?? 0),
    rooms: String(opts.rooms ?? 1),
  });
  return request<AvailabilityResult>(`/api/public/availability?${q.toString()}`);
}

export async function createHold(input: {
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
}): Promise<{ holdId: string; expiresAt: string; secondsLeft: number; pricing: { nightlyRate: number; subtotal: number; total: number } }> {
  return request("/api/public/availability/hold", {
    method: "POST",
    body: input,
  });
}

export async function releaseHold(holdId: string): Promise<{ ok: true }> {
  return request(`/api/public/availability/hold/${holdId}`, { method: "DELETE" });
}

export async function getHold(holdId: string): Promise<{ holdId: string; status: string; expiresAt: string; secondsLeft: number }> {
  return request(`/api/public/availability/hold/${holdId}`);
}

export async function createBooking(input: {
  holdId: string;
  guest: {
    fullName: string;
    phone: string;
    countryCode?: string;
    email?: string;
    address?: string;
    idType?: string;
    idNumber?: string;
  };
  specialRequests?: string;
  arrivalTime?: string;
  adults?: number;
  children?: number;
}): Promise<ReservationDto> {
  return request<ReservationDto>("/api/public/bookings", {
    method: "POST",
    body: input,
  });
}

export async function lookupReservation(opts: {
  bookingReference: string;
  phone: string;
}): Promise<ReservationDto> {
  const q = new URLSearchParams({
    id: opts.bookingReference,
    phone: opts.phone,
  });
  return request<ReservationDto>(`/api/public/bookings/lookup?${q.toString()}`);
}

// ─── Payments (Razorpay) ──────────────────────────────────────────

export interface PaymentOrderResult {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  reservationId: string;
  paymentId: string;
  prefill: { name: string; email?: string; contact: string };
}

export interface PaymentConfig {
  configured: boolean;
  keyId: string | null;
}

export async function getPaymentConfig(): Promise<PaymentConfig> {
  if (USE_MOCK) return { configured: false, keyId: null };
  return request<PaymentConfig>("/api/public/payments/config");
}

export async function createPaymentOrder(opts: {
  reservationId: string;
  phone: string;
}): Promise<PaymentOrderResult> {
  return request<PaymentOrderResult>("/api/public/payments/orders", {
    method: "POST",
    body: opts,
  });
}

export interface VerifyPaymentResult {
  paymentId: string;
  status: "CAPTURED" | "FAILED";
  amountPaid: number;
  amountDue: number;
  bookingReference: string;
}

export async function verifyPayment(opts: {
  reservationId: string;
  phone: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<VerifyPaymentResult> {
  return request<VerifyPaymentResult>("/api/public/payments/verify", {
    method: "POST",
    body: opts,
  });
}

export async function createEnquiry(input: {
  name: string;
  phone: string;
  email?: string;
  message?: string;
  requestedCheckIn?: string;
  requestedCheckOut?: string;
  source?: "WEBSITE_FORM" | "WHATSAPP" | "PHONE" | "WALK_IN" | "OTHER";
}): Promise<{ id: string }> {
  return request<{ id: string }>("/api/public/enquiries", {
    method: "POST",
    body: input,
  });
}

// ─── Auth (admin) ─────────────────────────────────────────────────

export async function login(input: { email: string; password: string }): Promise<{ accessToken: string; expiresAt: string; staff: { id: string; name: string; email: string; role: string } }> {
  const data = await request<{ accessToken: string; expiresAt: string; staff: { id: string; name: string; email: string; role: string } }>("/api/auth/login", {
    method: "POST",
    body: input,
  });
  if (data.accessToken) setAccessToken(data.accessToken);
  return data;
}

export async function logout(): Promise<void> {
  try {
    await request("/api/auth/logout", { method: "POST" });
  } catch {
    /* ignore */
  }
  setAccessToken(null);
}

export async function fetchMe(): Promise<{
  staff: { id: string; name: string; email: string; roleKey: string; resort: { id: string; name: string; slug: string } };
  permissions: string[];
}> {
  return request("/api/auth/me", { auth: true });
}

// ─── Admin API ────────────────────────────────────────────────────

export async function adminListReservations(opts?: {
  status?: string;
  source?: string;
  q?: string;
  from?: string;
  to?: string;
}): Promise<{ items: ReservationDto[] }> {
  const q = new URLSearchParams();
  if (opts?.status) q.set("status", opts.status);
  if (opts?.source) q.set("source", opts.source);
  if (opts?.q) q.set("q", opts.q);
  if (opts?.from) q.set("from", opts.from);
  if (opts?.to) q.set("to", opts.to);
  return request(`/api/admin/reservations?${q.toString()}`, { auth: true });
}

export async function adminGetReservation(id: string): Promise<ReservationDto> {
  return request(`/api/admin/reservations/${id}`, { auth: true });
}

export async function adminConfirmReservation(id: string): Promise<ReservationDto> {
  return request(`/api/admin/reservations/${id}/confirm`, { method: "POST", auth: true });
}

export async function adminCancelReservation(id: string, reason: string): Promise<{ reservation: ReservationDto; refundPct: number }> {
  return request(`/api/admin/reservations/${id}/cancel`, {
    method: "POST",
    body: { reason },
    auth: true,
  });
}

export async function adminCheckIn(id: string): Promise<ReservationDto> {
  return request(`/api/admin/reservations/${id}/check-in`, { method: "POST", auth: true });
}

export async function adminCheckOut(id: string): Promise<ReservationDto> {
  return request(`/api/admin/reservations/${id}/check-out`, { method: "POST", auth: true });
}

export async function adminAssignRoom(id: string, roomId: string): Promise<unknown> {
  return request(`/api/admin/reservations/${id}/assign-room`, {
    method: "POST",
    body: { roomId },
    auth: true,
  });
}

export async function adminMoveRoom(id: string, toRoomId: string, reason: string, notes?: string): Promise<unknown> {
  return request(`/api/admin/reservations/${id}/move-room`, {
    method: "POST",
    body: { toRoomId, reason, notes },
    auth: true,
  });
}

export async function adminRequestExtension(id: string, newCheckOut: string): Promise<{ outcome: "EXTENDED_SAME_ROOM" | "EXTENSION_REQUIRES_ROOM_CHANGE" | "EXTENSION_UNAVAILABLE"; suggestedRoomId?: string; extensionRequest: { id: string } }> {
  return request(`/api/admin/reservations/${id}/extension`, {
    method: "POST",
    body: { newCheckOut },
    auth: true,
  });
}

export interface DashboardStay {
  id: string;
  bookingReference: string;
  guestName: string;
  roomType: string;
  roomNumber: string | null;
  guests: number;
  rooms: number;
  time: string | null;
  checkIn: string;
  checkOut: string;
  status: string;
}

export interface DashboardBooking {
  id: string;
  bookingReference: string;
  guestName: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  status: string;
  rooms: number;
  totalAmount: number;
}

export interface DashboardPayload {
  occupancy: { total: number; occupied: number; percentage: number };
  availableRooms: { count: number };
  maintenanceRooms: { count: number };
  bookings: { total: number; today: number; pending: number };
  checkIns: { today: number };
  checkOuts: { today: number };
  pendingBookings: { count: number };
  pendingEnquiries: { count: number };
  cancelledToday: { count: number };
  revenue: { todayPaise: number; collectedPaise: number };
  occupancyTrend: Array<{ day: string; date: string; occupied: number; total: number; value: number }>;
  arrivals: DashboardStay[];
  departures: DashboardStay[];
  recentBookings: DashboardBooking[];
  enquiries: Array<{
    id: string;
    name: string;
    detail: string;
    time: string;
    requestedCheckIn: string | null;
    requestedCheckOut: string | null;
  }>;
  housekeeping: {
    dirty: number;
    cleaning: number;
    ready: number;
    occupied: number;
    maintenance: number;
    outOfOrder: number;
  };
}

export async function adminDashboard(): Promise<DashboardPayload> {
  return request("/api/admin/dashboard", { auth: true });
}

export async function adminListRooms(): Promise<{
  items: RoomDto[];
}> {
  return request<{ items: RoomDto[] }>("/api/admin/rooms", { auth: true });
}

export async function adminUpdateRoomStatus(id: string, status: string): Promise<unknown> {
  return request(`/api/admin/rooms/${id}/status`, {
    method: "PATCH",
    body: { status },
    auth: true,
  });
}

export async function adminListRoomTypes(): Promise<{
  items: Array<{
    id: string;
    name: string;
    slug: string;
    basePrice: number;
    totalUnits: number;
    maxAdults: number;
    maxChildren: number;
    maxOccupancy: number;
    shortDesc?: string | null;
    description?: string | null;
    bedConfiguration?: string | null;
    areaSqft?: number | null;
    view?: string | null;
    status: string;
    displayOrder: number;
    photos?: Array<{ id: string; url: string; alt?: string | null; isCover: boolean; displayOrder: number }>;
  }>;
}> {
  return request("/api/admin/room-types", { auth: true });
}

export async function adminUpdateRoomType(
  id: string,
  patch: Partial<{
    name: string;
    shortDesc: string;
    description: string;
    basePrice: number;
    maxAdults: number;
    maxChildren: number;
    maxOccupancy: number;
    bedConfiguration: string;
    areaSqft: number;
    view: string;
    totalUnits: number;
    status: "ACTIVE" | "HIDDEN" | "ARCHIVED";
    displayOrder: number;
  }>
): Promise<unknown> {
  return request(`/api/admin/room-types/${id}`, {
    method: "PATCH",
    body: patch,
    auth: true,
  });
}

export async function adminAddRoomPhoto(
  roomTypeId: string,
  input: { url: string; alt?: string; isCover?: boolean; displayOrder?: number }
): Promise<unknown> {
  return request(`/api/admin/room-types/${roomTypeId}/photos`, {
    method: "POST",
    body: input,
    auth: true,
  });
}

export async function adminDeleteRoomPhoto(roomTypeId: string, photoId: string): Promise<unknown> {
  return request(`/api/admin/room-types/${roomTypeId}/photos/${photoId}`, {
    method: "DELETE",
    auth: true,
  });
}

export async function adminListRatePlans(roomTypeId?: string): Promise<{
  items: Array<{
    id: string;
    roomTypeId: string;
    startDate: string;
    endDate: string;
    rate: number;
    minNights?: number | null;
    maxNights?: number | null;
    priority: number;
    active: boolean;
  }>;
}> {
  const q = roomTypeId ? `?roomTypeId=${encodeURIComponent(roomTypeId)}` : "";
  return request(`/api/admin/rate-plans${q}`, { auth: true });
}

export async function adminCreateRatePlan(input: {
  roomTypeId: string;
  startDate: string;
  endDate: string;
  rate: number;
  minNights?: number;
  maxNights?: number;
  priority?: number;
  active?: boolean;
}): Promise<unknown> {
  return request("/api/admin/rate-plans", { method: "POST", body: input, auth: true });
}

export async function adminDeleteRatePlan(id: string): Promise<unknown> {
  return request(`/api/admin/rate-plans/${id}`, { method: "DELETE", auth: true });
}

export async function adminAddGalleryImage(input: {
  url: string;
  categorySlug: string;
  alt?: string;
  caption?: string;
  displayOrder?: number;
  isFeatured?: boolean;
}): Promise<unknown> {
  return request("/api/admin/gallery", { method: "POST", body: input, auth: true });
}

export async function adminDeleteGalleryImage(id: string): Promise<unknown> {
  return request(`/api/admin/gallery/${id}`, { method: "DELETE", auth: true });
}

export async function adminListStaff(): Promise<{ items: StaffDto[] }> {
  return request<{ items: StaffDto[] }>("/api/admin/staff", { auth: true });
}

export async function adminCreateStaff(input: {
  email: string;
  name: string;
  roleKey: string;
  password: string;
  phone?: string;
}): Promise<{ id: string }> {
  return request("/api/admin/staff", { method: "POST", body: input, auth: true });
}

export async function adminUpdateStaff(id: string, patch: Partial<{ name: string; roleKey: string; status: string; phone: string }>): Promise<unknown> {
  return request(`/api/admin/staff/${id}`, { method: "PATCH", body: patch, auth: true });
}

export async function adminListEnquiries(): Promise<{ items: EnquiryDto[] }> {
  return request<{ items: EnquiryDto[] }>("/api/admin/enquiries", { auth: true });
}

export async function adminUpdateEnquiry(id: string, patch: { status?: string; assignedToId?: string }): Promise<unknown> {
  return request(`/api/admin/enquiries/${id}`, { method: "PATCH", body: patch, auth: true });
}

export async function adminListOffers(): Promise<{ items: OfferDto[] }> {
  return request<{ items: OfferDto[] }>("/api/admin/offers", { auth: true });
}

export async function adminCreateOffer(input: {
  id?: string;
  slug?: string;
  name: string;
  description: string;
  shortDesc?: string;
  imageUrl?: string;
  discountType: "PERCENT" | "FLAT";
  discountValue: number;
  minNights?: number;
  promoCode?: string;
  startDate: string;
  endDate: string;
  terms?: string;
  status: "DRAFT" | "PUBLISHED" | "PAUSED" | "EXPIRED";
  roomTypeIds: string[];
}): Promise<{ id: string; name: string; status: string }> {
  return request(
    input.id ? `/api/admin/offers/${input.id}` : "/api/admin/offers",
    { method: input.id ? "PATCH" : "POST", body: input, auth: true }
  );
}

export async function adminGetOffer(id: string): Promise<{
  id: string;
  name: string;
  description: string;
  status: string;
  discountType: string;
  discountValue: number;
  startDate: string;
  endDate: string;
  promoCode?: string | null;
  shortDesc?: string | null;
  imageUrl?: string | null;
  minNights?: number | null;
  terms?: string | null;
  roomTypes: Array<{ roomTypeId: string; roomType: { id: string; name: string; slug: string } }>;
}> {
  return request(`/api/admin/offers/${id}`, { auth: true });
}

export async function adminDeleteOffer(id: string): Promise<unknown> {
  return request(`/api/admin/offers/${id}`, { method: "DELETE", auth: true });
}

export async function adminHousekeepingBoard(): Promise<{
  rooms: Array<{ id: string; roomNumber: string; status: string; roomType: { name: string; basePrice: number } }>;
  summary: { dirty: number; ready: number; occupied: number; maintenance: number };
}> {
  return request("/api/admin/housekeeping/board", { auth: true });
}

export async function adminUpdateHkTask(id: string, status: string, notes?: string): Promise<unknown> {
  return request(`/api/admin/housekeeping/tasks/${id}`, {
    method: "PATCH",
    body: { status, notes },
    auth: true,
  });
}

export async function adminListAuditLog(): Promise<{ items: Array<{ id: string; action: string; entity: string | null; actorType: string; createdAt: string }> }> {
  return request("/api/admin/audit-log", { auth: true });
}

// ─── Reports ────────────────────────────────────────────────────────

export interface OccupancyDay {
  date: string;
  totalRooms: number;
  occupiedRoomNights: number;
  occupancyPct: number;
}

export interface RevenueByRoomType {
  roomTypeId: string;
  roomTypeName: string;
  revenue: number;
}

export interface RevenueBySource {
  source: string;
  revenue: number;
  count: number;
}

export interface RevenueByDate {
  date: string;
  revenue: number;
  count: number;
}

export interface RevenueSummary {
  totalRevenue: number;
  collected: number;
  outstanding: number;
  refunded: number;
  netRevenue: number;
  byRoomType: RevenueByRoomType[];
  bySource: RevenueBySource[];
  byDate: RevenueByDate[];
}

export interface BookingsSummary {
  total: number;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
  averageStayNights: number;
  averageLeadTimeDays: number;
  noShowRatePct: number;
  cancellationRatePct: number;
}

export interface RoomPerformanceRow {
  roomTypeId: string;
  roomTypeName: string;
  bookings: number;
  revenue: number;
  avgValue: number;
}

export interface EnquiryFunnel {
  total: number;
  byStatus: Record<string, number>;
  conversionRatePct: number;
  contactRatePct: number;
}

export interface ReportBundle {
  range: { from: string; to: string };
  occupancy: {
    averagePct: number;
    byDay: OccupancyDay[];
    byRoomType: Array<{ roomTypeId: string; roomTypeName: string; occupancyPct: number }>;
  };
  revenue: RevenueSummary;
  bookings: BookingsSummary;
  roomPerformance: RoomPerformanceRow[];
  enquiries: EnquiryFunnel;
  guests: { total: number; new: number };
}

export async function adminReportDashboard(from: string, to: string): Promise<ReportBundle> {
  return request<ReportBundle>(
    `/api/admin/reports/dashboard?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    { auth: true }
  );
}

// ─── Calendar ──────────────────────────────────────────────────────

export interface CalendarRoom {
  id: string;
  roomNumber: string;
  roomTypeId: string;
  roomTypeName: string;
  status: string;
}

export interface CalendarBlock {
  reservationId: string;
  bookingReference: string;
  guestName: string;
  guestPhone: string;
  status: string;
  source: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  roomTypeId: string;
  roomTypeName: string;
  roomId: string | null;
  roomNumber: string | null;
  roomTypeColor: string;
}

export interface CalendarView {
  range: { from: string; to: string };
  rooms: CalendarRoom[];
  blocks: CalendarBlock[];
}

export async function adminGetCalendar(from: string, to: string): Promise<CalendarView> {
  return request<CalendarView>(
    `/api/admin/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    { auth: true }
  );
}

export async function adminGetHero(): Promise<Record<string, unknown> | null> {
  return request("/api/admin/cms/hero", { auth: true });
}

export async function adminUpdateHero(input: {
  headline: string;
  subheadline?: string;
  imageUrl: string;
  imagePublicId?: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
}): Promise<{ ok: true }> {
  return request("/api/admin/cms/hero", { method: "PUT", body: input, auth: true });
}

export async function adminGetSettings(): Promise<Record<string, unknown>> {
  return request("/api/admin/settings", { auth: true });
}

export async function adminUpdateSettings(patch: Record<string, unknown>): Promise<{ ok: true }> {
  return request("/api/admin/settings", { method: "PUT", body: patch, auth: true });
}

// ─── Guests ────────────────────────────────────────────────────────────────

export interface GuestListItem {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  countryCode: string;
  createdAt: string;
  updatedAt: string;
  _count: { reservations: number };
}

export interface GuestProfileResponse {
  guest: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string;
    countryCode: string;
    address: string | null;
    idType: string | null;
    idNumber: string | null;
    notes: string | null;
    preferences: string | null;
    createdAt: string;
    updatedAt: string;
  };
  stats: {
    totalBookings: number;
    pastReservations: number;
    upcomingReservations: number;
    hasCurrentStay: boolean;
    totalSpentPaise: number;
    canSeeRevenue: boolean;
  };
  currentReservation: ReservationDto | null;
  reservations: ReservationDto[];
}

export async function adminListGuests(q?: string): Promise<{ items: GuestListItem[]; total: number }> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("limit", "100");
  return request(`/api/admin/guests?${params.toString()}`, { auth: true });
}

export async function adminGetGuest(id: string): Promise<GuestProfileResponse> {
  return request(`/api/admin/guests/${id}`, { auth: true });
}

export async function adminUpdateGuest(
  id: string,
  patch: Partial<{
    fullName: string;
    email: string | null;
    phone: string;
    countryCode: string;
    address: string | null;
    idType: string | null;
    idNumber: string | null;
    notes: string | null;
    preferences: string | null;
  }>
): Promise<{ guest: GuestProfileResponse["guest"] }> {
  return request(`/api/admin/guests/${id}`, { method: "PATCH", body: patch, auth: true });
}

// ─── Reviews / Testimonials ────────────────────────────────────────────────

export type ReviewSource = "GOOGLE" | "DIRECT" | "WEBSITE" | "TRIPADVISOR" | "MAKEMYTRIP" | "OTHER";

export interface ReviewDto {
  id: string;
  resortId: string;
  source: string;
  sourceUrl: string | null;
  authorName: string;
  authorAvatar: string | null;
  rating: number;
  content: string;
  reviewDate: string | null;
  status: "DRAFT" | "PUBLISHED";
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewInput {
  source: ReviewSource;
  sourceUrl?: string | null;
  authorName: string;
  authorAvatar?: string | null;
  rating: number;
  title?: string | null;
  body: string;
  stayDate?: string | null;
  status: "DRAFT" | "PUBLISHED";
  isFeatured: boolean;
}

export async function adminListReviews(opts?: {
  source?: string;
  status?: "DRAFT" | "PUBLISHED";
  featured?: boolean;
  q?: string;
}): Promise<{ items: ReviewDto[]; total: number }> {
  const params = new URLSearchParams();
  if (opts?.source) params.set("source", opts.source);
  if (opts?.status) params.set("status", opts.status);
  if (opts?.featured !== undefined) params.set("featured", String(opts.featured));
  if (opts?.q) params.set("q", opts.q);
  params.set("limit", "100");
  return request(`/api/admin/reviews?${params.toString()}`, { auth: true });
}

export async function adminGetReview(id: string): Promise<{ review: ReviewDto }> {
  return request(`/api/admin/reviews/${id}`, { auth: true });
}

export async function adminCreateReview(input: ReviewInput): Promise<{ review: ReviewDto }> {
  return request("/api/admin/reviews", { method: "POST", body: input, auth: true });
}

export async function adminUpdateReview(id: string, input: ReviewInput): Promise<{ review: ReviewDto }> {
  return request(`/api/admin/reviews/${id}`, { method: "PATCH", body: input, auth: true });
}

export async function adminDeleteReview(id: string): Promise<void> {
  await request(`/api/admin/reviews/${id}`, { method: "DELETE", auth: true });
}

// ─── Notifications ────────────────────────────────────────────────────────

export interface NotificationDto {
  id: string;
  resortId: string;
  audience: string;
  type: string;
  channel: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export async function adminListNotifications(opts?: { unread?: boolean }): Promise<{
  items: NotificationDto[];
  total: number;
}> {
  const params = new URLSearchParams();
  if (opts?.unread) params.set("unread", "true");
  params.set("limit", "50");
  return request(`/api/admin/notifications?${params.toString()}`, { auth: true });
}

export async function adminUnreadCount(): Promise<{ count: number }> {
  return request("/api/admin/notifications/unread-count", { auth: true });
}

export async function adminMarkNotificationRead(id: string): Promise<{ notification: NotificationDto }> {
  return request(`/api/admin/notifications/${id}/read`, { method: "PATCH", auth: true });
}

export async function adminMarkAllRead(): Promise<{ updated: number }> {
  return request("/api/admin/notifications/read-all", { method: "POST", auth: true });
}

export async function adminDeleteNotification(id: string): Promise<void> {
  await request(`/api/admin/notifications/${id}`, { method: "DELETE", auth: true });
}

// ─── File Upload ──────────────────────────────────────────────────────────

export interface UploadResult {
  url: string;
  filename: string;
  mimetype: string;
  size: number;
}

export async function adminUploadFile(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  if (USE_MOCK) {
    throw new ApiError({ status: 0, code: "MOCK_MODE", message: "Uploads require real API" });
  }
  // Upload uses multipart/form-data so we have to bypass the JSON request wrapper.
  const headers: Record<string, string> = {};
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  if (typeof document !== "undefined") {
    const csrf = getCookie("swr_csrf");
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }
  const res = await fetch(`${API_BASE}/api/admin/upload`, {
    method: "POST",
    headers,
    body: form,
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new ApiError({
      status: res.status,
      code: json.error?.code ?? "UPLOAD_FAILED",
      message: json.error?.message ?? `Upload failed: HTTP ${res.status}`,
    });
  }
  return res.json();
}

export { ApiError };
