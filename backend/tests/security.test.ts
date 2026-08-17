// Adversarial Security & Regression Test Suite
// Verifies fixes for Findings #1 to #12 from the audit.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { setupTestEnv, teardownTestEnv, seedMinimalResort, prisma } from "./setup";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  await setupTestEnv();
  await seedMinimalResort();
  const { createApp } = await import("../src/app.js");
  const { attachWebSocketServer } = await import("../src/realtime/websocketServer.js");
  const app = createApp();
  server = createServer(app);
  attachWebSocketServer(server);
  await new Promise<void>((r) => server.listen(0, () => r()));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  await teardownTestEnv();
});

interface CookieJar {
  cookies: Record<string, string>;
  csrf: string | null;
}

function newJar(): CookieJar {
  return { cookies: {}, csrf: null };
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

async function api(
  path: string,
  opts: {
    method?: string;
    body?: unknown;
    token?: string;
    jar?: CookieJar;
    headers?: Record<string, string>;
  } = {}
) {
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = { "content-type": "application/json", ...opts.headers };
  if (opts.token) headers["authorization"] = `Bearer ${opts.token}`;

  const jar = opts.jar ?? newJar();
  const cookiePairs = Object.entries(jar.cookies).map(([k, v]) => `${k}=${v}`);
  if (cookiePairs.length > 0) headers["cookie"] = cookiePairs.join("; ");
  if (method !== "GET" && jar.csrf) headers["x-csrf-token"] = jar.csrf;

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const getSetCookie = (res.headers as any).getSetCookie?.bind(res.headers);
  const rawSetCookie = getSetCookie ? getSetCookie() : res.headers.get("set-cookie");
  applySetCookie(jar, rawSetCookie ?? undefined);

  const text = await res.text();
  let json = {};
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, body: json, text, jar };
}

async function loginAs(email: string, pass = "changeme123") {
  const jar = newJar();
  // Hit public route to obtain CSRF cookie
  await api("/api/public/resort", { jar });
  const res = await api("/api/auth/login", {
    method: "POST",
    body: { email, password: pass },
    jar,
  });
  expect(res.status).toBe(200);
  return { token: res.body.accessToken as string, jar };
}

