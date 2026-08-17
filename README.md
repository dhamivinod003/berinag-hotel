# Sun & Water Resort Platform

> A production-grade, multi-tenant hospitality reservation and resort management platform for Sun & Water Resort (Pithoragarh, Uttarakhand).
> Features a public guest booking application, administrative staff dashboard, real-time WebSocket notifications, Razorpay payment engine, fine-grained RBAC, and full adversarial security hardening.

---

## 🏗 Architecture & Tech Stack

```
┌──────────────────────────────────────┐
│       Public Guest Frontend          │   /, /rooms, /booking, /lookup, ...
│    Next.js 14 · React · Tailwind     │
└──────────────────┬───────────────────┘
                   │  HTTPS · REST / JSON
┌──────────────────▼───────────────────┐    ┌───────────────────────────────────┐
│     Admin Staff Dashboard            │◄──►│       Express + TS Backend        │
│   /admin, /admin/bookings, ...       │    │ Prisma ORM · SQLite (dev) / PG    │
└──────────────────────────────────────┘    │ Razorpay Payments · WebSocket     │
                                            └───────────────────────────────────┘
```

- **Frontend:** Next.js 14 App Router, TypeScript, Tailwind CSS, Framer Motion.
- **Backend:** Node.js, Express.js, TypeScript, Prisma ORM, Zod validation, Pino logging, Prometheus metrics (`/metrics`).
- **Database:** SQLite (development & Vitest testing), PostgreSQL (production).
- **Security:** Double-submit CSRF protection, HttpOnly cookie sessions, Access JWTs, 59 fine-grained permissions, 5 roles (`OWNER`, `MANAGER`, `RECEPTION`, `MARKETING`, `HOUSEKEEPING`).
- **Payments:** Razorpay Gateway (Integer paise storage, signature verification, replay protection window).

---

## 🔒 Defensive Security Audit & Hardening Status

The application underwent a 109-phase adversarial security, reliability, state-machine, payment, and tenant-isolation audit. All 12 identified vulnerabilities have been fully remediated and verified:

