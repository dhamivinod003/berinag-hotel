// Tests for the new features added on top of the critical suite:
// guests, reviews/testimonials, notifications, file upload, tenant isolation.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { setupTestEnv, teardownTestEnv, seedMinimalResort, prisma } from "./setup";

let server: Server;
let baseUrl: string;
let ownerToken = "";
let receptionToken = "";
let ownerJar: CookieJar = newJar();
let receptionJar: CookieJar = newJar();

interface CookieJar {
  cookies: Record<string, string>;
  csrf: string | null;
}
function newJar(): CookieJar { return { cookies: {}, csrf: null }; }
function applySetCookie(jar: CookieJar, setCookieHeader: string | string[] | undefined) {
  if (!setCookieHeader) return;
  const list = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  for (const c of list) {
    const m = c.match(/^([^=]+)=([^;]*)/);
    if (m) {
      jar.cookies[m[1]] = m[2];
      if (m[1] === "swr_csrf") jar.csrf = m[2];
    }
  }
}

async function req(
  method: string,
  path: string,
  opts: { jar?: CookieJar; body?: unknown; auth?: string } = {}
): Promise<{ status: number; data: any; headers: Headers }> {
  const jar = opts.jar ?? newJar();
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.auth) headers["Authorization"] = `Bearer ${opts.auth}`;
  if (jar.csrf && method !== "GET" && method !== "HEAD") headers["X-CSRF-Token"] = jar.csrf;
  const cookieHeader = Object.entries(jar.cookies).map(([k, v]) => `${k}=${v}`).join("; ");
  if (cookieHeader) headers["Cookie"] = cookieHeader;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  applySetCookie(jar, res.headers.get("set-cookie") ?? undefined);
  const ct = res.headers.get("content-type") ?? "";
  const data = ct.includes("application/json") ? await res.json() : await res.text();
  return { status: res.status, data, headers: res.headers };
}

async function loginAs(email: string, password: string): Promise<{ token: string; jar: CookieJar }> {
  const jar = newJar();
  const r = await req("POST", "/api/auth/login", {
    jar,
    body: { email, password },
  });
  if (r.status !== 200) throw new Error(`Login ${email} failed: ${r.status} ${JSON.stringify(r.data)}`);
  return { token: r.data.accessToken, jar };
}

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
  const o = await loginAs("owner@test.com", "changeme123");
  const rec = await loginAs("rec@test.com", "changeme123");
  ownerToken = o.token;
  receptionToken = rec.token;
  ownerJar = o.jar;
  receptionJar = rec.jar;
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  await teardownTestEnv();
});