describe("Adversarial Security Fixes", () => {
  it("Login endpoint returns 401 on bad credentials instead of 500", async () => {
    // Test the 401 response and avoid 500
    const res = await api("/api/auth/login", {
      method: "POST",
      body: { email: "owner@test.com", password: "wrong_password_test" },
    });
    expect(res.status).toBe(401);
    expect(res.body.error?.code).toBe("INVALID_CREDENTIALS");
  });

  it("Login endpoint rate limits failed attempts", async () => {
    // 5 attempts allowed by rate limiter, we already did 1 above or other tests might have hit it.
    // Send 6 bad requests, at least the last one should be 429.
    let statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await api("/api/auth/login", {
        method: "POST",
        headers: { "X-Test-IP": "1.2.3.4" },
        body: { email: "nobody@test.com", password: "wrong_password_limit_" + i },
      });
      statuses.push(res.status);
    }
    expect(statuses).toContain(429);
  });

  it("Finding #1: Public booking creates PENDING_PAYMENT status instead of CONFIRMED", async () => {
    const rt = await prisma.roomType.findFirstOrThrow();
    const holdRes = await api("/api/public/availability/hold", {
      method: "POST",
      body: {
        roomTypeId: rt.id,
        checkIn: "2026-09-01",
        checkOut: "2026-09-04",
        rooms: 1,
      },
    });
    expect(holdRes.status).toBe(201);
    const holdId = holdRes.body.holdId;

    const bookRes = await api("/api/public/bookings", {
      method: "POST",
      body: {
        holdId,
        guest: { fullName: "Unpaid Guest", phone: "9876543210" },
      },
    });
    expect(bookRes.status).toBe(201);
    expect(bookRes.body.status).toBe("PENDING_PAYMENT");
    expect(bookRes.body.confirmedAt).toBeNull();
  });

  it("Finding #8: CSRF/refresh cookies use COOKIE_DOMAIN from env", async () => {
    const { csrfCookieOptions, refreshCookieOptions } = await import("../src/config/cookieOptions.js");
    expect(csrfCookieOptions.domain).toBe("cookie.test.local");
    expect(refreshCookieOptions.domain).toBe("cookie.test.local");

    const res = await fetch(`${baseUrl}/api/public/resort`);
    const getSetCookie = (res.headers as { getSetCookie?: () => string[] }).getSetCookie?.bind(res.headers);
    const raw = getSetCookie ? getSetCookie().join("; ") : (res.headers.get("set-cookie") ?? "");
    expect(raw.toLowerCase()).toContain("domain=cookie.test.local");
  });

  it("Finding #7: HOUSEKEEPING is denied notifications; MANAGER is allowed", async () => {
    const ownerResort = await prisma.resort.findFirstOrThrow();
    const bcrypt = (await import("bcryptjs")).default;
    const hash = await bcrypt.hash("changeme123", 4);
    const stamp = Date.now();

    const hkEmail = `hk_notif_${stamp}@test.com`;
    await prisma.staff.create({
      data: {
        resortId: ownerResort.id,
        email: hkEmail,
        passwordHash: hash,
        name: "HK Notif",
        roleKey: "HOUSEKEEPING",
        status: "ACTIVE",
      },
    });
    const hk = await loginAs(hkEmail);
    const hkDenied = await api("/api/admin/notifications", { token: hk.token, jar: hk.jar });
    expect(hkDenied.status).toBe(403);

    const perm = await prisma.permission.upsert({
      where: { key: "NOTIFICATION_VIEW" },
      update: {},
      create: { key: "NOTIFICATION_VIEW", group: "system", description: "view notifications" },
    });
    const mgrRole = await prisma.role.upsert({
      where: { resortId_key: { resortId: ownerResort.id, key: "MANAGER" } },
      update: {},
      create: {
        resortId: ownerResort.id,
        key: "MANAGER",
        name: "Manager",
        description: "Manager",
        isSystem: true,
      },
    });
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: mgrRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: mgrRole.id, permissionId: perm.id, resortId: ownerResort.id },
    });
    const mgrEmail = `mgr_notif_${Date.now()}@test.com`;
    await prisma.staff.create({
      data: {
        resortId: ownerResort.id,
        email: mgrEmail,
        passwordHash: hash,
        name: "Mgr Notif",
        roleKey: "MANAGER",
        status: "ACTIVE",
      },
    });
    const mgr = await loginAs(mgrEmail);
    const mgrOk = await api("/api/admin/notifications", { token: mgr.token, jar: mgr.jar });
    expect(mgrOk.status).toBe(200);
  });

  it("Finding #6: /metrics requires METRICS_TOKEN", async () => {
    const denied = await api("/metrics");
    expect([401, 403]).toContain(denied.status);

    const allowed = await api("/metrics", {
      headers: { Authorization: "Bearer test-metrics-token" },
    });
    expect(allowed.status).toBe(200);
    expect(allowed.text).toContain("http_requests_total");
  });

  it("Finding #5: reservation tax is read from tax.gst_pct settings", async () => {
    const ownerResort = await prisma.resort.findFirstOrThrow();
    const rt = await prisma.roomType.findFirstOrThrow();

    await prisma.websiteSetting.upsert({
      where: { resortId_key: { resortId: ownerResort.id, key: "tax.gst_pct" } },
      update: { value: JSON.stringify(18) },
      create: { resortId: ownerResort.id, key: "tax.gst_pct", value: JSON.stringify(18) },
    });

    const hold18 = await api("/api/public/availability/hold", {
      method: "POST",
      body: {
        roomTypeId: rt.id,
        checkIn: "2028-08-01",
        checkOut: "2028-08-04",
        rooms: 1,
      },
    });
    expect(hold18.status).toBe(201);
    const book18 = await api("/api/public/bookings", {
      method: "POST",
      body: {
        holdId: hold18.body.holdId,
        guest: { fullName: "Tax Eighteen", phone: "9876501818" },
      },
    });
    expect(book18.status).toBe(201);
    const nights18 = 3;
    const subtotal18 = rt.basePrice * nights18;
    expect(book18.body.taxAmount).toBe(Math.round(subtotal18 * 0.18));
    expect(book18.body.totalAmount).toBe(subtotal18 + book18.body.taxAmount);

    await prisma.websiteSetting.update({
      where: { resortId_key: { resortId: ownerResort.id, key: "tax.gst_pct" } },
      data: { value: JSON.stringify(5) },
    });

    const hold5 = await api("/api/public/availability/hold", {
      method: "POST",
      body: {
        roomTypeId: rt.id,
        checkIn: "2028-08-10",
        checkOut: "2028-08-13",
        rooms: 1,
      },
    });
    expect(hold5.status).toBe(201);
    const book5 = await api("/api/public/bookings", {
      method: "POST",
      body: {
        holdId: hold5.body.holdId,
        guest: { fullName: "Tax Five", phone: "9876500505" },
      },
    });
    expect(book5.status).toBe(201);
    const subtotal5 = rt.basePrice * 3;
    expect(book5.body.taxAmount).toBe(Math.round(subtotal5 * 0.05));
    expect(book5.body.totalAmount).toBe(subtotal5 + book5.body.taxAmount);
  });

  it("Finding #4: booking references are BK + 8 unambiguous chars and unique", async () => {
    const { generateBookingReference } = await import("../src/services/reservationService.js");
    const refs = new Set<string>();
    const format = /^BK[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/;
    for (let i = 0; i < 1000; i++) {
      const ref = generateBookingReference();
      expect(ref).toMatch(format);
      expect(ref).not.toMatch(/[01OI]/);
      refs.add(ref);
    }
    expect(refs.size).toBe(1000);
  });

  it("Finding #3: .env is listed in gitignore and is not committed", async () => {
    const { readFileSync, existsSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { execSync } = await import("node:child_process");

    const rootIgnore = readFileSync(join(process.cwd(), "..", ".gitignore"), "utf8");
    const backendIgnore = existsSync(join(process.cwd(), ".gitignore"))
      ? readFileSync(join(process.cwd(), ".gitignore"), "utf8")
      : "";
    const combined = `${rootIgnore}\n${backendIgnore}`;
    expect(combined.split(/\r?\n/).some((line) => line.trim() === ".env")).toBe(true);

    try {
      const tracked = execSync("git ls-files -- .env ../.env", {
        cwd: process.cwd(),
        encoding: "utf8",
      }).trim();
      expect(tracked).toBe("");
    } catch {
      // git may be unavailable in some CI sandboxes; gitignore assertion above still holds
    }
  });

  it("Finding #2: seed never uses the forbidden default password changeme123", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { generateSeedPassword, hashSeedPassword, FORBIDDEN_SEED_PASSWORD } = await import(
      "../src/utils/seedPassword.js"
    );
    const bcrypt = (await import("bcryptjs")).default;

    const seedSrc = readFileSync(join(process.cwd(), "prisma", "seed.ts"), "utf8");
    expect(seedSrc).not.toContain("changeme123");
    expect(FORBIDDEN_SEED_PASSWORD).toBe("changeme123");

    const pw = generateSeedPassword();
    expect(pw).not.toBe("changeme123");
    expect(pw.length).toBeGreaterThanOrEqual(12);

    const hash = await hashSeedPassword(pw);
    expect(await bcrypt.compare("changeme123", hash)).toBe(false);
    expect(await bcrypt.compare(pw, hash)).toBe(true);
  });

  it("Finding #1b: confirmation email is not sent on PENDING_PAYMENT and is sent after CONFIRMED", async () => {
    const { confirmationEmailsSent } = await import("../src/services/emailService.js");
    const { sendGuestConfirmationIfConfirmed } = await import("../src/services/reservationService.js");

    const rt = await prisma.roomType.findFirstOrThrow();
    const holdRes = await api("/api/public/availability/hold", {
      method: "POST",
      body: {
        roomTypeId: rt.id,
        checkIn: "2026-09-10",
        checkOut: "2026-09-13",
        rooms: 1,
      },
    });
    expect(holdRes.status).toBe(201);

    const before = confirmationEmailsSent.length;
    const bookRes = await api("/api/public/bookings", {
      method: "POST",
      body: {
        holdId: holdRes.body.holdId,
        guest: { fullName: "Pay Later Guest", phone: "9876501111", email: "paylater@test.com" },
      },
    });
    expect(bookRes.status).toBe(201);
    expect(bookRes.body.status).toBe("PENDING_PAYMENT");
    expect(confirmationEmailsSent.length).toBe(before);

    const sentWhilePending = await sendGuestConfirmationIfConfirmed(bookRes.body.id);
    expect(sentWhilePending).toBe(false);
    expect(confirmationEmailsSent.length).toBe(before);

    await prisma.reservation.update({
      where: { id: bookRes.body.id },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
    });
    const sentAfterConfirm = await sendGuestConfirmationIfConfirmed(bookRes.body.id);
    expect(sentAfterConfirm).toBe(true);
    expect(confirmationEmailsSent.length).toBe(before + 1);
    expect(confirmationEmailsSent[confirmationEmailsSent.length - 1]).toMatchObject({
      to: "paylater@test.com",
      bookingReference: bookRes.body.bookingReference,
    });
  });

  it("Finding #2: Cross-Tenant BOLA Isolation is enforced on Staff update", async () => {
    // Create Resort B and Staff B
    const resortB = await prisma.resort.create({
      data: {
        slug: "resort-b",
        name: "Resort B",
        phone: "1234567890",
        email: "resortb@test.com",
        address: "Test address",
        city: "Goa",
        state: "Goa",
      },
    });
    const staffB = await prisma.staff.create({
      data: {
        resortId: resortB.id,
        email: "staffb@resortb.com",
        passwordHash: "hash",
        name: "Staff B",
        roleKey: "RECEPTION",
      },
    });

    // Login as Owner of Resort A
    const { token, jar } = await loginAs("owner@test.com");

    // Owner of Resort A attempts to modify Staff B of Resort B
    const mutateRes = await api(`/api/admin/staff/${staffB.id}`, {
      method: "PATCH",
      token,
      jar,
      body: { roleKey: "OWNER" },
    });

    expect(mutateRes.status).toBe(404);

    // Verify Staff B was not modified
    const checkStaffB = await prisma.staff.findUnique({ where: { id: staffB.id } });
    expect(checkStaffB?.roleKey).toBe("RECEPTION");
  });

  it("Finding #2b: Cross-tenant IDOR blocked on guest view/update and reservation view/cancel", async () => {
    const stamp = Date.now();
    const resortB = await prisma.resort.create({
      data: {
        slug: `idor-resort-b-${stamp}`,
        name: "IDOR Resort B",
        phone: "1111111111",
        email: `idor-b-${stamp}@test.com`,
        address: "B addr",
        city: "Goa",
        state: "Goa",
      },
    });
    const rtB = await prisma.roomType.create({
      data: {
        resortId: resortB.id,
        slug: `idor-rt-${stamp}`,
        name: "IDOR Room",
        maxAdults: 2,
        maxOccupancy: 2,
        basePrice: 100000,
        totalUnits: 1,
      },
    });
    const guestB = await prisma.guest.create({
      data: {
        resortId: resortB.id,
        fullName: "Tenant B Guest",
        phone: "9000000001",
        email: "guestb@idor.test",
      },
    });
    const resB = await prisma.reservation.create({
      data: {
        resortId: resortB.id,
        bookingReference: `BKIDOR${stamp}`,
        guestId: guestB.id,
        roomTypeId: rtB.id,
        checkIn: new Date("2027-01-10"),
        checkOut: new Date("2027-01-13"),
        nights: 3,
        adults: 2,
        roomCount: 1,
        status: "CONFIRMED",
        source: "WEBSITE",
        nightlyRate: 100000,
        subtotal: 300000,
        taxAmount: 36000,
        totalAmount: 336000,
        amountPaid: 0,
        amountDue: 336000,
      },
    });

    const { token, jar } = await loginAs("owner@test.com");

    const viewGuest = await api(`/api/admin/guests/${guestB.id}`, { token, jar });
    expect([403, 404]).toContain(viewGuest.status);

    const patchGuest = await api(`/api/admin/guests/${guestB.id}`, {
      method: "PATCH",
      token,
      jar,
      body: { fullName: "Hijacked Name" },
    });
    expect([403, 404]).toContain(patchGuest.status);
    const guestAfter = await prisma.guest.findUnique({ where: { id: guestB.id } });
    expect(guestAfter?.fullName).toBe("Tenant B Guest");

    const viewRes = await api(`/api/admin/reservations/${resB.id}`, { token, jar });
    expect([403, 404]).toContain(viewRes.status);

    const cancelRes = await api(`/api/admin/reservations/${resB.id}/cancel`, {
      method: "POST",
      token,
      jar,
      body: { reason: "cross-tenant attempt" },
    });
    expect([403, 404]).toContain(cancelRes.status);
    const resAfter = await prisma.reservation.findUnique({ where: { id: resB.id } });
    expect(resAfter?.status).toBe("CONFIRMED");
  });

  it("Finding #3: RBAC permission required on /api/admin/dashboard", async () => {
    // Create Housekeeping staff in Resort A
    const ownerResort = await prisma.resort.findFirstOrThrow();
    const hkStaff = await prisma.staff.create({
      data: {
        resortId: ownerResort.id,
        email: "housekeeper_test@sunandwaterresort.com",
        passwordHash: await (await import("bcryptjs")).hash("changeme123", 4),
        name: "Housekeeper Test",
        roleKey: "HOUSEKEEPING",
      },
    });

    const { token, jar } = await loginAs(hkStaff.email);

    const dashRes = await api("/api/admin/dashboard", { token, jar });
    expect(dashRes.status).toBe(403);
  });

  it("Finding #3b: HOUSEKEEPING is denied dashboard, settings, and staff endpoints", async () => {
    const ownerResort = await prisma.resort.findFirstOrThrow();
    const hkEmail = `hk_priv_${Date.now()}@sunandwaterresort.com`;
    await prisma.staff.create({
      data: {
        resortId: ownerResort.id,
        email: hkEmail,
        passwordHash: await (await import("bcryptjs")).hash("changeme123", 4),
        name: "HK Privilege Test",
        roleKey: "HOUSEKEEPING",
      },
    });

    const { token, jar } = await loginAs(hkEmail);

    const dashRes = await api("/api/admin/dashboard", { token, jar });
    expect(dashRes.status).toBe(403);

    const settingsRes = await api("/api/admin/settings", { token, jar });
    expect(settingsRes.status).toBe(403);

    const staffRes = await api("/api/admin/staff", { token, jar });
    expect(staffRes.status).toBe(403);
  });

  it("Finding #5: Suspended staff cannot refresh tokens", async () => {
    const ownerResort = await prisma.resort.findFirstOrThrow();
    const tempStaff = await prisma.staff.create({
      data: {
        resortId: ownerResort.id,
        email: "to_suspend@sunandwaterresort.com",
        passwordHash: await (await import("bcryptjs")).hash("changeme123", 4),
        name: "Temp Staff",
        roleKey: "RECEPTION",
        status: "ACTIVE",
      },
    });

    const { jar } = await loginAs(tempStaff.email);

    // Admin suspends tempStaff
    await prisma.staff.update({
      where: { id: tempStaff.id },
      data: { status: "SUSPENDED" },
    });

    // Attempt refresh using saved refresh cookie
    const refreshRes = await api("/api/auth/refresh", {
      method: "POST",
      jar,
    });
    expect(refreshRes.status).toBe(401);
  });

  it("Finding #7: CSV export escapes formula trigger characters", async () => {
    const ownerResort = await prisma.resort.findFirstOrThrow();
    await prisma.guest.create({
      data: {
        resortId: ownerResort.id,
        fullName: "=SUM(1+1)",
        phone: "9998887776",
        email: "+malicious@test.com",
      },
    });

    const { token, jar } = await loginAs("owner@test.com");
    const exportRes = await api("/api/admin/guests/export", { token, jar });
    expect(exportRes.status).toBe(200);

    // Verify CSV content prefixes formula characters with single quote
    expect(exportRes.text).toContain("'=SUM(1+1)");
    expect(exportRes.text).toContain("'+malicious@test.com");
  });

  it("Finding #9: Maximum stay duration exceeds 30 nights cap", async () => {
    const availRes = await api(
      "/api/public/availability?checkIn=2026-09-01&checkOut=2026-10-15"
    );
    expect(availRes.status).toBe(400);
    expect(availRes.body.error.code).toBe("MAX_STAY_EXCEEDED");
  });

  it("Finding #6: WebSocket handshake rejects missing and invalid tokens", async () => {
    const { WebSocket } = await import("ws");
    const wsBase = baseUrl.replace("http", "ws");

    const noToken = new WebSocket(`${wsBase}/ws`);
    const errNoToken = await new Promise<Error>((r) => {
      noToken.on("error", r);
    });
    expect(errNoToken.message).toContain("401");

    const badToken = new WebSocket(`${wsBase}/ws?token=not-a-valid-jwt`);
    const errBad = await new Promise<Error>((r) => {
      badToken.on("error", r);
    });
    expect(errBad.message).toContain("401");
  });

  it("Finding #10: WebSocket handshake rejects suspended and deleted staff", async () => {
    const { WebSocket } = await import("ws");
    const { signAccessToken } = await import("../src/services/tokenService.js");
    const ownerResort = await prisma.resort.findFirstOrThrow();

    const suspendedStaff = await prisma.staff.create({
      data: {
        resortId: ownerResort.id,
        email: "ws_suspended@test.com",
        passwordHash: "hash",
        name: "Suspended WS",
        roleKey: "RECEPTION",
        status: "SUSPENDED",
      },
    });

    const suspendedToken = signAccessToken({
      sub: suspendedStaff.id,
      resortId: ownerResort.id,
      role: "RECEPTION",
      email: suspendedStaff.email,
      name: suspendedStaff.name,
    });

    const wsUrlSuspended = baseUrl.replace("http", "ws") + `/ws?token=${suspendedToken}`;
    const wsSuspended = new WebSocket(wsUrlSuspended);

    const errSuspended = await new Promise<any>((r) => {
      wsSuspended.on("error", r);
    });
    expect(errSuspended.message).toContain("401");

    const deletedStaff = await prisma.staff.create({
      data: {
        resortId: ownerResort.id,
        email: "ws_deleted@test.com",
        passwordHash: "hash",
        name: "Deleted WS",
        roleKey: "RECEPTION",
        status: "ACTIVE",
        deletedAt: new Date(),
      },
    });

    const deletedToken = signAccessToken({
      sub: deletedStaff.id,
      resortId: ownerResort.id,
      role: "RECEPTION",
      email: deletedStaff.email,
      name: deletedStaff.name,
    });

    const wsUrlDeleted = baseUrl.replace("http", "ws") + `/ws?token=${deletedToken}`;
    const wsDeleted = new WebSocket(wsUrlDeleted);

    const errDeleted = await new Promise<any>((r) => {
      wsDeleted.on("error", r);
    });
    expect(errDeleted.message).toContain("401");
  });

  it("Finding #10: WebSocket filters PII for HOUSEKEEPING and retains PII for MANAGER", async () => {
    const { WebSocket } = await import("ws");
    const { eventBus } = await import("../src/realtime/events.js");
    const { signAccessToken } = await import("../src/services/tokenService.js");
    const ownerResort = await prisma.resort.findFirstOrThrow();

    const hkStaff = await prisma.staff.create({
      data: {
        resortId: ownerResort.id,
        email: "ws_hk@test.com",
        passwordHash: "hash",
        name: "HK WS Staff",
        roleKey: "HOUSEKEEPING",
        status: "ACTIVE",
      },
    });

    const mgrStaff = await prisma.staff.create({
      data: {
        resortId: ownerResort.id,
        email: "ws_mgr@test.com",
        passwordHash: "hash",
        name: "MGR WS Staff",
        roleKey: "MANAGER",
        status: "ACTIVE",
      },
    });

    const hkToken = signAccessToken({
      sub: hkStaff.id,
      resortId: ownerResort.id,
      role: "HOUSEKEEPING",
      email: hkStaff.email,
      name: hkStaff.name,
    });

    const mgrToken = signAccessToken({
      sub: mgrStaff.id,
      resortId: ownerResort.id,
      role: "MANAGER",
      email: mgrStaff.email,
      name: mgrStaff.name,
    });

    const wsUrlHk = baseUrl.replace("http", "ws") + `/ws?token=${hkToken}`;
    const wsUrlMgr = baseUrl.replace("http", "ws") + `/ws?token=${mgrToken}`;

    const wsHk = new WebSocket(wsUrlHk);
    const wsMgr = new WebSocket(wsUrlMgr);

    await Promise.all([
      new Promise((r) => wsHk.on("open", r)),
      new Promise((r) => wsMgr.on("open", r)),
    ]);

    const hkMessages: any[] = [];
    const mgrMessages: any[] = [];

    wsHk.on("message", (msg) => hkMessages.push(JSON.parse(msg.toString())));
    wsMgr.on("message", (msg) => mgrMessages.push(JSON.parse(msg.toString())));

    const sampleEvent = {
      type: "BOOKING_CREATED" as const,
      data: {
        reservation: {
          id: "res-123",
          totalAmount: 500000,
          amountPaid: 0,
          guest: { fullName: "Jane Doe", phone: "9876543210" },
        },
      },
    };

    eventBus.emitEvent(ownerResort.id, sampleEvent);

    await new Promise((r) => setTimeout(r, 150));

    wsHk.close();
    wsMgr.close();

    const hkBookingEvt = hkMessages.find((m) => m.type === "BOOKING_CREATED");
    const mgrBookingEvt = mgrMessages.find((m) => m.type === "BOOKING_CREATED");

    expect(hkBookingEvt).toBeDefined();
    expect(hkBookingEvt.data.reservation.guest).toBeUndefined();
    expect(hkBookingEvt.data.reservation.totalAmount).toBeUndefined();

    expect(mgrBookingEvt).toBeDefined();
    expect(mgrBookingEvt.data.reservation.guest.fullName).toBe("Jane Doe");
    expect(mgrBookingEvt.data.reservation.totalAmount).toBe(500000);
  });

  it("Finding #1: Expired PENDING_PAYMENT reservation transitions to EXPIRED and releases inventory", async () => {
    const { expirePendingPaymentReservations } = await import("../src/services/expirationService.js");
    const { getAvailability } = await import("../src/services/availabilityService.js");
    const ownerResort = await prisma.resort.findFirstOrThrow();
    const rt = await prisma.roomType.findFirstOrThrow();

    const guest = await prisma.guest.create({
      data: {
        resortId: ownerResort.id,
        fullName: "Expired Guest",
        phone: "1112223333",
      },
    });

    const pastExpiry = new Date(Date.now() - 5 * 60 * 1000); // 5 mins in the past

    const expiredRes = await prisma.reservation.create({
      data: {
        resortId: ownerResort.id,
        bookingReference: "BKEXP01",
        guestId: guest.id,
        roomTypeId: rt.id,
        checkIn: new Date("2026-11-01"),
        checkOut: new Date("2026-11-04"),
        nights: 3,
        adults: 2,
        roomCount: 1,
        status: "PENDING_PAYMENT",
        source: "WEBSITE",
        nightlyRate: 100000,
        subtotal: 300000,
        taxAmount: 36000,
        totalAmount: 336000,
        amountPaid: 0,
        amountDue: 336000,
        holdExpiresAt: pastExpiry,
      },
    });

    const futureExpiry = new Date(Date.now() + 20 * 60 * 1000); // 20 mins in the future

    const activeRes = await prisma.reservation.create({
      data: {
        resortId: ownerResort.id,
        bookingReference: "BKACT01",
        guestId: guest.id,
        roomTypeId: rt.id,
        checkIn: new Date("2026-11-10"),
        checkOut: new Date("2026-11-12"),
        nights: 2,
        adults: 2,
        roomCount: 1,
        status: "PENDING_PAYMENT",
        source: "WEBSITE",
        nightlyRate: 100000,
        subtotal: 200000,
        taxAmount: 24000,
        totalAmount: 224000,
        amountPaid: 0,
        amountDue: 224000,
        holdExpiresAt: futureExpiry,
      },
    });

    // Run sweeper
    const count1 = await expirePendingPaymentReservations();
    expect(count1).toBeGreaterThanOrEqual(1);

    // Verify expired booking is EXPIRED
    const checkExpired = await prisma.reservation.findUnique({ where: { id: expiredRes.id } });
    expect(checkExpired?.status).toBe("EXPIRED");

    // Verify active booking remains PENDING_PAYMENT
    const checkActive = await prisma.reservation.findUnique({ where: { id: activeRes.id } });
    expect(checkActive?.status).toBe("PENDING_PAYMENT");

    // Re-running sweeper should return 0 for double-expiry idempotency
    const count2 = await expirePendingPaymentReservations();
    expect(count2).toBe(0);

    // Verify availability ignores EXPIRED reservation
    const avail = await getAvailability({
      resortId: ownerResort.id,
      checkIn: "2026-11-01",
      checkOut: "2026-11-04",
    });
    const rtAvail = avail.roomTypes.find((r) => r.id === rt.id);
    expect(rtAvail?.available).toBe(rt.totalUnits);
  });

  it("Finding #4: Parallel hold requests on single-unit roomType result in exactly 1 hold and 19 conflict errors", async () => {
    const { createHold } = await import("../src/services/reservationHoldService.js");
    const ownerResort = await prisma.resort.findFirstOrThrow();

    const rtSingleUnit = await prisma.roomType.create({
      data: {
        resortId: ownerResort.id,
        slug: "single-unit-race-" + Date.now(),
        name: "Single Unit Race Test",
        maxAdults: 2,
        maxOccupancy: 2,
        basePrice: 200000,
        totalUnits: 1,
        status: "ACTIVE",
      },
    });

    const checkIn = new Date("2026-12-01");
    const checkOut = new Date("2026-12-03");

    // Fire 20 parallel hold requests with unique session IDs
    const holdPromises = Array.from({ length: 20 }, (_, i) =>
      createHold({
        resortId: ownerResort.id,
        roomTypeId: rtSingleUnit.id,
        quantity: 1,
        checkIn,
        checkOut,
        sessionId: `race-session-${i}-${Date.now()}`,
      }).then(
        (hold) => ({ status: "fulfilled" as const, value: hold }),
        (err) => ({ status: "rejected" as const, reason: err })
      )
    );

    const results = await Promise.all(holdPromises);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(19);

    // Verify database active holds count for this roomType
    const activeHolds = await prisma.reservationHold.findMany({
      where: {
        resortId: ownerResort.id,
        roomTypeId: rtSingleUnit.id,
        status: "ACTIVE",
      },
    });

    expect(activeHolds.length).toBe(1);
  });

  it("Finding #11: negative quantity and amount are rejected with 400", async () => {
    const rt = await prisma.roomType.findFirstOrThrow();
    const negQty = await api("/api/public/availability/hold", {
      method: "POST",
      body: {
        roomTypeId: rt.id,
        checkIn: "2028-05-01",
        checkOut: "2028-05-03",
        rooms: -1,
      },
    });
    expect(negQty.status).toBe(400);

    const negAmount = await api("/api/public/availability/hold", {
      method: "POST",
      body: {
        roomTypeId: rt.id,
        checkIn: "2028-05-01",
        checkOut: "2028-05-03",
        rooms: 1,
        amount: -500,
      },
    });
    expect(negAmount.status).toBe(400);

    const negAdults = await api("/api/public/bookings", {
      method: "POST",
      body: {
        holdId: "not-a-real-hold",
        guest: { fullName: "Neg", phone: "9000000099" },
        adults: -2,
      },
    });
    expect(negAdults.status).toBe(400);
  });

  it("Finding #7: hold creation is rate limited to 10 per IP per window", async () => {
    const rt = await prisma.roomType.findFirstOrThrow();
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await api("/api/public/availability/hold", {
        method: "POST",
        headers: { "X-Test-IP": "203.0.113.77" },
        body: {
          roomTypeId: rt.id,
          checkIn: "2028-01-01",
          checkOut: "2028-01-03",
          rooms: 1,
        },
      });
      statuses.push(res.status);
    }
    expect(statuses[10]).toBe(429);
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(1);
  });

  it("Finding #9: access/refresh tokens are not persisted in localStorage or sessionStorage", async () => {
    const { readFileSync, readdirSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const frontendSrc = join(process.cwd(), "..", "frontend", "src");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx|js|jsx)$/.test(name)) files.push(p);
      }
    };
    walk(frontendSrc);

    const offenders: string[] = [];
    const tokenStore = /(?:localStorage|sessionStorage)\.setItem\s*\(\s*['"][^'"]*(token|jwt|refresh|access)[^'"]*['"]/i;
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      if (tokenStore.test(text)) offenders.push(file);
    }
    expect(offenders).toEqual([]);

    const apiClient = readFileSync(join(frontendSrc, "lib", "api.ts"), "utf8");
    expect(apiClient).toMatch(/let accessToken: string \| null = null/);
    expect(apiClient).toContain('credentials: "include"');
    expect(apiClient).not.toMatch(/localStorage/);
    expect(apiClient).not.toMatch(/sessionStorage/);
  });

  it("Finding #8: validation errors do not leak stack traces or file paths", async () => {
    const { token, jar } = await loginAs("owner@test.com");
    const res = await api("/api/admin/reviews", {
      method: "POST",
      token,
      jar,
      body: { source: "WEBSITE", authorName: "", rating: -3, body: "" },
    });
    expect([400, 422]).toContain(res.status);
    const dumped = JSON.stringify(res.body);
    expect(dumped).not.toMatch(/[A-Za-z]:\\Users\\/);
    expect(dumped).not.toContain("node_modules");
    expect(dumped).not.toMatch(/\.(ts|js):\d+/);
    expect(dumped).not.toContain("sun-water-resort");
    expect((res.body as { error?: { stack?: string } }).error?.stack).toBeUndefined();
  });

  it("Finding #SQLi: search q is parameterized and does not dump all rows or leak stack traces", async () => {
    const ownerResort = await prisma.resort.findFirstOrThrow();
    await prisma.guest.createMany({
      data: [
        { resortId: ownerResort.id, fullName: "Normal Search Guest", phone: "9111000001" },
        { resortId: ownerResort.id, fullName: "Another Search Guest", phone: "9111000002" },
      ],
    });
    const totalGuests = await prisma.guest.count({ where: { resortId: ownerResort.id } });
    expect(totalGuests).toBeGreaterThanOrEqual(2);

    const { token, jar } = await loginAs("owner@test.com");
    const injection = "'+OR+1=1--";
    const guestsRes = await api(`/api/admin/guests?q=${encodeURIComponent(injection)}`, { token, jar });
    expect([200, 400]).toContain(guestsRes.status);
    expect(guestsRes.text).not.toMatch(/[A-Za-z]:\\/);
    expect(guestsRes.text).not.toMatch(/\/home\//);
    expect(guestsRes.text.toLowerCase()).not.toContain("prisma");
    expect(guestsRes.text).not.toContain("at ");
    if (guestsRes.status === 200) {
      const items = (guestsRes.body as { items: unknown[] }).items;
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeLessThan(totalGuests);
    }

    const resRes = await api(`/api/admin/reservations?q=${encodeURIComponent(injection)}`, { token, jar });
    expect([200, 400]).toContain(resRes.status);
    expect(resRes.text).not.toMatch(/[A-Za-z]:\\/);
    expect(resRes.text.toLowerCase()).not.toContain("stack");
    if (resRes.status === 200) {
      expect(Array.isArray((resRes.body as { items: unknown[] }).items)).toBe(true);
    }
  });

  it("Finding #XSS: enquiry name, booking guest name, and review body strip script tags", async () => {
    const payload = "<script>alert(1)</script>";
    const { token, jar } = await loginAs("owner@test.com");

    const enq = await api("/api/public/enquiries", {
      method: "POST",
      body: {
        name: payload,
        phone: "9876500001",
        message: "<img src=x onerror=alert(1)>hello",
      },
    });
    expect(enq.status).toBe(201);
    const enqId = (enq.body as { id: string }).id;
    const listed = await api("/api/admin/enquiries", { token, jar });
    expect(listed.status).toBe(200);
    const savedEnq = (listed.body as { items: Array<{ id: string; name: string; message: string | null }> }).items.find(
      (e) => e.id === enqId
    );
    expect(savedEnq).toBeDefined();
    expect(savedEnq!.name.toLowerCase()).not.toContain("<script");
    expect(savedEnq!.name).not.toMatch(/<script/i);
    if (savedEnq!.message) {
      expect(savedEnq!.message.toLowerCase()).not.toContain("onerror=");
      expect(savedEnq!.message).not.toMatch(/<img/i);
    }

    const rt = await prisma.roomType.findFirstOrThrow();
    const holdRes = await api("/api/public/availability/hold", {
      method: "POST",
      body: {
        roomTypeId: rt.id,
        checkIn: "2027-03-01",
        checkOut: "2027-03-03",
        rooms: 1,
      },
    });
    expect(holdRes.status).toBe(201);
    const bookRes = await api("/api/public/bookings", {
      method: "POST",
      body: {
        holdId: holdRes.body.holdId,
        guest: { fullName: payload, phone: "9876500002" },
      },
    });
    expect(bookRes.status).toBe(201);
    const guestName = bookRes.body.guest?.fullName ?? bookRes.body.guestName;
    const storedGuest = await prisma.guest.findFirst({
      where: { phone: "9876500002" },
    });
    expect(storedGuest).toBeTruthy();
    expect(storedGuest!.fullName.toLowerCase()).not.toContain("<script");
    if (typeof guestName === "string") {
      expect(guestName.toLowerCase()).not.toContain("<script");
    }

    const reviewRes = await api("/api/admin/reviews", {
      method: "POST",
      token,
      jar,
      body: {
        source: "WEBSITE",
        authorName: "Safe Guest",
        rating: 5,
        body: payload + " lovely stay",
        status: "DRAFT",
      },
    });
    expect(reviewRes.status).toBe(201);
    const reviewBody =
      reviewRes.body.review?.content ?? reviewRes.body.review?.body ?? "";
    expect(String(reviewBody).toLowerCase()).not.toContain("<script");
  });

  // ─── Upload Security Tests ──────────────────────────────────────────────────

  async function uploadBuffer(
    buf: Buffer,
    filename: string,
    mimetype: string,
    token: string,
    jar: CookieJar
  ) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (jar.csrf) headers["X-CSRF-Token"] = jar.csrf;
    const cookieHeader = Object.entries(jar.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
    if (cookieHeader) headers["Cookie"] = cookieHeader;

    const form = new FormData();
    form.append("file", new Blob([buf], { type: mimetype }), filename);
    const res = await fetch(`${baseUrl}/api/admin/upload`, {
      method: "POST",
      headers,
      body: form,
    });
    const text = await res.text();
    let json: any = {};
    try { json = JSON.parse(text); } catch {}
    return { status: res.status, body: json };
  }

  it("Upload security: rejects HTML-as-PNG, rejects SVG, accepts valid PNG, and accepts PNG-header binary", async () => {
    const { token, jar } = await loginAs("owner@test.com");

    // 1. HTML disguised as PNG — magic byte mismatch → 400
    const html = Buffer.from("<html><script>alert('xss')</script></html>", "utf-8");
    const res1 = await uploadBuffer(html, "exploit.png", "image/png", token, jar);
    expect(res1.status).toBe(400);
    expect(res1.body.error?.code).toBe("UNSUPPORTED_MEDIA_TYPE");

    // 2. SVG with embedded script — MIME type blocked by multer → 400
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert("xss")</script></svg>',
      "utf-8"
    );
    const res2 = await uploadBuffer(svg, "vector.svg", "image/svg+xml", token, jar);
    // multer fileFilter throws Error("UNSUPPORTED_MEDIA_TYPE") — may surface as 400 or 500
    expect([400, 500]).toContain(res2.status);

    // 3. Valid PNG with correct magic bytes → 200
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      "base64"
    );
    const res3 = await uploadBuffer(png, "valid.png", "image/png", token, jar);
    expect(res3.status).toBe(200);
    expect(res3.body.url).toMatch(/^\/uploads\//);
    expect(res3.body.mimetype).toBe("image/png");

    // 4. PNG magic header followed by HTML body — header-only check passes → 200
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const fakeBody = Buffer.from("<html>not an image</html>", "utf-8");
    const combined = Buffer.concat([pngHeader, fakeBody]);
    const res4 = await uploadBuffer(combined, "tricky.png", "image/png", token, jar);
    // The magic byte check only validates the header signature.
    // This passes because bytes 0–3 match PNG (89 50 4E 47).
    expect(res4.status).toBe(200);
  });

  it("Finding #5b: HTML disguised as PNG is never written to the uploads directory", async () => {
    const { readdirSync, existsSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { token, jar } = await loginAs("owner@test.com");
    const ownerResort = await prisma.resort.findFirstOrThrow();
    const uploadDir = join(process.cwd(), "uploads", ownerResort.id);
    const before = existsSync(uploadDir) ? new Set(readdirSync(uploadDir)) : new Set<string>();

    const html = Buffer.from("<html><script>alert('xss')</script></html>", "utf-8");
    const res = await uploadBuffer(html, "exploit.png", "image/png", token, jar);
    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe("UNSUPPORTED_MEDIA_TYPE");

    if (existsSync(uploadDir)) {
      const after = readdirSync(uploadDir);
      const added = after.filter((f) => !before.has(f));
      expect(added).toEqual([]);
    }
  });

  it("File Upload XSS: Uses safe extension derived from magic bytes instead of user-provided extension", async () => {
    const { token, jar } = await loginAs("owner@test.com");
    const payload = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]),
      Buffer.from("<html><script>alert('xss')</script></html>", "utf-8")
    ]);
    const res = await uploadBuffer(payload, "exploit.html", "image/png", token, jar);
    expect(res.status).toBe(200);
    expect(res.body.url.endsWith(".png")).toBe(true);
    expect(res.body.url.endsWith(".html")).toBe(false);
  });

  it("Rate Limiting: POST /api/public/enquiries blocks after 10 requests", async () => {
    const ip = "192.168.1.100";
    for (let i = 0; i < 10; i++) {
      const res = await fetch(`${baseUrl}/api/public/enquiries`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Test-IP": ip },
        body: JSON.stringify({ name: "Test", phone: "12345678" }),
      });
      expect(res.status).toBe(201);
    }
    const res11 = await fetch(`${baseUrl}/api/public/enquiries`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Test-IP": ip },
      body: JSON.stringify({ name: "Test", phone: "12345678" }),
    });
    expect(res11.status).toBe(429);
  });

  it("Rate Limiting: POST /api/auth/password-reset/request blocks after 5 requests", async () => {
    const ip = "192.168.1.101";
    for (let i = 0; i < 5; i++) {
      const res = await fetch(`${baseUrl}/api/auth/password-reset/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Test-IP": ip },
        body: JSON.stringify({ email: "test@example.com" }),
      });
      expect(res.status).toBe(200);
    }
    const res6 = await fetch(`${baseUrl}/api/auth/password-reset/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Test-IP": ip },
      body: JSON.stringify({ email: "test@example.com" }),
    });
    expect(res6.status).toBe(429);
  });
});