- ✅ **Payment-First State Machine:** Public bookings set status to `PENDING_PAYMENT` upon hold conversion. Bookings are only transitioned to `CONFIRMED` after verified Razorpay payment capture ([`reservationService.ts`](file:///c:/Users/vinod%20dhami/sun-water-resort/backend/src/services/reservationService.ts#L115)).
- ✅ **Strict Tenant Isolation (BOLA Elimination):** All database reads, updates, deletes, and refunds enforce `resortId: req.staff!.resortId` ([`adminController.ts`](file:///c:/Users/vinod%20dhami/sun-water-resort/backend/src/controllers/adminController.ts#L398)).
- ✅ **RBAC Protection:** Route permission gates (`requirePermission`) attached to `/dashboard`, `/settings`, `/cms/hero`, preventing unauthorized staff access ([`admin.ts`](file:///c:/Users/vinod%20dhami/sun-water-resort/backend/src/routes/admin.ts#L115)).
- ✅ **Session Revocation Enforcement:** Token refresh checks `staff.status === "ACTIVE"` and `staff.deletedAt === null`, immediately locking out suspended/deleted accounts ([`authService.ts`](file:///c:/Users/vinod%20dhami/sun-water-resort/backend/src/services/authService.ts#L131)).
- ✅ **Idempotent Payment Webhooks:** `payment.captured` webhooks process inside a transaction checking `payment.status !== "CAPTURED"`, preventing financial inflation on replayed events ([`paymentService.ts`](file:///c:/Users/vinod%20dhami/sun-water-resort/backend/src/services/paymentService.ts#L318)).
- ✅ **Upload & Static Asset Security:** File uploads inspect magic byte signatures (PNG, JPEG, GIF, WEBP) server-side, and static `/uploads` routes serve `X-Content-Type-Options: nosniff` and `Content-Security-Policy: default-src 'none'` headers ([`adminController.ts`](file:///c:/Users/vinod%20dhami/sun-water-resort/backend/src/controllers/adminController.ts#L1270), [`app.ts`](file:///c:/Users/vinod%20dhami/sun-water-resort/backend/src/app.ts#L91)).
- ✅ **CSV Formula Sanitization:** Guest data export prefixes formula trigger characters (`=`, `+`, `-`, `@`) with `'` ([`guestsController.ts`](file:///c:/Users/vinod%20dhami/sun-water-resort/backend/src/controllers/guestsController.ts#L245)).
- ✅ **Duration & Rate Control:** Enforced 30-night maximum stay duration caps and rate-limited public booking lookups ([`publicController.ts`](file:///c:/Users/vinod%20dhami/sun-water-resort/backend/src/controllers/publicController.ts#L212)).

---

## 📁 Project Structure

```
sun-water-resort/
├── docs/                       # Architecture & API specification contracts
├── backend/                    # Express + TypeScript + Prisma API server
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema
│   │   └── dev.db              # SQLite development database
│   ├── src/
│   │   ├── config/             # Environment, Database, Razorpay, Redis
│   │   ├── controllers/        # Admin, Public, Auth, Guests, Webhooks
│   │   ├── middleware/         # Auth, CSRF, Rate Limiting, RBAC, Validation
│   │   ├── rbac/               # 59 permissions & role definitions
│   │   ├── realtime/           # WebSocket server & event broadcasting
│   │   ├── routes/             # Public, Admin, Auth, Webhook routes
│   │   └── services/           # Reservation, Availability, Payment, Token
│   └── tests/                  # Vitest test suite (critical, features, security)
└── frontend/                   # Next.js 14 App Router UI
    ├── src/
    │   ├── app/                # Public pages & Admin pages
    │   ├── components/         # UI components & design system
    │   └── lib/                # API client & helpers
    └── public/                 # Static branding assets
```

---

## 🚀 Quick Start & Installation

### 1. Prerequisites

- Node.js (v18+ or v20+)
- npm or yarn

### 2. Backend Setup

```bash
cd backend
npm install

# Initialize database schema
npx prisma db push

# Seed initial resort data, roles, and admin credentials
npx prisma db seed

# Start development server (listening on port 4000)
npm run dev
```

Seed **does not** use a shared default password. It generates a random temporary password, prints it once with a warning, and rotates any leftover `changeme123` hashes. Change that password in `/admin` immediately after first login. Re-running seed does not overwrite a password that has already been changed.

`/metrics` is Prometheus scrape output. It is **not public**. Set `METRICS_TOKEN` in `backend/.env`. If the token is empty, the route returns 404. Scrapers must send `Authorization: Bearer <token>` or `X-Metrics-Token: <token>`.

### Auth secrets (required before production)

`backend/.env` is gitignored. Never commit it. `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` must be at least 32 characters and **must be unique per environment**. Generate new ones:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Run that twice and set the two values in production. Changing secrets invalidates every existing staff session.

Set `COOKIE_DOMAIN` to your production host (for example `sunandwaterresort.com`). It defaults to `localhost` in development. `COOKIE_SECURE` must be `true` on HTTPS.

### 3. Frontend Setup

```bash
cd frontend
npm install

# Start Next.js development server (listening on port 3000)
npm run dev
```

---

## 🧪 Running Automated Tests

The platform includes 39 comprehensive automated tests across core functionality, critical payment flows, and security regression checks.

To run the complete test suite:

```bash
cd backend
npm test
```

Expected Output:
```
 ✓ tests/critical.test.ts (13 tests)
 ✓ tests/features.test.ts (20 tests)
 ✓ tests/security.test.ts (6 tests)

Test Files  3 passed (3)
     Tests  39 passed (39)
```

To run TypeScript typechecking:

```bash
cd backend
npm run type-check
```

---

## 🛡 Security Policy & Development Rules

1. **Backend is Source of Truth:** Never trust client-submitted prices, availability, or permissions. All values are calculated server-side.
2. **RBAC Rule:** Permission checks MUST evaluate `can('PERMISSION_KEY')` or `requirePermission('KEY')`, never raw role string comparisons.
3. **Monetary Values:** Stored as positive integer paise (e.g., ₹4,500 = `450000`). Floating-point arithmetic is strictly prohibited.
4. **Time & Dates:** Stored in UTC in the database; converted to `Asia/Kolkata` for display.
5. **Tenant Scoping:** All ORM queries MUST include `resortId: req.staff!.resortId` to prevent BOLA vulnerabilities.

