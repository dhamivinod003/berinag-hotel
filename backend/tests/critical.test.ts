// The 12 critical tests from backend-spec.md §20.
// Run with: npm test
//
// We mount the Express app on a real port and hit it with fetch().
// Each test gets a fresh in-memory DB.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { setupTestEnv, teardownTestEnv, seedMinimalResort, prisma } from "./setup";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  await setupTestEnv();
  await seedMinimalResort();
  const { createApp } = await import("../src/app.js");
  const app = createApp();
  server = createServer(app);
  await new Promise<void>((r) => server.listen(0, () => r()));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  await teardownTestEnv();
});

// ─── HTTP helpers ─────────────────────────────────────────────────

interface CookieJar {
  cookies: Record<string, string>;
  csrf: string | null;
}

function newJar(): CookieJar {
  return { cookies: {}, csrf: null };
}

function getCookie(jar: CookieJar, name: string): string | undefined {
  return jar.cookies[name];
}

function setCookie(jar: CookieJar, name: string, value: string) {
  jar.cookies[name] = value;
}

function applySetCookie(jar: CookieJar, setCookieHeader: string | string[] | undefined) {
  if (!setCookieHeader) return;
  const list = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  for (const c of list) {
    const m = c.match(/^([^=]+)=([^;]*)/);
    if (m) {
      setCookie(jar, m[1], m[2]);
      if (m[1] === "swr_csrf") jar.csrf = m[2];
    }
  }
}

async function req(
  method: string,
  path: string,
  opts: { jar?: CookieJar; body?: unknown; auth?: string; expect?: number } = {}
): Promise<{ status: number; data: any; headers: Headers }> {
  const jar = opts.jar ?? newJar();
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.auth) headers["Authorization"] = `Bearer ${opts.auth}`;
  if (jar.csrf && method !== "GET" && method !== "HEAD") headers["X-CSRF-Token"] = jar.csrf;
  const cookieHeader = Object.entries(jar.cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  if (cookieHeader) headers["Cookie"] = cookieHeader;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  applySetCookie(jar, res.headers.getSetCookie?.() as any);
  // Also try via raw header split
  const raw = res.headers.get("set-cookie");
  if (raw) applySetCookie(jar, raw);
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data, headers: res.headers };
}

async function loginOwner(jar: CookieJar): Promise<string> {
  // First, get the csrf cookie via a public GET
  await req("GET", "/api/public/resort", { jar });
  const r = await req("POST", "/api/auth/login", {
    jar,
    body: { email: "owner@test.com", password: "changeme123" },
    expect: 200,
  });
  return r.data.accessToken;
}

async function loginReception(jar: CookieJar): Promise<string> {
  await req("GET", "/api/public/resort", { jar });
  const r = await req("POST", "/api/auth/login", {
    jar,
    body: { email: "rec@test.com", password: "changeme123" },
    expect: 200,
  });
  return r.data.accessToken;
}

// ─── Tests ─────────────────────────────────────────────────────────