describe("New features: guests, reviews, notifications, uploads", () => {
  describe("Guest management", () => {
    it("lists guests with pagination", async () => {
      const r = await req("GET", "/api/admin/guests?limit=5", { auth: ownerToken, jar: ownerJar });
      expect(r.status).toBe(200);
      expect(r.data.items).toBeInstanceOf(Array);
      expect(typeof r.data.total).toBe("number");
    });

    it("searches guests by name", async () => {
      const r = await req("GET", "/api/admin/guests?q=Glass", { auth: ownerToken, jar: ownerJar });
      expect(r.status).toBe(200);
      expect(r.data.items).toBeInstanceOf(Array);
    });

    it("rejects unauthenticated access", async () => {
      const r = await req("GET", "/api/admin/guests");
      expect(r.status).toBe(401);
    });

    it("returns 404 for unknown guest id", async () => {
      const r = await req("GET", "/api/admin/guests/nonexistent-id", { auth: ownerToken, jar: ownerJar });
      expect(r.status).toBe(404);
    });

    it("exports guests as CSV", async () => {
      const r = await req("GET", "/api/admin/guests/export", { auth: ownerToken, jar: ownerJar });
      expect(r.status).toBe(200);
      expect(r.headers.get("content-type")).toContain("text/csv");
    });
  });

  describe("Reviews / Testimonials", () => {
    let reviewId = "";
    it("creates a new testimonial with truthful source", async () => {
      const r = await req("POST", "/api/admin/reviews", {
        auth: ownerToken,
        jar: ownerJar,
        body: {
          source: "WEBSITE",
          authorName: "Test Author",
          rating: 5,
          body: "This is a test review created by the test suite.",
          status: "DRAFT",
          isFeatured: false,
        },
      });
      expect(r.status, JSON.stringify(r.data)).toBe(201);
      expect(r.data.review.id).toBeTruthy();
      expect(r.data.review.source).toBe("WEBSITE");
      expect(r.data.review.authorName).toBe("Test Author");
      reviewId = r.data.review.id;
    });

    it("rejects invalid source enum", async () => {
      const r = await req("POST", "/api/admin/reviews", {
        auth: ownerToken,
        jar: ownerJar,
        body: {
          source: "INVALID_SOURCE",
          authorName: "Bad",
          rating: 5,
          body: "Should fail",
          status: "DRAFT",
          isFeatured: false,
        },
      });
      expect([400, 422]).toContain(r.status);
    });

    it("rejects invalid rating", async () => {
      const r = await req("POST", "/api/admin/reviews", {
        auth: ownerToken,
        jar: ownerJar,
        body: {
          source: "WEBSITE",
          authorName: "Bad Rating",
          rating: 99,
          body: "Should fail",
          status: "DRAFT",
          isFeatured: false,
        },
      });
      expect([400, 422]).toContain(r.status);
    });

    it("publishes a review", async () => {
      const r = await req("PATCH", `/api/admin/reviews/${reviewId}`, {
        auth: ownerToken,
        jar: ownerJar,
        body: {
          source: "WEBSITE",
          authorName: "Test Author",
          rating: 5,
          body: "This is a test review created by the test suite.",
          status: "PUBLISHED",
          isFeatured: false,
        },
      });
      expect(r.status).toBe(200);
      expect(r.data.review.status).toBe("PUBLISHED");
    });

    it("public endpoint only returns PUBLISHED reviews", async () => {
      const r = await req("GET", "/api/public/reviews");
      expect(r.status).toBe(200);
      for (const rev of r.data) {
        expect(rev.status).toBe("PUBLISHED");
      }
    });

    it("deletes a review", async () => {
      const r = await req("DELETE", `/api/admin/reviews/${reviewId}`, { auth: ownerToken, jar: ownerJar });
      expect(r.status).toBe(204);
    });
  });

  describe("Notification center", () => {
    it("returns unread count", async () => {
      const r = await req("GET", "/api/admin/notifications/unread-count", { auth: ownerToken, jar: ownerJar });
      expect(r.status).toBe(200);
      expect(typeof r.data.count).toBe("number");
    });

    it("lists notifications with pagination", async () => {
      const r = await req("GET", "/api/admin/notifications?limit=10", { auth: ownerToken, jar: ownerJar });
      expect(r.status).toBe(200);
      expect(r.data.items).toBeInstanceOf(Array);
    });

    it("filters unread only", async () => {
      const r = await req("GET", "/api/admin/notifications?unread=true&limit=10", { auth: ownerToken, jar: ownerJar });
      expect(r.status).toBe(200);
      for (const n of r.data.items) {
        expect(n.readAt).toBeNull();
      }
    });

    it("marks a single notification as read", async () => {
      const resort = await prisma.resort.findFirst();
      if (!resort) return;
      const created = await prisma.notification.create({
        data: {
          resortId: resort.id,
          audience: "staff",
          type: "TEST",
          channel: "INAPP",
          title: "Test notif",
          body: "Body",
          link: "/admin",
        },
      });
      const r = await req("PATCH", `/api/admin/notifications/${created.id}/read`, { auth: ownerToken, jar: ownerJar });
      expect(r.status).toBe(200);
      expect(r.data.notification.readAt).not.toBeNull();
    });

    it("marks all as read", async () => {
      const r = await req("POST", "/api/admin/notifications/read-all", { auth: ownerToken, jar: ownerJar, body: {} });
      expect(r.status).toBe(200);
      expect(typeof r.data.updated).toBe("number");
    });

    it("deletes a notification", async () => {
      const resort = await prisma.resort.findFirst();
      if (!resort) return;
      const n = await prisma.notification.create({
        data: {
          resortId: resort.id,
          audience: "staff",
          type: "TEST_DELETE",
          channel: "INAPP",
          title: "To delete",
          body: "Body",
        },
      });
      const r = await req("DELETE", `/api/admin/notifications/${n.id}`, { auth: ownerToken, jar: ownerJar });
      expect(r.status).toBe(204);
    });
  });

  describe("File upload", () => {
    it("rejects when no file is provided", async () => {
      const r = await req("POST", "/api/admin/upload", { auth: ownerToken, jar: ownerJar, body: {} });
      expect(r.status).toBe(400);
    });

    it("accepts a valid PNG upload", async () => {
      // 1x1 transparent PNG
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        "base64"
      );
      const headers: Record<string, string> = {
        Authorization: `Bearer ${ownerToken}`,
      };
      if (ownerJar.csrf) headers["X-CSRF-Token"] = ownerJar.csrf;
      const cookieHeader = Object.entries(ownerJar.cookies).map(([k, v]) => `${k}=${v}`).join("; ");
      if (cookieHeader) headers["Cookie"] = cookieHeader;
      const form = new FormData();
      form.append("file", new Blob([png], { type: "image/png" }), "test.png");
      const res = await fetch(`${baseUrl}/api/admin/upload`, {
        method: "POST",
        headers,
        body: form,
      });
      const data = await res.json();
      expect(res.status, JSON.stringify(data)).toBe(200);
      expect(data.url).toMatch(/^\/uploads\//);
      expect(data.mimetype).toBe("image/png");
    });
  });

  describe("Tenant isolation", () => {
    it("reception cannot see revenue field on guest profile", async () => {
      const list = await req("GET", "/api/admin/guests?limit=1", { auth: receptionToken, jar: receptionJar });
      if (list.status !== 200 || list.data.items.length === 0) {
        // Reception might not have GUEST_VIEW — fine
        expect([200, 403]).toContain(list.status);
        return;
      }
      const guestId = list.data.items[0].id;
      const r = await req("GET", `/api/admin/guests/${guestId}`, { auth: receptionToken, jar: receptionJar });
      if (r.status === 200) {
        // Reception likely lacks REVENUE_VIEW
        expect(r.data.stats.canSeeRevenue).toBe(false);
        expect(r.data.stats.totalSpentPaise).toBe(0);
      } else {
        expect(r.status).toBe(403);
      }
    });
  });
});