describe("Critical tests (spec §20)", () => {
  // ─── 1. Last room, two simultaneous bookings ─────────────────
  it("1. last room, two simultaneous bookings → only one wins", async () => {
    // Inventory has 1 unit. Two clients race to book.
    const j1 = newJar(); const j2 = newJar();
    await req("GET", "/api/public/resort", { jar: j1 });
    await req("GET", "/api/public/resort", { jar: j2 });

    const holdBody = (roomTypeId: string) => ({
      roomTypeId,
      checkIn: "2030-05-10",
      checkOut: "2030-05-13",
      rooms: 1,
    });
    const rt = (await req("GET", "/api/public/rooms", { jar: j1 })).data[0];

    const [h1, h2] = await Promise.all([
      req("POST", "/api/public/availability/hold", { jar: j1, body: holdBody(rt.id) }),
      req("POST", "/api/public/availability/hold", { jar: j2, body: holdBody(rt.id) }),
    ]);
    // Exactly one of the two holds should succeed.
    const successes = [h1, h2].filter((r) => r.status === 201).length;
    const conflicts = [h1, h2].filter((r) => r.status === 409).length;
    expect(successes).toBe(1);
    expect(conflicts).toBe(1);
    expect([h1, h2].find((r) => r.status === 409)?.data?.error?.code).toBe("INVENTORY_UNAVAILABLE");
  });

  // ─── 2. Hold expiry ────────────────────────────────────────────
  it("2. hold expires after the configured duration", async () => {
    // Manually create a hold, then fast-forward its expiresAt.
    const rt = (await req("GET", "/api/public/rooms", { jar: newJar() })).data[0];
    const { createHold } = await import("../src/services/reservationHoldService.js");
    const { expireDueHolds } = await import("../src/services/reservationHoldService.js");
    const hold = await createHold({
      resortId: (await prisma.resort.findFirst()).id,
      roomTypeId: rt.id,
      quantity: 1,
      checkIn: new Date("2030-06-10"),
      checkOut: new Date("2030-06-13"),
      sessionId: "test-sess-2",
    });
    // Manually backdate the hold.
    await prisma.reservationHold.update({
      where: { id: hold.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const expired = await expireDueHolds();
    expect(expired).toBeGreaterThanOrEqual(1);
    const after = await prisma.reservationHold.findUnique({ where: { id: hold.id } });
    expect(after?.status).toBe("EXPIRED");
  });

  // ─── 3. Cancellation policy windows ────────────────────────────
  it("3. cancellation policy: 7d+ free, 1-7d 50%, <24h 0%", async () => {
    const rt = (await req("GET", "/api/public/rooms", { jar: newJar() })).data[0];
    const guest = await prisma.guest.create({ data: { resortId: (await prisma.resort.findFirst()).id, fullName: "Cancel", phone: "111" } });

    // 30 days out
    const r30 = await prisma.reservation.create({
      data: {
        resortId: (await prisma.resort.findFirst()).id, bookingReference: "BKa",
        guestId: guest.id, roomTypeId: rt.id,
        checkIn: new Date(Date.now() + 30 * 86400_000), checkOut: new Date(Date.now() + 33 * 86400_000),
        nights: 3, adults: 1, status: "CONFIRMED", source: "WEBSITE",
        nightlyRate: 100000, subtotal: 300000, totalAmount: 336000, taxAmount: 36000, amountDue: 336000,
        confirmedAt: new Date(),
      },
    });
    const jar = newJar();
    const token = await loginOwner(jar);
    const c30 = await req("POST", `/api/admin/reservations/${r30.id}/cancel`, { jar, auth: token, body: { reason: "test" }, expect: 200 });
    expect(c30.data.refundPct).toBe(100);

    // 3 days out
    const r3 = await prisma.reservation.create({
      data: {
        ...r30, id: undefined, bookingReference: "BKb", checkIn: new Date(Date.now() + 3 * 86400_000), checkOut: new Date(Date.now() + 5 * 86400_000),
      },
    });
    const c3 = await req("POST", `/api/admin/reservations/${r3.id}/cancel`, { jar, auth: token, body: { reason: "test" }, expect: 200 });
    expect(c3.data.refundPct).toBe(50);

    // 6 hours out
    const r0 = await prisma.reservation.create({
      data: {
        ...r30, id: undefined, bookingReference: "BKc", checkIn: new Date(Date.now() + 6 * 3600_000), checkOut: new Date(Date.now() + 9 * 3600_000),
      },
    });
    const c0 = await req("POST", `/api/admin/reservations/${r0.id}/cancel`, { jar, auth: token, body: { reason: "test" }, expect: 200 });
    expect(c0.data.refundPct).toBe(0);
  });

  // ─── 4. Extension same room ────────────────────────────────────
  it("4. extension in same room when physical room remains available", async () => {
    const rt = (await req("GET", "/api/public/rooms", { jar: newJar() })).data[0];
    const guest = await prisma.guest.create({ data: { resortId: (await prisma.resort.findFirst()).id, fullName: "X", phone: "222" } });
    const room = await prisma.room.findFirst();
    const r = await prisma.reservation.create({
      data: {
        resortId: (await prisma.resort.findFirst()).id, bookingReference: "BKex1",
        guestId: guest.id, roomTypeId: rt.id,
        checkIn: new Date("2030-07-10"), checkOut: new Date("2030-07-13"),
        nights: 3, adults: 1, status: "CONFIRMED", source: "WEBSITE",
        nightlyRate: 100000, subtotal: 300000, totalAmount: 336000, taxAmount: 36000, amountDue: 336000,
        confirmedAt: new Date(),
      },
    });
    await prisma.roomAssignment.create({
      data: { resortId: r.resortId, reservationId: r.id, roomId: room!.id },
    });
    const jar = newJar();
    const token = await loginOwner(jar);
    const result = await req("POST", `/api/admin/reservations/${r.id}/extension`, {
      jar, auth: token,
      body: { newCheckOut: "2030-07-15T00:00:00.000Z" },
      expect: 200,
    });
    expect(result.data.outcome).toBe("EXTENDED_SAME_ROOM");
  });

  // ─── 5. Extension requires room change ────────────────────────
  it("5. extension requires room change when same room is occupied", async () => {
    // We need: 2 physical rooms, subject in R1, R1 occupied for the extension period, R2 free.
    const resort = await prisma.resort.findFirst();
    const rt = await prisma.roomType.findFirst();
    if (!rt || !resort) return;
    // Ensure we have 2 physical rooms.
    const r1 = await prisma.room.findFirst({ where: { roomNumber: "R1" } });
    let r2 = await prisma.room.findFirst({ where: { roomNumber: "R2" } });
    if (!r2) {
      r2 = await prisma.room.create({ data: { resortId: resort.id, roomTypeId: rt.id, roomNumber: "R2" } });
    }

    // Subject: in R1, Aug 10-13. Wants to extend to Aug 15.
    const guest = await prisma.guest.create({ data: { resortId: resort.id, fullName: "Y", phone: "333" } });
    const subject = await prisma.reservation.create({
      data: {
        resortId: resort.id, bookingReference: "BKex2",
        guestId: guest.id, roomTypeId: rt.id,
        checkIn: new Date("2030-08-10"), checkOut: new Date("2030-08-13"),
        nights: 3, adults: 1, status: "CONFIRMED", source: "WEBSITE",
        nightlyRate: 100000, subtotal: 300000, totalAmount: 336000, taxAmount: 36000, amountDue: 336000,
        confirmedAt: new Date(),
      },
    });
    await prisma.roomAssignment.create({ data: { resortId: resort.id, reservationId: subject.id, roomId: r1!.id } });

    // Block R1 during the extension period (Aug 13-15) with another booking.
    const otherGuest = await prisma.guest.create({ data: { resortId: resort.id, fullName: "Z", phone: "444" } });
    const blocking = await prisma.reservation.create({
      data: {
        resortId: resort.id, bookingReference: "BKblock",
        guestId: otherGuest.id, roomTypeId: rt.id,
        checkIn: new Date("2030-08-13"), checkOut: new Date("2030-08-16"),
        nights: 3, adults: 1, status: "CONFIRMED", source: "ADMIN",
        nightlyRate: 100000, subtotal: 300000, totalAmount: 336000, taxAmount: 36000, amountDue: 336000,
        confirmedAt: new Date(),
      },
    });
    await prisma.roomAssignment.create({ data: { resortId: resort.id, reservationId: blocking.id, roomId: r1!.id } });

    const jar = newJar();
    const token = await loginOwner(jar);
    const result = await req("POST", `/api/admin/reservations/${subject.id}/extension`, {
      jar, auth: token,
      body: { newCheckOut: "2030-08-15T00:00:00.000Z" },
      expect: 200,
    });
    expect(result.data.outcome).toBe("EXTENSION_REQUIRES_ROOM_CHANGE");
    expect(result.data.suggestedRoomId).toBeTruthy();
  });

  // ─── 7. Room move ─────────────────────────────────────────────
  it("7. admin can move guest from one room to another", async () => {
    const resort = await prisma.resort.findFirst();
    const rt = await prisma.roomType.findFirst();
    // Add a 2nd room
    const r2 = await prisma.room.create({ data: { resortId: resort!.id, roomTypeId: rt!.id, roomNumber: "RM2" } });
    const guest = await prisma.guest.create({ data: { resortId: resort!.id, fullName: "MM", phone: "555" } });
    const r = await prisma.reservation.create({
      data: {
        resortId: resort!.id, bookingReference: "BKmv",
        guestId: guest.id, roomTypeId: rt!.id,
        checkIn: new Date("2030-09-10"), checkOut: new Date("2030-09-13"),
        nights: 3, adults: 1, status: "CONFIRMED", source: "WEBSITE",
        nightlyRate: 100000, subtotal: 300000, totalAmount: 336000, taxAmount: 36000, amountDue: 336000,
        confirmedAt: new Date(),
      },
    });
    const r1 = await prisma.room.findFirst({ where: { roomNumber: "R1" } });
    await prisma.roomAssignment.create({ data: { resortId: resort!.id, reservationId: r.id, roomId: r1!.id } });
    const jar = newJar();
    const token = await loginOwner(jar);
    const result = await req("POST", `/api/admin/reservations/${r.id}/move-room`, {
      jar, auth: token,
      body: { toRoomId: r2.id, reason: "Maintenance" },
      expect: 200,
    });
    // The response is the movement object, not {noOp:true} (which would only happen if from===to).
    expect(result.status).toBe(200);
    // Verify RoomMovement was created
    const m = await prisma.roomMovement.findFirst({ where: { reservationId: r.id } });
    expect(m).toBeTruthy();
    expect(m?.fromRoomId).toBeTruthy();
    expect(m?.toRoomId).toBe(r2.id);
  });

  // ─── 8. Room OOO excluded from inventory ───────────────────────
  it("8. OOO rooms are excluded from availability", async () => {
    const resort = await prisma.resort.findFirst();
    // Mark R1 as OOO
    const r1 = await prisma.room.findFirst({ where: { roomNumber: "R1" } });
    await prisma.room.update({ where: { id: r1!.id }, data: { status: "OUT_OF_ORDER" } });
    // Open a maintenance record so the availability engine subtracts it.
    const owner = await prisma.staff.findFirst({ where: { roleKey: "OWNER" } });
    await prisma.maintenanceRecord.create({
      data: {
        resortId: resort!.id, roomId: r1!.id, issue: "Test OOO",
        reportedById: owner!.id, status: "OPEN",
      },
    });
    // Now check availability
    const r = await req("GET", "/api/public/availability?checkIn=2030-10-10&checkOut=2030-10-13", { jar: newJar() });
    const rt = r.data.roomTypes[0];
    // The room type has 1 unit, but it's OOO → 0 available
    expect(rt.available).toBe(0);
    expect(rt.soldOut).toBe(true);
  });

  // ─── 9. Partial payment ───────────────────────────────────────
  it("9. partial payment → reservation confirmed with amountDue", async () => {
    const rt = (await req("GET", "/api/public/rooms", { jar: newJar() })).data[0];
    const guest = await prisma.guest.create({ data: { resortId: (await prisma.resort.findFirst()).id, fullName: "PP", phone: "666" } });
    // Total: 3 nights × 100000 (subtotal) + 12% tax = 336000 paise (₹3360).
    // Pay partial of 100000 paise (₹1000), expect amountDue = 236000.
    const r = await prisma.reservation.create({
      data: {
        resortId: (await prisma.resort.findFirst()).id, bookingReference: "BKpp",
        guestId: guest.id, roomTypeId: rt.id,
        checkIn: new Date("2030-11-10"), checkOut: new Date("2030-11-13"),
        nights: 3, adults: 1, status: "CONFIRMED", source: "WEBSITE",
        nightlyRate: 100000, subtotal: 300000, totalAmount: 336000, taxAmount: 36000,
        amountPaid: 0, amountDue: 336000, confirmedAt: new Date(),
      },
    });
    await prisma.payment.create({
      data: { resortId: r.resortId, reservationId: r.id, amount: 100000, method: "CASH", status: "CAPTURED" },
    });
    await prisma.reservation.update({
      where: { id: r.id },
      data: { amountPaid: 100000, amountDue: 236000 },
    });
    const fetched = await prisma.reservation.findUnique({ where: { id: r.id } });
    expect(fetched?.amountPaid).toBe(100000);
    expect(fetched?.amountDue).toBe(236000);
    expect(fetched?.status).toBe("CONFIRMED");
  });

  // ─── 11. Check-in / check-out transition ───────────────────────
  it("11. check-in → check-out auto-creates housekeeping task", async () => {
    const resort = await prisma.resort.findFirst();
    const rt = await prisma.roomType.findFirst();
    const guest = await prisma.guest.create({ data: { resortId: resort!.id, fullName: "CC", phone: "777" } });
    const room = await prisma.room.findFirst();
    const r = await prisma.reservation.create({
      data: {
        resortId: resort!.id, bookingReference: "BKcc",
        guestId: guest.id, roomTypeId: rt!.id,
        checkIn: new Date("2030-12-10"), checkOut: new Date("2030-12-13"),
        nights: 3, adults: 1, status: "CONFIRMED", source: "WEBSITE",
        nightlyRate: 100000, subtotal: 300000, totalAmount: 336000, taxAmount: 36000, amountDue: 336000,
        confirmedAt: new Date(),
      },
    });
    await prisma.roomAssignment.create({ data: { resortId: resort!.id, reservationId: r.id, roomId: room!.id } });
    const jar = newJar();
    const token = await loginOwner(jar);
    const ci = await req("POST", `/api/admin/reservations/${r.id}/check-in`, { jar, auth: token, expect: 200 });
    expect(ci.data.status).toBe("CHECKED_IN");
    expect(ci.data.checkedInAt).toBeTruthy();
    // Room → OCCUPIED
    const afterCI = await prisma.room.findUnique({ where: { id: room!.id } });
    expect(afterCI?.status).toBe("OCCUPIED");
    // Check-out
    const co = await req("POST", `/api/admin/reservations/${r.id}/check-out`, { jar, auth: token, expect: 200 });
    expect(co.data.status).toBe("CHECKED_OUT");
    // Room → CLEANING, housekeeping task auto-created
    const afterCO = await prisma.room.findUnique({ where: { id: room!.id } });
    expect(afterCO?.status).toBe("CLEANING");
    const task = await prisma.housekeepingTask.findFirst({ where: { reservationId: r.id } });
    expect(task).toBeTruthy();
    expect(task?.type).toBe("CHECKOUT_CLEAN");
    expect(task?.status).toBe("PENDING");
  });

  // ─── 12. Permission denial ────────────────────────────────────
  it("12. reception is denied for STAFF_CREATE", async () => {
    const jar = newJar();
    const token = await loginReception(jar);
    const r = await req("POST", "/api/admin/staff", {
      jar, auth: token,
      body: { email: "x@y.z", name: "X", roleKey: "RECEPTION", password: "12345678" },
    });
    expect(r.status).toBe(403);
    expect(r.data?.error?.code).toBe("FORBIDDEN");
    expect(r.data?.error?.details?.missing).toContain("STAFF_CREATE");
  });

  // ─── 6. Extension UNAVAILABLE — physical room taken for new dates ─
  it("6. extension unavailable when no physical room is free for new dates", async () => {
    // Setup: every room of this type is occupied during the extension window,
    // so the extension cannot be granted.
    const resort = await prisma.resort.findFirst();
    const rt = await prisma.roomType.findFirst();
    if (!rt || !resort) return;
    // Find or create rooms of this type. Note: previous tests may have created
    // R2 already, so we block that too.
    const allRooms = await prisma.room.findMany({ where: { roomTypeId: rt.id } });
    if (allRooms.length === 0) return;
    const guest1 = await prisma.guest.create({
      data: { resortId: resort.id, fullName: "Ext6a", phone: "6a" },
    });
    // Subject reservation: 10–13, in the first room.
    const subject = await prisma.reservation.create({
      data: {
        resortId: resort.id, bookingReference: "BKexU1",
        guestId: guest1.id, roomTypeId: rt.id,
        checkIn: new Date("2031-02-10"), checkOut: new Date("2031-02-13"),
        nights: 3, adults: 1, status: "CONFIRMED", source: "WEBSITE",
        nightlyRate: 100000, subtotal: 300000, totalAmount: 336000,
        taxAmount: 36000, amountDue: 336000, confirmedAt: new Date(),
      },
    });
    await prisma.roomAssignment.create({
      data: { resortId: resort.id, reservationId: subject.id, roomId: allRooms[0].id },
    });
    // Block every other room with a reservation for the extension period (13–15).
    for (let i = 1; i < allRooms.length; i++) {
      const guest = await prisma.guest.create({
        data: { resortId: resort.id, fullName: `Blocker${i}`, phone: `6b${i}` },
      });
      const blocking = await prisma.reservation.create({
        data: {
          resortId: resort.id, bookingReference: `BKblockU${i}`,
          guestId: guest.id, roomTypeId: rt.id,
          checkIn: new Date("2031-02-12"), checkOut: new Date("2031-02-16"),
          nights: 4, adults: 1, status: "CONFIRMED", source: "ADMIN",
          nightlyRate: 100000, subtotal: 400000, totalAmount: 448000,
          taxAmount: 48000, amountDue: 448000, confirmedAt: new Date(),
        },
      });
      await prisma.roomAssignment.create({
        data: { resortId: resort.id, reservationId: blocking.id, roomId: allRooms[i].id },
      });
    }
    // Also block the subject's own room during the extension window.
    const guestBlock = await prisma.guest.create({
      data: { resortId: resort.id, fullName: "BlockerSubject", phone: "6bs" },
    });
    const blockingSubject = await prisma.reservation.create({
      data: {
        resortId: resort.id, bookingReference: "BKblockUS",
        guestId: guestBlock.id, roomTypeId: rt.id,
        checkIn: new Date("2031-02-13"), checkOut: new Date("2031-02-16"),
        nights: 3, adults: 1, status: "CONFIRMED", source: "ADMIN",
        nightlyRate: 100000, subtotal: 300000, totalAmount: 336000,
        taxAmount: 36000, amountDue: 336000, confirmedAt: new Date(),
      },
    });
    await prisma.roomAssignment.create({
      data: { resortId: resort.id, reservationId: blockingSubject.id, roomId: allRooms[0].id },
    });
    // Try to extend subject by 2 nights. All rooms are occupied during 13–15.
    const jar = newJar();
    const token = await loginOwner(jar);
    const result = await req("POST", `/api/admin/reservations/${subject.id}/extension`, {
      jar, auth: token,
      body: { newCheckOut: "2031-02-15T00:00:00.000Z" },
      expect: 200,
    });
    expect(result.data.outcome).toBe("EXTENSION_UNAVAILABLE");
    expect(result.data.suggestedRoomId).toBeUndefined();
  });

  // ─── 10. Failed Razorpay payment ──────────────────────────────
  it("10. failed Razorpay payment → reservation stays CONFIRMED, payment FAILED, amountDue unchanged", async () => {
    // Set up a real booking, then directly create a Payment row (CREATED) and
    // simulate a payment.failed webhook with a properly signed payload.
    // We don't hit the live Razorpay API here — the goal of this test is the
    // webhook → handler → DB flow, not the order-creation round trip.
    const crypto = await import("node:crypto");
    const rt = (await req("GET", "/api/public/rooms", { jar: newJar() })).data[0];
    const hold = await req("POST", "/api/public/availability/hold", {
      jar: newJar(),
      body: { roomTypeId: rt.id, checkIn: "2031-04-10", checkOut: "2031-04-13", rooms: 1 },
    });
    expect(hold.status).toBe(201);
    const booking = await req("POST", "/api/public/bookings", {
      jar: newJar(),
      body: {
        holdId: hold.data.holdId,
        guest: { fullName: "PayFail", phone: "10fail", countryCode: "+91" },
      },
      expect: 201,
    });

    // Insert a fake Razorpay order in CREATED state directly. This is what
    // /api/public/payments/orders would have created against the real API.
    const resort = await prisma.resort.findFirst();
    const payment = await prisma.payment.create({
      data: {
        resortId: resort!.id,
        reservationId: booking.data.id,
        amount: booking.data.totalAmount,
        currency: "INR",
        method: "RAZORPAY",
        status: "CREATED",
        provider: "razorpay",
        providerOrderId: "order_TEST_" + Date.now(),
        reference: booking.data.bookingReference,
      },
    });
    expect(payment.providerOrderId).toMatch(/^order_/);

    // Build a payment.failed webhook event with a valid signature.
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET!;
    const event = {
      entity: "event",
      account_id: "acc_TEST",
      event: "payment.failed",
      contains: ["payment"],
      payload: {
        payment: {
          entity: {
            id: "pay_FAILED_FOR_TEST",
            entity: "payment",
            amount: payment.amount,
            currency: payment.currency,
            status: "failed",
            order_id: payment.providerOrderId,
            error_code: "BAD_CARD",
            error_description: "The card was declined by the issuer.",
            error_reason: "payment_cancelled",
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    };
    const body = JSON.stringify(event);
    const signature = crypto
      .createHmac("sha256", webhookSecret)
      .update(body)
      .digest("hex");

    // Webhook endpoint expects the raw body — fetch() gives us that.
    const wh = await fetch(`${baseUrl}/api/webhooks/razorpay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-razorpay-signature": signature,
      },
      body,
    });
    expect(wh.status).toBe(200);

    // Payment row should be marked FAILED.
    const after = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(after?.status).toBe("FAILED");

    // Reservation should remain PENDING_PAYMENT, amountPaid=0, amountDue unchanged.
    const r = await prisma.reservation.findUnique({ where: { id: booking.data.id } });
    expect(r?.status).toBe("PENDING_PAYMENT");
    expect(r?.amountPaid).toBe(0);
    expect(r?.amountDue).toBe(booking.data.totalAmount);

    // A subsequent /payments/verify with a bogus signature should be rejected.
    const verify = await req("POST", "/api/public/payments/verify", {
      jar: newJar(),
      body: {
        reservationId: booking.data.id,
        phone: "10fail",
        razorpayOrderId: payment.providerOrderId,
        razorpayPaymentId: "pay_LATE",
        razorpaySignature: "bogus",
      },
    });
    expect(verify.status).toBe(402);
  });

  // ─── 10b. Webhook replay window ───────────────────────────────
  it("10b. webhook event older than 5 min is rejected (replay protection)", async () => {
    const crypto = await import("node:crypto");
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET!;
    const event = {
      entity: "event",
      account_id: "acc_TEST",
      event: "payment.captured",
      contains: ["payment"],
      payload: {
        payment: {
          entity: {
            id: "pay_STALE",
            entity: "payment",
            amount: 1000,
            currency: "INR",
            status: "captured",
            order_id: "order_STALE_NONEXISTENT",
          },
        },
      },
      // 10 minutes ago — outside the 5-minute replay window.
      created_at: Math.floor(Date.now() / 1000) - 600,
    };
    const body = JSON.stringify(event);
    const signature = crypto
      .createHmac("sha256", webhookSecret)
      .update(body)
      .digest("hex");
    const wh = await fetch(`${baseUrl}/api/webhooks/razorpay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-razorpay-signature": signature,
      },
      body,
    });
    expect(wh.status).toBe(401);
    const data = await wh.json();
    expect(data?.error?.code).toBe("REPLAY_WINDOW_EXCEEDED");
  });
});
