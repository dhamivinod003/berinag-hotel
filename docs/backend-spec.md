# Sun & Water Resort — Backend Specification v2.0

> **v2.0** — consolidated spec. v1 was a pure design exercise; v2 folds in
> the existing Feast-aligned backend pattern (controller → service →
> repository, JWT refresh-sessions, WebSocket, Razorpay, Sentry/Prometheus,
> defense-in-depth security).
>
> **Multi-tenant from day 1.** Every domain table carries `resortId` so the
> system can be re-skinned and re-deployed for additional resorts without
> a refactor.
>
> The backend is the **single source of truth** for both the public
> website and the admin dashboard (frontend spec §72). Every section of
> the frontend spec maps to an endpoint or job here.

---

## Changelog v1 → v2

- Added `Resort` as top-level entity; `resortId` FK on every domain table.
- Renamed `Booking` → `Reservation` (matches existing codebase).
- `ReservationHold` is now a **separate table** with its own lifecycle
  (`ACTIVE` → `EXPIRED | CONVERTED | RELEASED`).
- `RoomMovement` is now a **separate table** for full room-change history.
- Pricing: `room_rates` (date-range base) + `pricing_rules` (weekend /
  seasonal / holiday adjustments) + `offers` (promo discounts).
- `AuditLog` includes `beforeData` / `afterData` JSON snapshots.
- Permission keys: `SCREAMING_SNAKE_CASE` (`BOOKING_CANCEL`).
- CSRF: double-submit cookie + `X-CSRF-Token` header.
- WebSocket auth: short-lived ticket from `POST /auth/ws-ticket`, then
  handshake with `Authorization` header. **No tokens in query strings.**
- Notifications: unified `NotificationDispatcher` over 4 channels
  (IN_APP, EMAIL, WHATSAPP, SMS).
- CMS: `website_settings` (KV), `website_sections` (typed blocks),
  `pages` (long-form), `gallery_images`, `reviews`.
- 12 critical edge-case tests (incl. simultaneous last-room booking).
- Project layout: strict `controller → service → repository` layers.

---

## 0. Design principles

1. **Server-side authority.** The frontend never decides availability,
   pricing, conflicts, or permissions. It asks, the backend decides.
2. **Single inventory model.** Website bookings, walk-ins, phone bookings,
   WhatsApp conversions, and extensions all read/write the same tables.
3. **State machines, not free-form status.** Reservations and rooms move
   through explicit states. Invalid transitions are rejected with
   `409 Conflict`.
4. **Permission keys, not role checks.** Code checks `can('BOOKING_CANCEL')`,
   never `if (role === 'Manager')`.
5. **Holds are time-bounded, not promises.** A hold is a row with
   `expiresAt` that the system can revoke.
6. **Money is integer paise.** No floats. `Intl.NumberFormat` for display.
7. **All timestamps UTC in DB; render in `Asia/Kolkata`.**
8. **Soft-delete by `deletedAt`** for guest-facing content (offers,
   gallery, reviews) so the admin can recover and audit.
9. **Defense in depth.** Nginx → CORS → Helmet → rate-limit → auth →
   permission → Zod → service → repository → DB. Each layer is
   independently testable.
10. **Multi-tenant scoping is a middleware, not a developer habit.** A
    `withResortScope()` clause automatically injects `resortId` filters
    on every query.

---

## 1. Tech stack

| Layer            | Choice                                    | Why                                                                 |
| ---------------- | ----------------------------------------- | ------------------------------------------------------------------- |
| Runtime          | Node.js 20 LTS                            | Already in Feast & Shopure                                          |
| Module system    | ESM (`"type": "module"`)                  | Matches existing backend                                            |
| Language         | TypeScript 5.x (`strict: true`)           | Type safety across modules                                          |
| Framework        | Express 4                                 | Battle-tested, plays well with WebSocket                           |
| Dev runner       | `tsx` (watch mode)                        | Fast TS execution                                                  |
| Database (dev)   | **SQLite** (better-sqlite3)               | Zero-config local dev                                               |
| Database (prod)  | **PostgreSQL 16**                         | Transactions, JSONB, advisory locks, `FOR UPDATE`                  |
| ORM              | **Prisma 5** with `provider` switch       | Single schema, type-safe, both DBs supported                       |
| Realtime         | `ws` (lightweight) + `eventEmitter`       | Matches existing backend; rooms/namespaces per event class          |
| Payments         | Razorpay                                  | UPI/cards/netbanking/refunds; webhook support                      |
| Validation       | Zod                                       | Schemas drive types + runtime validation                            |
| Auth             | JWT (access 15m) + refresh sessions       | Stateless access; revocable refresh; cookie + body                 |
| Password hashing | bcryptjs (cost 12)                        | Existing standard                                                   |
| Email            | Nodemailer + SMTP                         | Templates, attachments                                              |
| WhatsApp         | Meta Cloud API (or Wati)                  | Enquiry intake + outbound notifications                             |
| SMS              | MSG91 / Twilio (pluggable)                | Optional in v1; slot in via `NotificationDispatcher`               |
| Cache            | In-app LRU + Redis (optional prod)        | Static CMS, public resort info; **never cache availability**        |
| Logging          | Pino (structured JSON)                    | Fast, low-allocation                                                |
| Error tracking   | Sentry                                    | Exception capture                                                   |
| Metrics          | Prometheus                                | `/metrics` endpoint                                                 |
| API docs         | Swagger / OpenAPI                         | Auto-generated from Zod schemas                                     |
| Testing          | Vitest + Supertest + Playwright + k6      | Unit, integration, e2e, load                                        |
| Deployment       | Docker Compose + nginx reverse proxy      | Same as existing backend                                            |

> **Why both SQLite (dev) and Postgres (prod):** Prisma's provider switch
> lets us iterate locally with zero setup, while the prod DB still has
> full SQL power. The schema must avoid Postgres-only features when
> SQLite is the dev target (no `FOR UPDATE SKIP LOCKED` etc.), but our
> availability engine uses `BEGIN IMMEDIATE` (SQLite) and
> `SELECT ... FOR UPDATE` (Postgres) via an abstraction layer.

---

## 2. High-level architecture

```
                    ┌──────────────────────────┐
                    │  Public Frontend (React) │
                    │  /api/public/*           │
                    └────────────┬─────────────┘
                                 │  HTTPS · Bearer token
                                 │
┌──────────────────┐   ┌─────────▼────────────┐   ┌────────────────────┐
│ Admin Dashboard  │◄─►│   Express API (TS)   │◄─►│  Database          │
│ /api/admin/*     │   │  controller→service  │   │  (SQLite/Postgres) │
│ WebSocket        │   │       →repository    │   └─────────┬──────────┘
└────────┬─────────┘   │                     │             │
         │             │   ┌──────────────┐  │             │
         │             │   │   EventBus   │  │             │
         │             │   │   (Redis /   │  │             │
         │             │   │   in-proc)   │◄─┼─────────────┘
         │             │   └──────┬───────┘  │
         │             │          │          │
         │             │   ┌──────▼──────┐   │
         └─────────────┼──►│  WebSocket  │   │
                       │   │   Server    │   │
                       │   └─────────────┘   │
                       │                     │
                       │   Razorpay          │
                       │   Sentry            │
                       │   Prometheus        │
                       │   Nodemailer SMTP   │
                       │   Meta WhatsApp     │
                       │   MSG91 SMS         │
                       └─────────────────────┘
```

---

## 3. Project structure

```
backend/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── config/
│   │   ├── env.ts                  # validated via Zod
│   │   ├── database.ts             # Prisma client + adapter
│   │   ├── securityFlags.ts        # feature flags for prod hardening
│   │   ├── cookieOptions.ts        # refresh cookie attrs
│   │   └── paymentConfig.ts        # razorpay keys
│   ├── controllers/                # HTTP edge — req/res → service
│   ├── services/                   # business logic
│   ├── repositories/               # DB access; Prisma queries
│   ├── middleware/
│   │   ├── requireAuth.ts
│   │   ├── requirePermission.ts
│   │   ├── withResortScope.ts
│   │   ├── validate.ts             # Zod
│   │   ├── csrf.ts                 # double-submit
│   │   ├── rateLimit.ts
│   │   ├── audit.ts
│   │   ├── errorHandler.ts
│   │   └── requestId.ts
│   ├── routes/
│   │   ├── authRoutes.ts
│   │   ├── publicRoutes.ts
│   │   ├── availabilityRoutes.ts
│   │   ├── bookingRoutes.ts
│   │   ├── paymentRoutes.ts
│   │   ├── webhookRoutes.ts
│   │   └── adminRoutes.ts
│   ├── realtime/
│   │   ├── websocketServer.ts
│   │   ├── eventEmitter.ts
│   │   └── events.ts               # event type union
│   ├── db/
│   │   ├── db.ts
│   │   ├── migrations/
│   │   └── seeds/
│   ├── notifications/
│   │   ├── dispatcher.ts           # fan out to channels
│   │   ├── channels/
│   │   │   ├── inApp.ts
│   │   │   ├── email.ts
│   │   │   ├── whatsapp.ts
│   │   │   └── sms.ts
│   │   └── templates/
│   ├── jobs/
│   │   ├── holdExpiry.ts           # BullMQ
│   │   ├── emailOutbound.ts
│   │   ├── checkinReminder.ts
│   │   └── reportExport.ts
│   ├── utils/
│   │   ├── logger.ts
│   │   ├── errors.ts               # AppError taxonomy
│   │   ├── metrics.ts              # Prometheus
│   │   ├── dates.ts
│   │   ├── money.ts                # paise helpers
│   │   ├── pagination.ts
│   │   └── lock.ts                 # DB-level lock helper
│   ├── rbac/
│   │   ├── permissions.ts          # permission key list
│   │   ├── roles.ts                # default role templates
│   │   └── can.ts                  # can(staff, key) helper
│   └── app.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── load/
├── Dockerfile
├── docker-compose.yml
└── nginx/
    └── sunandwater.conf
```

Layer rules (enforced by ESLint rules + code review):
- Controllers may call services and return JSON. **No Prisma here.**
- Services may call repositories and other services. **No `req`/`res` here.**
- Repositories are the only layer that touches Prisma.
- Middleware (auth, validation, permission) runs in routes.

---

## 4. Database schema (Prisma)

> Naming: `snake_case` in DB, `camelCase` in TS. Use `@map` + `@@map`.
> Every domain table carries `resortId` for multi-tenant scoping.

```prisma
generator client { provider = "prisma-client-js" }

datasource db {
  provider = "sqlite"      // dev default; "postgresql" in prod
  url      = env("DATABASE_URL")
}

// ─── Tenancy ───────────────────────────────────────────────────────

model Resort {
  id              String   @id @default(cuid())
  slug            String   @unique   // 'sun-and-water'
  name            String              // 'Sun & Water Resort'
  description     String?
  logoUrl         String?
  heroImageUrl    String?
  phone           String
  whatsapp        String?
  email           String
  address         String
  city            String
  state           String
  country         String
  latitude        Float?
  longitude       Float?
  checkInTime     String   @default("14:00")
  checkOutTime    String   @default("11:00")
  timezone        String   @default("Asia/Kolkata")
  currency        String   @default("INR")
  status          ResortStatus @default(ACTIVE)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // relations
  staff           Staff[]
  guests          Guest[]
  roomTypes       RoomType[]
  rooms           Room[]
  reservations    Reservation[]
  holds           ReservationHold[]
  movements       RoomMovement[]
  payments        Payment[]
  extensions      ExtensionRequest[]
  enquiries       Enquiry[]
  offers          Offer[]
  roomRates       RoomRate[]
  pricingRules    PricingRule[]
  ratePlans       RatePlan[]
  housekeepingTasks HousekeepingTask[]
  maintenanceRecords MaintenanceRecord[]
  galleryImages   GalleryImage[]
  reviews         Review[]
  attractions     NearbyAttraction[]
  amenitySections AmenitySection[]
  pages           Page[]
  websiteSections WebsiteSection[]
  settings        WebsiteSetting[]
  auditLogs       AuditLog[]
  notifications   Notification[]
  roomMovements   RoomMovement[]

  @@index([slug, status])
}

enum ResortStatus { ACTIVE PAUSED CLOSED }

// ─── Identity & access ──────────────────────────────────────────────

model Staff {
  id              String     @id @default(cuid())
  resortId        String
  resort          Resort     @relation(fields: [resortId], references: [id], onDelete: Cascade)
  email           String
  passwordHash    String
  name            String
  phone           String?
  roleKey         String                 // 'OWNER' | 'MANAGER' | ...
  status          StaffStatus @default(ACTIVE)
  lastLoginAt     DateTime?
  failedLoginCount Int       @default(0)
  lockedUntil     DateTime?
  emailVerifiedAt DateTime?
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
  deletedAt       DateTime?

  sessions        StaffSession[]
  passwordResets  PasswordReset[]
  auditLogs       AuditLog[]
  assignedHkTasks HousekeepingTask[] @relation("HkAssignee")
  reportedMaint   MaintenanceRecord[]  @relation("MaintReporter")
  assignedMaint   MaintenanceRecord[]  @relation("MaintAssignee")
  createdReservations Reservation[]   @relation("ReservationCreator")
  cancelledReservations Reservation[] @relation("ReservationCanceller")
  enquiryAssignments Enquiry[]        @relation("EnquiryAssignee")
  bookingNotes    BookingNote[]

  @@unique([resortId, email])
  @@index([resortId, roleKey, status])
}

enum StaffStatus { ACTIVE SUSPENDED INACTIVE }

model StaffSession {
  id                String   @id @default(cuid())
  resortId          String
  staffId           String
  staff             Staff    @relation(fields: [staffId], references: [id], onDelete: Cascade)
  refreshTokenHash  String   @unique
  userAgent         String?
  ip                String?
  expiresAt         DateTime
  revokedAt         DateTime?
  createdAt         DateTime @default(now())
  rotatedFromId     String?  // chain of rotations; reuse → revoke family

  @@index([staffId, expiresAt])
  @@index([resortId, staffId])
}

model PasswordReset {
  id          String   @id @default(cuid())
  staffId     String
  staff       Staff    @relation(fields: [staffId], references: [id], onDelete: Cascade)
  tokenHash   String   @unique
  expiresAt   DateTime
  usedAt      DateTime?
  createdAt   DateTime @default(now())
}

model EmailVerification {
  id          String   @id @default(cuid())
  staffId     String
  tokenHash   String   @unique
  expiresAt   DateTime
  usedAt      DateTime?
  createdAt   DateTime @default(now())
}

// ─── Public customers ───────────────────────────────────────────────

model Guest {
  id            String   @id @default(cuid())
  resortId      String
  resort        Resort   @relation(fields: [resortId], references: [id], onDelete: Cascade)
  fullName      String
  email         String?
  phone         String
  countryCode   String   @default("+91")
  address       String?
  idType        String?
  idNumber      String?
  notes         String?  // staff-only
  preferences   Json?    // { roomView, dietary, pillow, ... }
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  reservations  Reservation[]

  @@unique([resortId, phone, countryCode])
  @@index([resortId, email])
  @@index([resortId, fullName])
}

// ─── Rooms & inventory ──────────────────────────────────────────────

model RoomType {
  id              String   @id @default(cuid())
  resortId        String
  resort          Resort   @relation(fields: [resortId], references: [id], onDelete: Cascade)
  slug            String
  name            String
  description     String?
  shortDesc       String?
  maxAdults       Int
  maxChildren     Int      @default(0)
  maxOccupancy    Int                   // maxAdults + maxChildren
  bedConfiguration String?              // '1 King' | '2 Double' | ...
  areaSqft        Int?
  view            String?               // 'garden' | 'mountain' | 'pool'
  basePrice       Int                   // paise; default rate when no RoomRate matches
  totalUnits      Int                   // bookable inventory count
  status          RoomTypeStatus @default(ACTIVE)
  displayOrder    Int      @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?

  amenities       RoomTypeAmenity[]
  photos          RoomTypePhoto[]
  rooms           Room[]
  rates           RoomRate[]
  offerRoomTypes  OfferRoomType[]
  holdLines       ReservationHold[]
  reservationLines Reservation[]

  @@unique([resortId, slug])
  @@index([resortId, status, displayOrder])
}

enum RoomTypeStatus { ACTIVE ARCHIVED }

model Room {
  id              String   @id @default(cuid())
  resortId        String
  resort          Resort   @relation(fields: [resortId], references: [id], onDelete: Cascade)
  roomTypeId      String
  roomType        RoomType @relation(fields: [roomTypeId], references: [id], onDelete: Restrict)
  roomNumber      String
  floor           String?
  building        String?
  status          RoomStatus @default(READY)
  notes           String?
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  photos          RoomPhoto[]
  housekeepingTasks HousekeepingTask[]
  maintenanceRecords MaintenanceRecord[]
  movementsFrom   RoomMovement[] @relation("FromRoom")
  movementsTo     RoomMovement[] @relation("ToRoom")
  assignments     RoomAssignment[]
  reservationMovements ReservationMovement[]

  @@unique([resortId, roomNumber])
  @@index([resortId, roomTypeId, status])
}

enum RoomStatus {
  READY          // clean and bookable
  OCCUPIED       // guest in the room
  CLEANING       // housekeeper in progress
  MAINTENANCE    // active maintenance
  OUT_OF_ORDER   // excluded from bookable inventory
}

model RoomAssignment {
  id           String   @id @default(cuid())
  resortId     String
  reservationId String
  reservation  Reservation @relation(fields: [reservationId], references: [id], onDelete: Cascade)
  roomId       String
  room         Room     @relation(fields: [roomId], references: [id])
  assignedAt   DateTime @default(now())
  assignedById String?
  releasedAt   DateTime?
  releaseReason String?

  @@index([reservationId])
  @@index([roomId, releasedAt])
}

model RoomMovement {
  id            String   @id @default(cuid())
  resortId      String
  reservationId String
  reservation   Reservation @relation(fields: [reservationId], references: [id], onDelete: Cascade)
  fromRoomId    String
  fromRoom      Room     @relation("FromRoom", fields: [fromRoomId], references: [id])
  toRoomId      String
  toRoom        Room     @relation("ToRoom", fields: [toRoomId], references: [id])
  reason        String                // 'guest_request' | 'maintenance' | 'upgrade' | 'ops'
  performedById String
  performedAt   DateTime @default(now())
  notes         String?

  @@index([reservationId])
}

model Amenity {
  id        String  @id @default(cuid())
  key       String  @unique             // 'wifi' | 'pool' | 'ac'
  name      String
  icon      String?                     // lucide icon name
  category  String?
  roomTypes RoomTypeAmenity[]
}

model RoomTypeAmenity {
  roomTypeId String
  amenityId  String
  roomType   RoomType @relation(fields: [roomTypeId], references: [id], onDelete: Cascade)
  amenity    Amenity  @relation(fields: [amenityId], references: [id], onDelete: Cascade)

  @@id([roomTypeId, amenityId])
}

model RoomTypePhoto {
  id           String   @id @default(cuid())
  resortId     String
  roomTypeId   String
  roomType     RoomType @relation(fields: [roomTypeId], references: [id], onDelete: Cascade)
  url          String
  publicId     String
  alt          String?
  isCover      Boolean  @default(false)
  displayOrder Int      @default(0)

  @@index([roomTypeId, displayOrder])
}

model RoomPhoto {
  id           String   @id @default(cuid())
  resortId     String
  roomId       String
  room         Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
  url          String
  publicId     String
  alt          String?
  isCover      Boolean  @default(false)
  displayOrder Int      @default(0)

  @@index([roomId, displayOrder])
}

// ─── Pricing ────────────────────────────────────────────────────────

model RoomRate {
  id          String   @id @default(cuid())
  resortId    String
  resort      Resort   @relation(fields: [resortId], references: [id], onDelete: Cascade)
  roomTypeId  String
  roomType    RoomType @relation(fields: [roomTypeId], references: [id], onDelete: Cascade)
  startDate   DateTime
  endDate     DateTime
  rate        Int                       // paise
  ratePlanKey String?                   // optional: 'STANDARD' | 'NON_REFUNDABLE' | ...
  minNights   Int?
  maxNights   Int?
  priority    Int      @default(0)
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())

  @@index([resortId, roomTypeId, startDate, endDate, active, priority])
}

model PricingRule {
  id              String   @id @default(cuid())
  resortId        String
  resort          Resort   @relation(fields: [resortId], references: [id], onDelete: Cascade)
  roomTypeId      String?               // null = applies to all
  kind            PricingRuleKind
  daysOfWeek      Int?                  // JSON array as string: "[5,6]" for WEEKEND
  startDate       DateTime?
  endDate         DateTime?
  adjustmentType  AdjustmentType
  adjustmentValue Int                   // percent (basis points: 1500 = 15%) or paise
  minNights       Int?
  maxNights       Int?
  priority        Int      @default(0)
  active          Boolean  @default(true)

  @@index([resortId, active, priority])
}

enum PricingRuleKind { WEEKEND SEASONAL HOLIDAY LAST_MINUTE }
enum AdjustmentType { PERCENT FLAT }

model RatePlan {
  id                String   @id @default(cuid())
  resortId          String
  resort            Resort   @relation(fields: [resortId], references: [id], onDelete: Cascade)
  key               String
  name              String
  description       String?
  adjustmentType    AdjustmentType
  adjustmentValue   Int
  minNights         Int?
  nonRefundable     Boolean  @default(false)
  includesBreakfast Boolean  @default(false)
  active            Boolean  @default(true)
  displayOrder      Int      @default(0)

  @@unique([resortId, key])
}

model Offer {
  id            String   @id @default(cuid())
  resortId      String
  resort        Resort   @relation(fields: [resortId], references: [id], onDelete: Cascade)
  slug          String
  name          String
  description   String
  shortDesc     String?
  imageUrl      String?
  discountType  AdjustmentType
  discountValue Int
  minNights     Int?
  promoCode     String?  @unique
  startDate     DateTime
  endDate       DateTime
  terms         String?
  status        OfferStatus @default(DRAFT)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  deletedAt     DateTime?

  roomTypes     OfferRoomType[]
  reservations  Reservation[]

  @@unique([resortId, slug])
  @@index([resortId, status, startDate, endDate])
}

enum OfferStatus { DRAFT PUBLISHED PAUSED EXPIRED }

model OfferRoomType {
  offerId    String
  roomTypeId String
  offer      Offer    @relation(fields: [offerId], references: [id], onDelete: Cascade)
  roomType   RoomType @relation(fields: [roomTypeId], references: [id], onDelete: Cascade)

  @@id([offerId, roomTypeId])
}

// ─── Reservations ───────────────────────────────────────────────────

enum ReservationStatus {
  PENDING            // enquiry flow, awaiting staff approval
  HELD               // inventory temporarily reserved, awaiting payment
  CONFIRMED          // payment cleared OR manually confirmed
  CHECKED_IN
  CHECKED_OUT
  CANCELLED
  NO_SHOW
  EXPIRED            // hold lapsed without payment
}

enum ReservationSource {
  WEBSITE
  WALK_IN
  PHONE
  WHATSAPP
  ADMIN
  OTA
}

model Reservation {
  id                String   @id @default(cuid())
  resortId          String
  resort            Resort   @relation(fields: [resortId], references: [id], onDelete: Cascade)
  bookingReference  String                    // #BK1048, human-friendly
  guestId           String
  guest             Guest    @relation(fields: [guestId], references: [id])
  roomTypeId        String
  roomType          RoomType @relation(fields: [roomTypeId], references: [id])

  checkIn           DateTime                  // 00:00 resort TZ
  checkOut          DateTime
  nights            Int
  adults            Int
  children          Int      @default(0)
  roomCount         Int      @default(1)

  status            ReservationStatus
  source            ReservationSource

  // money (paise)
  nightlyRate       Int
  subtotal          Int
  discount          Int      @default(0)
  taxAmount         Int      @default(0)
  totalAmount       Int
  amountPaid        Int      @default(0)
  amountDue         Int      @default(0)
  currency          String   @default("INR")

  offerId           String?
  offer             Offer?   @relation(fields: [offerId], references: [id])
  promoCode         String?

  specialRequests   String?
  arrivalTime       String?
  internalNotes     String?

  holdExpiresAt     DateTime?
  confirmedAt       DateTime?
  checkedInAt       DateTime?
  checkedOutAt      DateTime?
  cancelledAt       DateTime?
  cancelledById     String?
  cancellationReason String?
  noShowAt          DateTime?

  createdById       String?
  createdBy         Staff?   @relation("ReservationCreator", fields: [createdById], references: [id])
  cancelledBy       Staff?   @relation("ReservationCanceller", fields: [cancelledById], references: [id])

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  assignments       RoomAssignment[]
  movements         RoomMovement[]
  reservationMovements ReservationMovement[]
  payments          Payment[]
  extensions        ExtensionRequest[]
  events            ReservationEvent[]
  notes             BookingNote[]

  @@unique([resortId, bookingReference])
  @@index([resortId, status, checkIn])
  @@index([resortId, checkIn, checkOut])
  @@index([resortId, guestId])
  @@index([resortId, source])
}

model ReservationHold {
  id            String   @id @default(cuid())
  resortId      String
  resort        Resort   @relation(fields: [resortId], references: [id], onDelete: Cascade)
  roomTypeId    String
  roomType      RoomType @relation(fields: [roomTypeId], references: [id])
  quantity      Int                       // roomsCount
  checkIn       DateTime
  checkOut      DateTime
  sessionId     String                    // guest's session
  status        HoldStatus @default(ACTIVE)
  expiresAt     DateTime
  createdAt     DateTime @default(now())
  convertedReservationId String?
  releasedAt    DateTime?
  releaseReason String?

  @@index([resortId, status, expiresAt])
  @@index([resortId, roomTypeId, status])
  @@index([sessionId])
}

enum HoldStatus { ACTIVE EXPIRED CONVERTED RELEASED }

model ReservationEvent {
  id            String   @id @default(cuid())
  resortId      String
  reservationId String
  reservation   Reservation @relation(fields: [reservationId], references: [id], onDelete: Cascade)
  type          String                    // 'created' | 'confirmed' | 'cancelled' | 'room_assigned' | 'extended' | 'moved' | ...
  payload       Json?
  actorType     String                    // 'guest' | 'staff' | 'system'
  actorId       String?
  createdAt     DateTime @default(now())

  @@index([reservationId, createdAt])
}

model ReservationMovement {
  // separate from RoomMovement for direct room→reservation audit
  id            String   @id @default(cuid())
  resortId      String
  reservationId String
  reservation   Reservation @relation(fields: [reservationId], references: [id], onDelete: Cascade)
  fromRoomId    String
  fromRoom      Room     @relation(fields: [fromRoomId], references: [id])
  toRoomId      String
  toRoom        Room     @relation(fields: [toRoomId], references: [id])
  reason        String
  performedById String
  performedAt   DateTime @default(now())

  @@index([reservationId])
}

model BookingNote {
  id            String   @id @default(cuid())
  resortId      String
  reservationId String
  reservation   Reservation @relation(fields: [reservationId], references: [id], onDelete: Cascade)
  authorId      String
  author        Staff    @relation(fields: [authorId], references: [id])
  body          String
  createdAt     DateTime @default(now())
}

model ExtensionRequest {
  id              String   @id @default(cuid())
  resortId        String
  resort          Resort   @relation(fields: [resortId], references: [id], onDelete: Cascade)
  reservationId   String
  reservation     Reservation @relation(fields: [reservationId], references: [id], onDelete: Cascade)
  currentCheckOut DateTime
  requestedCheckOut DateTime
  decision        ExtensionDecision?  // null = pending
  decisionById    String?
  decisionAt      DateTime?
  decisionNote    String?
  additionalAmount Int?
  createdAt       DateTime @default(now())

  @@index([reservationId])
}

enum ExtensionDecision { APPROVED REJECTED }

// ─── Payments ───────────────────────────────────────────────────────

model Payment {
  id                  String   @id @default(cuid())
  resortId            String
  resort              Resort   @relation(fields: [resortId], references: [id], onDelete: Cascade)
  reservationId       String
  reservation         Reservation @relation(fields: [reservationId], references: [id], onDelete: Cascade)
  amount              Int                       // paise, can be negative for refund
  currency            String   @default("INR")
  method              PaymentMethod
  status              PaymentStatus
  provider            String?                  // 'razorpay' | 'manual'
  providerOrderId     String?
  providerPaymentId   String?
  providerSignature   String?
  reference           String?                  // UPI ref, cheque no, txn id
  notes               String?
  recordedById        String?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([resortId, reservationId, status])
  @@unique([provider, providerPaymentId])    // webhook idempotency
}

enum PaymentMethod { RAZORPAY UPI CASH BANK_TRANSFER CHEQUE CARD OTHER REFUND }
enum PaymentStatus { CREATED AUTHORIZED CAPTURED FAILED REFUNDED PARTIALLY_REFUNDED }

// ─── Enquiries ──────────────────────────────────────────────────────

model Enquiry {
  id                String   @id @default(cuid())
  resortId          String
  resort            Resort   @relation(fields: [resortId], references: [id], onDelete: Cascade)
  name              String
  phone             String
  email             String?
  requestedCheckIn  DateTime?
  requestedCheckOut DateTime?
  adults            Int?
  children          Int?
  roomTypeId        String?
  message           String?
  source            EnquirySource
  status            EnquiryStatus @default(NEW)
  assignedToId      String?
  assignedTo        Staff?   @relation("EnquiryAssignee", fields: [assignedToId], references: [id])
  convertedReservationId String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  notes             EnquiryNote[]

  @@index([resortId, status, createdAt])
}

enum EnquiryStatus { NEW CONTACTED AWAITING_RESPONSE CONVERTED LOST SPAM }
enum EnquirySource { WEBSITE_FORM WHATSAPP PHONE WALK_IN OTHER }

model EnquiryNote {
  id          String   @id @default(cuid())
  resortId    String
  enquiryId   String
  enquiry     Enquiry  @relation(fields: [enquiryId], references: [id], onDelete: Cascade)
  authorId    String
  body        String
  createdAt   DateTime @default(now())
}

// ─── Housekeeping & maintenance ─────────────────────────────────────

model HousekeepingTask {
  id           String   @id @default(cuid())
  resortId     String
  resort       Resort   @relation(fields: [resortId], references: [id], onDelete: Cascade)
  roomId       String
  room         Room     @relation(fields: [roomId], references: [id])
  type         HkTaskType
  status       HkStatus @default(PENDING)
  priority     HkPriority @default(NORMAL)
  reservationId String?
  notes        String?
  assignedToId String?
  assignedTo   Staff?   @relation("HkAssignee", fields: [assignedToId], references: [id])
  startedAt    DateTime?
  completedAt  DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([resortId, status, priority])
  @@index([roomId, status])
}

enum HkTaskType { CHECKOUT_CLEAN TURN_DOWN DEEP_CLEAN INSPECTION TOUCH_UP }
enum HkStatus { PENDING IN_PROGRESS COMPLETED BLOCKED SKIPPED }
enum HkPriority { LOW NORMAL HIGH URGENT }

model MaintenanceRecord {
  id              String   @id @default(cuid())
  resortId        String
  resort          Resort   @relation(fields: [resortId], references: [id], onDelete: Cascade)
  roomId          String
  room            Room     @relation(fields: [roomId], references: [id])
  issue           String                    // 'plumbing' | 'electrical' | 'ac' | ...
  description     String?
  priority        HkPriority @default(NORMAL)
  status          MaintenanceStatus @default(OPEN)
  reportedById    String
  reportedBy      Staff    @relation("MaintReporter", fields: [reportedById], references: [id])
  assignedToId    String?
  assignedTo      Staff?   @relation("MaintAssignee", fields: [assignedToId], references: [id])
  startedAt       DateTime?
  resolvedAt      DateTime?
  expectedReadyAt DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

enum MaintenanceStatus { OPEN IN_PROGRESS RESOLVED CANCELLED }

// ─── CMS / website content ──────────────────────────────────────────

model WebsiteSetting {
  id        String   @id @default(cuid())
  resortId  String
  resort    Resort   @relation(fields: [resortId], references: [id], onDelete: Cascade)
  key       String
  value     Json
  updatedAt DateTime @updatedAt
  updatedById String?

  @@unique([resortId, key])
}

model WebsiteSection {
  id         String   @id @default(cuid())
  resortId   String
  resort     Resort   @relation(fields: [resortId], references: [id], onDelete: Cascade)
  key        String                       // 'hero' | 'contact' | 'footer' | 'about' | ...
  title      String?
  content    Json                         // section-typed payload
  order      Int      @default(0)
  active     Boolean  @default(true)
  updatedAt  DateTime @updatedAt
  updatedById String?

  @@unique([resortId, key])
}

model Page {
  id          String   @id @default(cuid())
  resortId    String
  resort      Resort   @relation(fields: [resortId], references: [id], onDelete: Cascade)
  slug        String
  title       String
  body        Json                         // { sections: [...] }
  seoTitle    String?
  seoDesc     String?
  ogImage     String?
  published   Boolean  @default(true)
  updatedAt   DateTime @updatedAt
  updatedById String?

  @@unique([resortId, slug])
}

model GalleryCategory {
  id       String  @id @default(cuid())
  resortId String
  slug     String
  name     String
  order    Int     @default(0)
  images   GalleryImage[]

  @@unique([resortId, slug])
}

model GalleryImage {
  id           String   @id @default(cuid())
  resortId     String
  resort       Resort   @relation(fields: [resortId], references: [id], onDelete: Cascade)
  categoryId   String
  category     GalleryCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  url          String
  publicId     String
  alt          String?
  caption      String?
  displayOrder Int      @default(0)
  isFeatured   Boolean  @default(false)
  hidden       Boolean  @default(false)
  createdAt    DateTime @default(now())

  @@index([resortId, categoryId, displayOrder])
}

model Review {
  id         String   @id @default(cuid())
  resortId   String
  resort     Resort   @relation(fields: [resortId], references: [id], onDelete: Cascade)
  source     ReviewSource
  sourceUrl  String?                       // Google review URL etc.
  authorName String
  authorAvatar String?
  rating     Int                            // 1..5
  content    String
  reviewDate DateTime?
  isFeatured Boolean  @default(false)
  status     ReviewStatus @default(DRAFT)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([resortId, status, isFeatured, reviewDate])
}

enum ReviewSource { GOOGLE DIRECT WEBSITE TRIPADVISOR BOOKING_COM OTHER }
enum ReviewStatus { DRAFT PUBLISHED HIDDEN }

model NearbyAttraction {
  id          String   @id @default(cuid())
  resortId    String
  resort      Resort   @relation(fields: [resortId], references: [id], onDelete: Cascade)
  name        String
  description String?
  imageUrl    String?
  distanceKm  Float?                       // <-- admin-configured, never invented
  travelTime  String?                       // "2h drive"
  category    String?                       // 'scenic' | 'trek' | 'religious'
  mapUrl      String?
  order       Int      @default(0)
  active      Boolean  @default(true)
}

model AmenitySection {
  id            String   @id @default(cuid())
  resortId      String
  resort        Resort   @relation(fields: [resortId], references: [id], onDelete: Cascade)
  key           String
  title         String
  body          String
  icon          String?
  imageUrl      String?
  imagePublicId String?
  order         Int      @default(0)
  active        Boolean  @default(true)

  @@unique([resortId, key])
}

// ─── Audit & notifications ──────────────────────────────────────────

model AuditLog {
  id          String   @id @default(cuid())
  resortId    String
  resort      Resort   @relation(fields: [resortId], references: [id], onDelete: Cascade)
  actorType   String                        // 'staff' | 'guest' | 'system'
  actorId     String?
  staff       Staff?   @relation(fields: [actorId], references: [id])
  action      String                        // 'BOOKING_CONFIRM' | 'ROOM_PRICE_UPDATE' | ...
  entity      String?                       // 'reservation' | 'room_type' | ...
  entityId    String?
  beforeData  Json?
  afterData   Json?
  ip          String?
  userAgent   String?
  createdAt   DateTime @default(now())

  @@index([resortId, entity, entityId, createdAt])
  @@index([resortId, actorId, createdAt])
  @@index([resortId, action, createdAt])
}

model Notification {
  id        String   @id @default(cuid())
  resortId  String
  resort    Resort   @relation(fields: [resortId], references: [id], onDelete: Cascade)
  audience  String                          // 'OWNER' | 'role:RECEPTION' | 'staff:<id>'
  type      String                          // 'NEW_BOOKING' | 'NEW_ENQUIRY' | ...
  channel   NotificationChannel
  title     String
  body      String?
  link      String?
  readAt    DateTime?
  sentAt    DateTime?
  failedAt  DateTime?
  failureReason String?
  createdAt DateTime @default(now())

  @@index([resortId, audience, readAt, createdAt])
  @@index([resortId, type, createdAt])
}

enum NotificationChannel { IN_APP EMAIL WHATSAPP SMS }
```

> SQLite notes: enums are stored as strings, `Json` as TEXT.
> Postgres prod: enums become native, `Json` becomes JSONB, indexes gain
> GIN support for `Json` queries on `beforeData`/`afterData`.

---

## 5. Core services

Each service is a class or module with explicit dependencies, no global state.

```
services/
├── authService.ts                # login, refresh, logout, password reset
├── tokenService.ts               # JWT issue + verify, refresh rotation
├── availabilityService.ts        # §6 — the heart
├── reservationService.ts         # §7 — lifecycle
├── reservationHoldService.ts      # §7.3 — soft holds
├── roomAssignmentService.ts      # assign / move physical room
├── extensionService.ts           # §7.5 — extension flow
├── checkInOutService.ts          # §7.6 / §7.7
├── paymentService.ts             # Razorpay + manual + refunds
├── guestService.ts
├── enquiryService.ts
├── pricingService.ts             # base + rules + offers
├── offerService.ts
├── housekeepingService.ts        # task board, auto-create on checkout
├── maintenanceService.ts         # OOO rooms, expected ready
├── staffService.ts
├── rbacService.ts
├── contentService.ts             # CMS
├── galleryService.ts
├── reviewService.ts
├── nearbyService.ts
├── notificationService.ts        # dispatcher facade
├── reportService.ts
├── auditService.ts               # wraps audit log writes
└── metricsService.ts
```

Each service exposes a small surface; cross-cutting concerns (audit,
notification, metrics) are wrapped via decorators or higher-order
functions in `utils/`.

---

## 6. Availability engine

Two questions, two queries.

### 6.1 "How many of room type X are available for [checkIn, checkOut)?"

```sql
-- conceptually (Prisma generates this; abstracted via availabilityService)
WITH params AS (SELECT $1::date AS ci, $2::date AS co),
held AS (
  SELECT room_type_id, COUNT(*) AS n
  FROM reservations
  WHERE resort_id = $3
    AND status IN ('HELD','PENDING','CONFIRMED','CHECKED_IN')
    AND check_in  < (SELECT co FROM params)
    AND check_out > (SELECT ci FROM params)
    AND check_in  <> (SELECT co FROM params)        -- half-open safety
  GROUP BY room_type_id
),
total AS (
  SELECT id AS room_type_id, total_units AS n
  FROM room_types
  WHERE resort_id = $3
    AND status = 'ACTIVE'
    AND deleted_at IS NULL
),
oo AS (
  -- rooms currently out-of-order for any night in range
  SELECT r.room_type_id, COUNT(*) AS n
  FROM rooms r
  JOIN maintenance_records m ON m.room_id = r.id AND m.status IN ('OPEN','IN_PROGRESS')
  WHERE r.resort_id = $3
    AND r.is_active = true
    AND r.status = 'OUT_OF_ORDER'
    AND (m.expected_ready_at IS NULL OR m.expected_ready_at > (SELECT ci FROM params))
    AND m.resolved_at IS NULL
  GROUP BY r.room_type_id
)
SELECT t.room_type_id,
       t.n - COALESCE(h.n, 0) - COALESCE(o.n, 0) AS available
FROM total t
LEFT JOIN held h ON h.room_type_id = t.room_type_id
LEFT JOIN oo   o ON o.room_type_id = t.room_type_id;
```

**Rules:**

- Date ranges are **half-open** `[checkIn, checkOut)` — a guest checking
  out Aug 18 does not block a guest checking in Aug 18.
- `HELD`, `PENDING`, `CONFIRMED`, `CHECKED_IN` reservations all count.
- `CANCELLED`, `EXPIRED`, `NO_SHOW` (after cutoff) do not count.
- `OUT_OF_ORDER` rooms are subtracted via the `oo` CTE.
- `MAINTENANCE` rooms (not OOO) are still bookable.
- All writes that mutate inventory run inside a transaction with
  `BEGIN IMMEDIATE` (SQLite) or `SERIALIZABLE` (Postgres).

### 6.2 "Can a specific physical room be assigned?"

```sql
SELECT 1
FROM rooms r
WHERE r.resort_id = $1
  AND r.id = $2
  AND r.is_active = true
  AND r.status NOT IN ('OUT_OF_ORDER','MAINTENANCE')
  AND NOT EXISTS (
    SELECT 1
    FROM room_assignments a
    JOIN reservations b ON b.id = a.reservation_id
    WHERE a.room_id = r.id
      AND a.released_at IS NULL
      AND b.status IN ('CONFIRMED','CHECKED_IN')
      AND b.check_in  < $4::date
      AND b.check_out > $3::date
  )
  AND NOT EXISTS (
    SELECT 1
    FROM maintenance_records m
    WHERE m.room_id = r.id
      AND m.status IN ('OPEN','IN_PROGRESS')
      AND m.resolved_at IS NULL
      AND m.expected_ready_at IS NULL OR m.expected_ready_at > $3::date
  );
```

### 6.3 Endpoint

```
GET /api/public/availability
  ?checkIn=2026-08-15
  &checkOut=2026-08-18
  &adults=2
  &children=0
  &rooms=1

→ 200
{
  "stay": { "checkIn": "...", "checkOut": "...", "nights": 3 },
  "roomTypes": [
    {
      "id": "...", "slug": "deluxe-room", "name": "Deluxe Room",
      "maxGuests": 2, "sizeSqft": 250, "beds": "1 King",
      "amenities": ["wifi","ac","tv","balcony"],
      "cover": "https://cdn/.../deluxe.jpg",
      "available": 3,
      "soldOut": false,
      "nightlyRate": 450000,
      "totalForStay": 1350000
    },
    ...
  ]
}
```

Availability responses are **not cached long-term** because they change
on every booking. Use a 10–30s in-memory LRU keyed by query string for
the public search; the source of truth is always PostgreSQL.

---

## 7. Reservation lifecycle

### 7.1 States

```
                ┌─────────┐
                │ PENDING │  (enquiry flow, no hold)
                └────┬────┘
                     │ approve / convert
                     ▼
                ┌─────────┐
                │  HELD   │  (inventory reserved, expires_at = now + 10m)
                └────┬────┘
              pay │  │ expire
                  ▼  ▼
        ┌──────┐  ┌──────────┐
        │CONF. │  │ EXPIRED  │
        └──┬───┘  └──────────┘
   check-in│
           ▼
        ┌───────────┐
        │CHECKED_IN │
        └────┬──────┘
   check-out│
           ▼
        ┌────────────┐
        │CHECKED_OUT │  → housekeeping auto-creates CHECKOUT_CLEAN task
        └────────────┘

  Any active state ──cancel──► CANCELLED
  CONFIRMED + no show after cutoff ──► NO_SHOW
```

### 7.2 Transitions (server-enforced)

| From              | Event              | To            | Pre-conditions                                                                |
| ----------------- | ------------------ | ------------- | ----------------------------------------------------------------------------- |
| (none)            | `createEnquiry`    | PENDING       | Valid guest + dates                                                            |
| (none)            | `createWalkIn`     | HELD→CONFIRMED | Perms + payment/confirm                                                       |
| PENDING           | `approve`          | HELD          | Perms; transitions to held by creating a hold + inventory check               |
| PENDING           | `convert`          | HELD→CONFIRMED | Perms; creates a reservation directly                                          |
| HELD              | `pay` / `confirm`  | CONFIRMED     | Payment captured (or admin override)                                          |
| HELD              | `expire`           | EXPIRED       | BullMQ cron after `expiresAt`                                                  |
| HELD/PENDING/CONFIRMED | `cancel`     | CANCELLED     | `BOOKING_CANCEL` perm; cancellation policy (window)                            |
| CONFIRMED         | `checkIn`          | CHECKED_IN    | `BOOKING_CHECKIN` perm; assignment exists                                      |
| CHECKED_IN        | `checkOut`         | CHECKED_OUT   | `BOOKING_CHECKOUT` perm; balance handled (configurable)                       |
| CONFIRMED/CHECKED_IN | `extend`       | (same)        | `BOOKING_EXTEND` perm; extension row created → on approve, `checkOut` updated  |
| CONFIRMED         | (auto)             | NO_SHOW       | Past check-in cutoff + never checked in                                        |

### 7.3 Soft holds (separate table)

```ts
// POST /api/public/availability/hold
// → 201
{
  "holdId": "hld_...",
  "expiresAt": "2026-08-12T12:42:00Z",
  "secondsLeft": 600,
  "pricing": { "nightlyRate": 450000, "subtotal": 1350000, "tax": 0, "total": 1350000 }
}
```

- `ReservationHold` row: `status=ACTIVE`, `expiresAt = now + 10m`.
- The availability engine treats HELD reservations as occupied (§6.1).
- A BullMQ delayed job transitions the hold to `EXPIRED` when the timer
  fires, frees the inventory, and emits `HOLD_EXPIRED` over WebSocket.
- Re-hitting the hold endpoint for the same `sessionId` resets
  `expiresAt` and reuses the existing row.
- On `pay`/`confirm` success, the hold is set `CONVERTED` and linked to
  the new `Reservation.convertedReservationId`.

### 7.4 Conflict detection (every mutating endpoint)

```ts
async function detectConflicts(input: {
  resortId: string;
  reservationId?: string;
  roomTypeId: string;
  roomId?: string;
  checkIn: Date;
  checkOut: Date;
  rooms: number;
  excludeSelf?: boolean;
}): Promise<ConflictReport>
```

Conflicts returned:
- `INVENTORY_UNAVAILABLE` — not enough units in room type
- `ROOM_UNAVAILABLE` — physical room occupied/OOO in range
- `EXTENSION_OVERLAP` — same reservation already has a pending extension
- `MAINTENANCE_ACTIVE` — physical room under open maintenance
- `POLICY_VIOLATION` — min/max stay, children policy, etc.

Each is mapped to a frontend state per frontend spec §24
(`Booking conflict`, `Sold out`, etc.).

### 7.5 Extension flow

```
guest (or staff) → POST /api/reservations/:id/extension
  body: { newCheckOut, reason? }
  ├─ conflict check (room-type + physical-room availability for extended range)
  ├─ recompute price (additionalNights × nightlyRate)
  ├─ create ExtensionRequest (decision=null)
  └─ notify reception

staff → POST /api/admin/reservations/:id/extension/:extId/decision
  body: { decision: 'APPROVED'|'REJECTED', note? }
  ├─ if APPROVED:
  │   ├─ update Reservation.checkOut
  │   ├─ recompute totals, create additional Payment intent
  │   └─ emit RESERVATION_EXTENDED
  └─ if REJECTED: just mark + notify
```

The service returns one of three explicit results so the UI can show
the right next step:

```ts
type ExtensionEvaluation =
  | { kind: 'EXTENDED_SAME_ROOM' }
  | { kind: 'EXTENSION_REQUIRES_ROOM_CHANGE'; suggestedRoomId: string }
  | { kind: 'EXTENSION_UNAVAILABLE'; reason: string };
```

### 7.6 Check-in

```ts
// POST /api/admin/reservations/:id/check-in
//   - reservation must be CONFIRMED
//   - RoomAssignment must exist (or auto-assign if no other constraint)
//   - sets Reservation.status = CHECKED_IN, checkedInAt = now()
//   - sets Room.status = OCCUPIED
//   - emits ROOM_STATUS_CHANGED + RESERVATION_CHECKED_IN
```

### 7.7 Check-out

```ts
// POST /api/admin/reservations/:id/check-out
//   - reservation must be CHECKED_IN
//   - optional late-checkout decision (see §7.8)
//   - sets Reservation.status = CHECKED_OUT, checkedOutAt = now()
//   - sets Room.status = CLEANING (housekeeping takes over)
//   - auto-creates a HousekeepingTask (type=CHECKOUT_CLEAN, priority=NORMAL)
//   - emits RESERVATION_CHECKED_OUT + HOUSEKEEPING_TASK_CREATED
```

### 7.8 Late checkout

`POST /api/admin/reservations/:id/late-checkout` with
`{ approvedUntil: '15:00', fee?: number }`:
- If `fee > 0`, creates a `Payment` row (`method=CASH`, `amount=fee`).
- Does **not** extend the reservation date — only the time-of-day.
- Visible on the reservation timeline.

### 7.9 Cancellation

```ts
// POST /api/admin/reservations/:id/cancel
//   - evaluate cancellation policy (freeUntilHours, partialChargePct)
//   - compute refund amount
//   - if payment was Razorpay → issue refund via provider
//   - if manual → create negative Payment row (method=REFUND)
//   - status → CANCELLED; cancelledAt = now()
//   - inventory freed
//   - emits RESERVATION_CANCELLED
```

---

## 8. RBAC & permissions

### 8.1 Permission keys (canonical)

```ts
// src/rbac/permissions.ts
export const PERMISSIONS = [
  // Bookings
  'BOOKING_VIEW',
  'BOOKING_CREATE',
  'BOOKING_CREATE_WALKIN',
  'BOOKING_CREATE_PHONE',
  'BOOKING_MODIFY',
  'BOOKING_CANCEL',
  'BOOKING_CONFIRM',
  'BOOKING_CHECKIN',
  'BOOKING_CHECKOUT',
  'BOOKING_ASSIGN_ROOM',
  'BOOKING_MOVE_ROOM',
  'BOOKING_EXTEND',
  'BOOKING_LATE_CHECKOUT',
  'BOOKING_REFUND',
  'BOOKING_EXPORT',
  'BOOKING_IMPORT',

  // Guests
  'GUEST_VIEW',
  'GUEST_EDIT',
  'GUEST_EXPORT',

  // Enquiries
  'ENQUIRY_VIEW',
  'ENQUIRY_CREATE',
  'ENQUIRY_ASSIGN',
  'ENQUIRY_CONVERT',
  'ENQUIRY_DELETE',

  // Rooms
  'ROOM_TYPE_VIEW',
  'ROOM_TYPE_EDIT',
  'ROOM_TYPE_PUBLISH',
  'ROOM_VIEW',
  'ROOM_EDIT',
  'ROOM_MAINTENANCE',

  // Pricing
  'PRICING_VIEW',
  'PRICING_EDIT',
  'RATE_PLAN_EDIT',
  'OFFER_VIEW',
  'OFFER_EDIT',
  'OFFER_PUBLISH',

  // Housekeeping
  'HOUSEKEEPING_VIEW',
  'HOUSEKEEPING_ASSIGN',
  'HOUSEKEEPING_UPDATE',
  'HOUSEKEEPING_CREATE_TASK',

  // Reports
  'REPORT_VIEW',
  'REPORT_EXPORT',
  'REVENUE_VIEW',

  // CMS
  'CMS_HERO_EDIT',
  'CMS_PAGE_EDIT',
  'CMS_GALLERY_EDIT',
  'CMS_GALLERY_UPLOAD',
  'CMS_REVIEW_EDIT',
  'CMS_ATTRACTION_EDIT',
  'CMS_AMENITY_EDIT',

  // Staff
  'STAFF_VIEW',
  'STAFF_CREATE',
  'STAFF_EDIT',
  'STAFF_SUSPEND',
  'RBAC_EDIT',

  // System
  'SETTINGS_VIEW',
  'SETTINGS_EDIT',
  'AUDIT_LOG_VIEW',
  'NOTIFICATION_BROADCAST',
] as const;
```

### 8.2 Default roles

| Role          | Holds                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------- |
| `OWNER`       | ALL                                                                                         |
| `MANAGER`     | all bookings, all rooms, all pricing, housekeeping, reports, settings, NO rbac/staff        |
| `RECEPTION`   | BOOKING_* (no refund), GUEST_*, ENQUIRY_*, ROOM_TYPE_VIEW, ROOM_VIEW, HOUSEKEEPING_VIEW     |
| `MARKETING`   | CMS_*, OFFER_*, RATE_PLAN_VIEW, PRICING_VIEW, REPORT_VIEW                                   |
| `HOUSEKEEPING`| HOUSEKEEPING_*, ROOM_VIEW, ROOM_MAINTENANCE                                                 |

Roles are templates stored in code; the bundle of permissions per role
is editable in the admin UI (gated by `RBAC_EDIT`).

### 8.3 Middleware

```ts
router.post(
  '/api/admin/reservations/:id/cancel',
  requireAuth(),                  // 401 if no session
  requireResortScope(),           // inject resortId from auth
  requirePermission('BOOKING_CANCEL'),  // 403 with missing keys if absent
  validate(cancelReservationSchema),    // 400 with field errors
  audit('BOOKING_CANCEL'),        // log on success
  reservationController.cancel,
);
```

`can(staff, 'BOOKING_CANCEL')` returns boolean. The response on 403
includes the missing keys so the admin can debug.

---

## 9. API surface

> All routes are prefixed with `/api`. Public under `/api/public`,
> bookings under `/api/reservations` and `/api/availability`,
> admin under `/api/admin`. Webhooks under `/api/webhooks`.

### 9.1 Public

| Method | Path                                            | Notes                                  |
| ------ | ----------------------------------------------- | -------------------------------------- |
| GET    | `/api/public/resort`                            | active resort + key settings           |
| GET    | `/api/public/rooms`                             | published room types w/ cover          |
| GET    | `/api/public/rooms/:slug`                       | detail + photos + amenities            |
| GET    | `/api/public/offers`                            | active offers                          |
| GET    | `/api/public/offers/:slug`                      | offer detail                           |
| GET    | `/api/public/gallery`                           | grouped by category                    |
| GET    | `/api/public/amenities`                         | resort-wide amenity sections           |
| GET    | `/api/public/reviews`                           | published + featured                   |
| GET    | `/api/public/nearby`                            | active attractions                     |
| GET    | `/api/public/availability`                      | §6.3                                   |
| POST   | `/api/public/availability/hold`                 | §7.3 — create hold                     |
| GET    | `/api/public/availability/hold/:holdId`         | poll hold status                       |
| DELETE | `/api/public/availability/hold/:holdId`         | release hold early                     |
| POST   | `/api/public/enquiries`                         | contact form / WA intake               |
| GET    | `/api/public/reservations/lookup`               | `?id=BK1048&phone=...` (idempotent)    |
| POST   | `/api/public/reservations/:id/cancel`           | self-service cancel (token in URL)     |
| POST   | `/api/public/reservations/:id/extension-request`| guest asks to extend                   |
| POST   | `/api/public/reservations/:id/feedback`         | post-stay review submission            |
| GET    | `/api/public/ws-ticket`                         | short-lived ticket for WebSocket hand  |

### 9.2 Reservations (auth required, but bearer token from session)

| Method | Path                                                    | Permission         |
| ------ | ------------------------------------------------------- | ------------------ |
| POST   | `/api/reservations`                                     | `BOOKING_CREATE`   |
| GET    | `/api/reservations/:id`                                 | `BOOKING_VIEW`     |
| POST   | `/api/reservations/:id/confirm`                         | `BOOKING_CONFIRM`  |
| POST   | `/api/reservations/:id/cancel`                          | `BOOKING_CANCEL`   |
| POST   | `/api/reservations/:id/extension`                       | `BOOKING_EXTEND`   |
| POST   | `/api/reservations/:id/extension/:extId/decision`       | `BOOKING_EXTEND`   |

### 9.3 Payments

| Method | Path                                            | Notes                                  |
| ------ | ----------------------------------------------- | -------------------------------------- |
| POST   | `/api/payments/orders`                          | create Razorpay order for reservation  |
| POST   | `/api/payments/verify`                          | verify checkout signature              |
| POST   | `/api/payments/manual`                          | staff records manual payment           |
| POST   | `/api/payments/:id/refund`                      | staff-issued refund                    |
| GET    | `/api/payments/reservation/:id`                 | list payments                          |

### 9.4 Webhooks

| Method | Path                                | Verification                |
| ------ | ----------------------------------- | --------------------------- |
| POST   | `/api/webhooks/razorpay`            | HMAC SHA256, raw body       |
| POST   | `/api/webhooks/whatsapp`            | `X-Hub-Signature-256` HMAC  |

### 9.5 Admin

Dashboard
| GET    | `/api/admin/dashboard`             | `REPORT_VIEW`              |
| GET    | `/api/admin/dashboard/occupancy`   | `REPORT_VIEW`              |
| GET    | `/api/admin/dashboard/today`       | —                          |

Bookings
| GET    | `/api/admin/reservations`                       | `BOOKING_VIEW`             |
| GET    | `/api/admin/reservations/:id`                   | `BOOKING_VIEW`             |
| POST   | `/api/admin/reservations`                       | `BOOKING_CREATE_*`         |
| PATCH  | `/api/admin/reservations/:id`                   | `BOOKING_MODIFY`           |
| POST   | `/api/admin/reservations/:id/confirm`           | `BOOKING_CONFIRM`          |
| POST   | `/api/admin/reservations/:id/cancel`            | `BOOKING_CANCEL`           |
| POST   | `/api/admin/reservations/:id/check-in`          | `BOOKING_CHECKIN`          |
| POST   | `/api/admin/reservations/:id/check-out`         | `BOOKING_CHECKOUT`         |
| POST   | `/api/admin/reservations/:id/late-checkout`     | `BOOKING_LATE_CHECKOUT`    |
| POST   | `/api/admin/reservations/:id/assign-room`       | `BOOKING_ASSIGN_ROOM`      |
| POST   | `/api/admin/reservations/:id/move-room`         | `BOOKING_MOVE_ROOM`        |
| POST   | `/api/admin/reservations/:id/extensions`        | `BOOKING_EXTEND`           |
| POST   | `/api/admin/reservations/:id/extension/:extId/decision` | `BOOKING_EXTEND`    |
| POST   | `/api/admin/reservations/:id/notes`             | `BOOKING_VIEW`             |
| GET    | `/api/admin/reservations/calendar`              | `BOOKING_VIEW`             |
| GET    | `/api/admin/reservations/export`                | `BOOKING_EXPORT`           |

Guests
| GET    | `/api/admin/guests`                             | `GUEST_VIEW`               |
| GET    | `/api/admin/guests/:id`                         | `GUEST_VIEW`               |
| PATCH  | `/api/admin/guests/:id`                         | `GUEST_EDIT`               |
| GET    | `/api/admin/guests/:id/reservations`            | `GUEST_VIEW`               |

Enquiries
| GET    | `/api/admin/enquiries`                          | `ENQUIRY_VIEW`             |
| GET    | `/api/admin/enquiries/:id`                      | `ENQUIRY_VIEW`             |
| PATCH  | `/api/admin/enquiries/:id`                      | `ENQUIRY_CREATE`           |
| POST   | `/api/admin/enquiries/:id/convert`              | `ENQUIRY_CONVERT`          |
| POST   | `/api/admin/enquiries/:id/notes`                | `ENQUIRY_VIEW`             |

Rooms
| GET    | `/api/admin/room-types`                         | `ROOM_TYPE_VIEW`           |
| POST   | `/api/admin/room-types`                         | `ROOM_TYPE_EDIT`           |
| PATCH  | `/api/admin/room-types/:id`                     | `ROOM_TYPE_EDIT`           |
| POST   | `/api/admin/room-types/:id/publish`             | `ROOM_TYPE_PUBLISH`        |
| GET    | `/api/admin/rooms`                              | `ROOM_VIEW`                |
| POST   | `/api/admin/rooms`                              | `ROOM_EDIT`                |
| PATCH  | `/api/admin/rooms/:id`                          | `ROOM_EDIT`                |
| POST   | `/api/admin/rooms/:id/maintenance`              | `ROOM_MAINTENANCE`         |
| POST   | `/api/admin/rooms/:id/maintenance/close`        | `ROOM_MAINTENANCE`         |

Pricing & offers
| GET    | `/api/admin/pricing/rules`                      | `PRICING_VIEW`             |
| POST   | `/api/admin/pricing/rules`                      | `PRICING_EDIT`             |
| PATCH  | `/api/admin/pricing/rules/:id`                  | `PRICING_EDIT`             |
| GET    | `/api/admin/pricing/rates`                      | `PRICING_VIEW`             |
| POST   | `/api/admin/pricing/rates`                      | `PRICING_EDIT`             |
| PATCH  | `/api/admin/pricing/rates/:id`                  | `PRICING_EDIT`             |
| GET    | `/api/admin/rate-plans`                         | `PRICING_VIEW`             |
| POST   | `/api/admin/rate-plans`                         | `RATE_PLAN_EDIT`           |
| GET    | `/api/admin/offers`                             | `OFFER_VIEW`               |
| POST   | `/api/admin/offers`                             | `OFFER_EDIT`               |
| PATCH  | `/api/admin/offers/:id`                         | `OFFER_EDIT`               |
| POST   | `/api/admin/offers/:id/publish`                 | `OFFER_PUBLISH`            |

Housekeeping
| GET    | `/api/admin/housekeeping/board`                 | `HOUSEKEEPING_VIEW`        |
| GET    | `/api/admin/housekeeping/tasks`                 | `HOUSEKEEPING_VIEW`        |
| POST   | `/api/admin/housekeeping/tasks`                 | `HOUSEKEEPING_CREATE_TASK` |
| PATCH  | `/api/admin/housekeeping/tasks/:id`             | `HOUSEKEEPING_UPDATE`      |
| POST   | `/api/admin/housekeeping/tasks/:id/assign`      | `HOUSEKEEPING_ASSIGN`      |

CMS
| GET    | `/api/admin/cms/sections`                       | `CMS_HERO_EDIT` (or scope) |
| PUT    | `/api/admin/cms/sections/:key`                  | `CMS_*_EDIT`              |
| GET    | `/api/admin/cms/pages`                          | `CMS_PAGE_EDIT`           |
| GET    | `/api/admin/cms/pages/:slug`                    | `CMS_PAGE_EDIT`           |
| PUT    | `/api/admin/cms/pages/:slug`                    | `CMS_PAGE_EDIT`           |
| GET    | `/api/admin/cms/gallery/categories`             | `CMS_GALLERY_EDIT`        |
| POST   | `/api/admin/cms/gallery/categories`             | `CMS_GALLERY_EDIT`        |
| GET    | `/api/admin/cms/gallery/images`                 | `CMS_GALLERY_EDIT`        |
| POST   | `/api/admin/cms/gallery/images`                 | `CMS_GALLERY_UPLOAD`      |
| PATCH  | `/api/admin/cms/gallery/images/:id`             | `CMS_GALLERY_EDIT`        |
| DELETE | `/api/admin/cms/gallery/images/:id`             | `CMS_GALLERY_EDIT`        |
| GET    | `/api/admin/cms/reviews`                        | `CMS_REVIEW_EDIT`         |
| POST   | `/api/admin/cms/reviews`                        | `CMS_REVIEW_EDIT`         |
| PATCH  | `/api/admin/cms/reviews/:id`                    | `CMS_REVIEW_EDIT`         |
| GET    | `/api/admin/cms/attractions`                    | `CMS_ATTRACTION_EDIT`      |
| POST   | `/api/admin/cms/attractions`                    | `CMS_ATTRACTION_EDIT`      |
| GET    | `/api/admin/cms/amenities`                      | `CMS_AMENITY_EDIT`        |
| POST   | `/api/admin/cms/amenities`                      | `CMS_AMENITY_EDIT`        |

Reports
| GET    | `/api/admin/reports/revenue`                    | `REVENUE_VIEW`            |
| GET    | `/api/admin/reports/occupancy`                  | `REPORT_VIEW`             |
| GET    | `/api/admin/reports/bookings`                   | `REPORT_VIEW`             |
| GET    | `/api/admin/reports/sources`                    | `REPORT_VIEW`             |
| GET    | `/api/admin/reports/room-performance`           | `REPORT_VIEW`             |
| GET    | `/api/admin/reports/export`                     | `REPORT_EXPORT`           |

Staff & RBAC
| GET    | `/api/admin/staff`                              | `STAFF_VIEW`              |
| POST   | `/api/admin/staff`                              | `STAFF_CREATE`            |
| PATCH  | `/api/admin/staff/:id`                          | `STAFF_EDIT`              |
| POST   | `/api/admin/staff/:id/suspend`                  | `STAFF_SUSPEND`           |
| GET    | `/api/admin/roles`                              | `RBAC_EDIT`               |
| PUT    | `/api/admin/roles/:key/permissions`             | `RBAC_EDIT`               |

Settings, logs, search
| GET    | `/api/admin/settings`                           | —                         |
| PUT    | `/api/admin/settings`                           | `SETTINGS_EDIT`           |
| GET    | `/api/admin/audit-log`                          | `AUDIT_LOG_VIEW`          |
| GET    | `/api/admin/notifications`                      | —                         |
| POST   | `/api/admin/notifications/:id/read`             | —                         |
| GET    | `/api/admin/search?q=`                          | —                         |
| GET    | `/api/admin/me`                                 | —                         |
| GET    | `/api/admin/sessions`                           | —                         |
| DELETE | `/api/admin/sessions/:id`                       | —                         |

### 9.6 Conventions

- All requests/responses are JSON.
- Errors: `{ "error": { "code": "BOOKING_CONFLICT", "message": "...", "details": {...} } }`
- IDs are CUIDs in URLs, `bookingReference` (`#BK1048`) in copy.
- Dates: ISO 8601 UTC; frontend renders in `Asia/Kolkata`.
- Money: integer paise, `X-Currency` header (default `INR`).
- Pagination: `?cursor=...&limit=20`; response includes `nextCursor`.
- All admin mutations emit WebSocket events and write `AuditLog`.
- All public writes are rate-limited; admin writes are per-staff.

---

## 10. Payment flow

### 10.1 Online (Razorpay)

```
client: POST /api/payments/orders
  body: { reservationId, amount }
  → server: create Razorpay order (amount = total)
  → respond: { orderId, key, amount, currency }

client: opens Razorpay checkout
  → on success: client calls POST /api/payments/verify
       { orderId, paymentId, signature }

server:
  - HMAC verify signature
  - in a transaction:
      - find reservation (HELD)
      - mark CONFIRMED
      - find hold (ACTIVE) → mark CONVERTED, link reservationId
      - create Payment (status=CAPTURED, method=RAZORPAY)
      - update amountPaid, amountDue
  - emit RESERVATION_CONFIRMED + PAYMENT_CAPTURED
  - enqueue email + WhatsApp confirmation
```

The webhook (`/api/webhooks/razorpay`) handles async events
(`payment.captured`, `refund.processed`, `payment.failed`) for cases
where the client never returns (network drop, refresh). Idempotent on
`providerPaymentId` (unique constraint).

**Critical: reservation identity and payable amount always come from
the server.** The client cannot specify an amount or a different
reservationId in the verify step — those are looked up from the order.

### 10.2 Manual

Reception records a payment directly (`method = CASH | BANK_TRANSFER |
UPI | CHEQUE | CARD`). No Razorpay call. Audit logs the staff member.

### 10.3 Partial payment

Supported: `amountPaid` < `totalAmount`, `amountDue = total - paid`.
Reservation can be `CONFIRMED` with `amountDue > 0` if
`booking.allowPendingBalance = true` in settings.

### 10.4 Refunds

`POST /api/admin/payments/:id/refund`:
- Online → Razorpay refund API.
- Manual → negative-amount `Payment` row, `method=REFUND`.
- Status: `REFUNDED` or `PARTIALLY_REFUNDED`.

---

## 11. CMS

### 11.1 Hero / Sectioned content (`WebsiteSection`)

Keyed by `resortId + key`. The `content` JSON is a typed payload
specific to each section. Editors can change `hero`, `footer`, `contact`,
`about`, etc. without code changes.

```json
// hero
{
  "headline": "Relax. Refresh. Reconnect.",
  "subheadline": "Experience the perfect blend of nature...",
  "imageUrl": "...",
  "primaryCta": { "label": "Book Your Stay", "href": "/booking" },
  "secondaryCta": { "label": "Chat on WhatsApp", "href": "https://wa.me/..." }
}
```

### 11.2 Pages (`Page`)

`Page.body` is `{ sections: [{ type, ...payload }] }` where `type` is
from a small allowlist (`hero`, `paragraph`, `image_grid`, `stats`,
`quote`, `cta`, `map`, `faq`). No arbitrary HTML.

### 11.3 Gallery

Categories: Resort, Rooms, Pool, Restaurant, Events, Surroundings,
Experiences. Drag-and-drop reorder via `displayOrder`. Cloudinary
uploads via signed payload.

### 11.4 Reviews

`source` enum disambiguates Google vs Direct. The UI **never**
auto-renders a "Google review" badge unless `source = GOOGLE` AND
`sourceUrl` is set. A manually-added review renders as "Verified
guest" or stays anonymous by design.

### 11.5 Settings (`WebsiteSetting`)

Typed KV store for non-section config:

```
resort.phone, resort.email, resort.address, resort.coords,
resort.check_in_time, resort.check_out_time,
booking.hold_minutes, booking.min_nights, booking.max_nights,
booking.allow_pending_balance,
cancellation.free_until_hours, cancellation.partial_charge_pct,
tax.gst_pct,
whatsapp.number, email.from,
social.instagram, social.facebook,
...
```

A Zod schema per key validates on read and write.

---

## 12. Housekeeping & maintenance

### 12.1 Housekeeping board

```
columns:  DIRTY (checkout_clean pending) | CLEANING | READY | OCCUPIED | MAINTENANCE
rows:     every active Room
```

- On `CHECKED_OUT`, the system creates a `HousekeepingTask`
  (`CHECKOUT_CLEAN`, `PENDING`) for the assigned room and sets the
  room's `status = CLEANING`.
- Housekeeper clicks room card → `PATCH /housekeeping/tasks/:id` with
  `status: IN_PROGRESS` → `COMPLETED`.
- When `COMPLETED`, the room's `status` auto-transitions to `READY`.
- `MAINTENANCE` and `OUT_OF_ORDER` exclude the room from bookable
  inventory (§6).
- Board is **derived** in the read query from the latest task + room
  status, so the board is always consistent.

### 12.2 Maintenance

`POST /api/admin/rooms/:id/maintenance` opens a `MaintenanceRecord`:
- `expectedReadyAt` may be null.
- A room with an open `MaintenanceRecord` covering the search range
  is excluded from availability.
- `POST /api/admin/rooms/:id/maintenance/close` sets `resolvedAt` and
  reverts the room's `status` to `READY`.

---

## 13. Enquiries

- Web form / WhatsApp / phone funnel into the same `Enquiry` table.
- `POST /api/admin/enquiries/:id/convert` opens the booking flow
  pre-filled (`?enquiryId=...`) and creates a `Reservation` with
  `source = WHATSAPP` (or whatever the enquiry source is). The
  enquiry's `convertedReservationId` is set and status → `CONVERTED`.
- Auto-assignment: round-robin among staff with `ENQUIRY_VIEW`
  permission; otherwise unassigned for triage.

---

## 14. Reports

All reports are read queries over the reservation/guest/room tables
with date filters. No materialized views in v1.

| Report              | Returns                                                              |
| ------------------- | -------------------------------------------------------------------- |
| Revenue             | `sum(total) - sum(refunds)` per day/week/month, by room type & source|
| Occupancy           | `occupied_nights / available_nights` per range                       |
| Bookings            | count by status, source, room type                                   |
| Cancellations       | count + lost revenue (potential vs captured)                         |
| Sources             | `count(group by source)` + pie                                       |
| Conversion          | `confirmed / (confirmed + cancelled + expired + no_show)`            |
| Avg stay            | `avg(checkOut - checkIn)`                                            |
| Popular room types  | `count(group by roomTypeId)`                                         |

All support `?from=YYYY-MM-DD&to=YYYY-MM-DD&granularity=day|week|month`
and JSON or CSV (`Accept: text/csv` or `?format=csv`).

---

## 15. Audit log

Every admin mutation writes one `AuditLog` row:

```json
{
  "actorType": "staff",
  "actorId": "stf_...",
  "resortId": "r_...",
  "action": "BOOKING_CONFIRM",
  "entity": "reservation",
  "entityId": "res_...",
  "beforeData": { "status": "PENDING" },
  "afterData":  { "status": "CONFIRMED" },
  "ip": "...",
  "userAgent": "..."
}
```

`beforeData`/`afterData` are JSON snapshots — full state, not deltas —
so reviews can be replayed even if a subsequent change overwritten
intermediate state. The audit log is **append-only** (no UPDATE/DELETE
exposed). Retained forever; hot data archived after 12 months.

---

## 16. Notifications

### 16.1 Channels

| Channel  | In v1 | Implementation                          |
| -------- | ----- | --------------------------------------- |
| IN_APP   | ✅    | `Notification` row + WebSocket fanout   |
| EMAIL    | ✅    | Nodemailer + Handlebars templates       |
| WHATSAPP | ✅    | Meta Cloud API (templates pre-approved) |
| SMS      | 🔌    | MSG91 / Twilio, behind `SmsChannel`     |

### 16.2 Dispatcher

```ts
// services/notificationService.ts
export async function notify(opts: {
  resortId: string;
  audience: Audience;          // 'OWNER' | { role: 'RECEPTION' } | { staffId }
  type: NotificationType;      // 'NEW_BOOKING' | ...
  channels: NotificationChannel[];
  data: Record<string, any>;   // for templates
}): Promise<void>
```

Looks up the audience, finds the right templates, fans out. Failed
channels retry with backoff (BullMQ); after N attempts, the row is
marked `failedAt` and an admin alert is raised.

### 16.3 Triggers

| Event                         | Audience      | Channels               |
| ----------------------------- | ------------- | ---------------------- |
| Booking confirmed             | guest         | EMAIL + WHATSAPP       |
| Booking cancelled             | guest         | EMAIL + WHATSAPP       |
| Check-in reminder (T-1 day)   | guest         | EMAIL + WHATSAPP       |
| Extension approved/rejected   | guest         | WHATSAPP               |
| New booking (website)         | RECEPTION     | IN_APP + EMAIL         |
| New enquiry                   | RECEPTION     | IN_APP + EMAIL + WA    |
| Payment received              | guest + staff | EMAIL + IN_APP         |
| Maintenance opened            | MANAGER       | IN_APP                 |
| Housekeeping task overdue     | HOUSEKEEPING  | IN_APP                 |

---

## 17. Realtime / WebSocket

### 17.1 Handshake (no query-string token)

```
client → GET  /api/public/ws-ticket
              (auth: bearer)
       ←  { ticket: "short-lived JWT, 30s, scope: 'ws'" }

client → WS   wss://api/ws
              Authorization: Bearer <ticket>
              Sec-WebSocket-Protocol: resort.v1
       ← open
```

The `ws` library accepts a custom `verifyClient` that:
1. Parses `Authorization: Bearer <ticket>` from the upgrade request.
2. Verifies the ticket is a short-lived `scope: 'ws'` JWT.
3. Rejects with `401` on failure.

**No tokens in URLs. No query strings. No log leakage.**

### 17.2 Authenticated namespaces

After handshake, the client joins `/admin` (staff) or `/guest`
(session-bound). The server maps `staffId → resortId` and the socket
joins `resort:<resortId>` for fanout.

### 17.3 Events

```ts
// realtime/events.ts
export type ServerEvent =
  | { type: 'BOOKING_CREATED';   data: { reservation: ReservationDTO } }
  | { type: 'BOOKING_UPDATED';   data: { reservation: ReservationDTO } }
  | { type: 'BOOKING_CANCELLED'; data: { id: string } }
  | { type: 'BOOKING_CHECKED_IN';data: { id: string } }
  | { type: 'BOOKING_CHECKED_OUT'; data: { id: string } }
  | { type: 'BOOKING_EXTENDED';  data: { id: string; newCheckOut: string } }
  | { type: 'PAYMENT_CAPTURED';  data: { reservationId: string; amount: number } }
  | { type: 'PAYMENT_FAILED';    data: { reservationId: string } }
  | { type: 'ROOM_STATUS_CHANGED'; data: { roomId: string; status: RoomStatus } }
  | { type: 'ROOM_ASSIGNED';     data: { reservationId: string; roomId: string } }
  | { type: 'ROOM_MOVED';        data: { reservationId: string; fromRoomId: string; toRoomId: string } }
  | { type: 'HOUSEKEEPING_TASK_CREATED'; data: { task: HkTaskDTO } }
  | { type: 'HOUSEKEEPING_TASK_UPDATED'; data: { task: HkTaskDTO } }
  | { type: 'ENQUIRY_CREATED';   data: { enquiry: EnquiryDTO } }
  | { type: 'ENQUIRY_UPDATED';   data: { enquiry: EnquiryDTO } }
  | { type: 'HOLD_EXPIRED';      data: { holdId: string } }
  | { type: 'EXTENSION_REQUESTED'; data: { reservationId: string } }
  | { type: 'EXTENSION_DECIDED';   data: { id: string; decision: 'APPROVED'|'REJECTED' } };
```

Each event is **typed in shared package** (e.g. `@resort/contracts`)
consumed by both backend emitter and frontend listener.

---

## 18. Security

### 18.1 Layered defenses

```
Internet
   ↓
nginx (TLS, rate limits, IP allowlist for admin if desired)
   ↓
Express
   ├── CORS allowlist (public site + admin origins only)
   ├── Helmet (security headers: HSTS, X-Content-Type-Options, CSP, ...)
   ├── Body size limit (1MB JSON)
   ├── Global rate limit (per IP)
   ├── Per-route rate limit (auth, availability, holds, payments)
   ├── requireAuth (verify access JWT, hydrate req.staff)
   ├── requireResortScope (inject req.resortId)
   ├── requirePermission('KEY') (403 with missing keys)
   ├── validate(zodSchema) (400 with field errors)
   ├── csrf (double-submit for state-changing admin/booking routes)
   └── audit (log on success with before/after)
   ↓
Service
   ↓
Repository
   ↓
DB (parameterized Prisma queries; no string concat)
```

### 18.2 Auth specifics

- **bcryptjs** cost 12 for staff passwords.
- Access JWT: 15m, signed with `JWT_ACCESS_SECRET`, scope: `api`.
- Refresh: 30d, stored in `StaffSession` as SHA-256 hash.
- Refresh cookie: `HttpOnly`, `Secure`, `SameSite=Lax`, scoped to
  `/api/auth`.
- Refresh rotation on every use; reuse detection revokes the entire
  family.
- Account lockout after 5 failed logins in 15 min (`failedLoginCount`,
  `lockedUntil`).
- Password reset: 30-min token, single-use, emailed.
- Email verification required for new staff before `ACTIVE` status.

### 18.3 CSRF

- Double-submit pattern: a non-HttpOnly `csrf_token` cookie is set
  on `GET /api/auth/csrf`. The client reads it and echoes it in
  `X-CSRF-Token` header on every state-changing request.
- Applied to: admin mutations, booking mutations, payment initiation,
  session-changing actions.
- Skipped for: `/api/webhooks/*` (HMAC-verified), `/api/public/auth/*`
  (no session yet).

### 18.4 Rate limits

| Bucket                            | Limit                    |
| --------------------------------- | ------------------------ |
| Global                            | 300 req / min / IP       |
| `POST /auth/login`                | 5 / 15 min / IP          |
| `POST /auth/refresh`              | 30 / min / IP            |
| `GET /public/availability`        | 60 / min / IP            |
| `POST /public/availability/hold`  | 10 / min / IP            |
| `POST /public/enquiries`          | 5 / hour / IP            |
| Admin mutations                   | 120 / min / staff        |
| `POST /payments/orders`           | 20 / min / user          |

Implemented with `rate-limiter-flexible` on Redis (prod) or in-memory
(dev).

### 18.5 Input validation

Every route has a Zod schema. Unknown keys stripped. Numeric strings
parsed. Date strings validated. Enums enforced. Max payload 1MB.

### 18.6 XSS

No HTML in user content except `Page.body` sections authored by
admin. Section types are an allowlist rendered by the frontend — no
`dangerouslySetInnerHTML` on user content. Admin review text in
`BookingNote` is rendered as plain text.

### 18.7 SQL injection

Prisma parameterizes everything. Raw SQL only via `$queryRaw` with
parameterized values (no `$$queryRawUnsafe` in committed code).

### 18.8 Logging hygiene

`pino` redacts `req.headers.authorization`, `req.headers.cookie`,
`*.password*`, `*.token*`, `*.signature*`. Webhook bodies are
**not** logged at INFO (only DEBUG with sampling).

### 18.9 Observability

- Sentry captures exceptions with `resortId`, `staffId` tags.
- Prometheus `/metrics` exposes:
  - `http_request_duration_seconds{route, method, status}`
  - `booking_success_total`, `booking_conflict_total`
  - `availability_requests_total`, `availability_cache_hit_total`
  - `payment_failure_total{method, reason}`
  - `enquiry_conversion_total`
  - `admin_auth_failure_total`
  - `room_status_changes_total{from,to}`
  - `websocket_connections{namespace}`
  - `hold_active_gauge`, `hold_expired_total`
- Structured logs with `requestId`, `resortId`, `staffId`.

---

## 19. Frontend ↔ backend data flow

| Frontend spec §                  | Backend touch                                             |
| -------------------------------- | --------------------------------------------------------- |
| §3 Hero availability card        | `GET /api/public/availability`                            |
| §4 Booking widget                | `GET /api/public/availability`                            |
| §5 Search results                | `GET /api/public/availability`                            |
| §6 Availability truth            | availabilityService §6                                    |
| §7 Room details                  | `GET /api/public/rooms/:slug`                             |
| §8 Gallery                       | `GET /api/public/gallery`                                 |
| §9 Booking details               | `POST /api/public/availability/hold` + `GET`               |
| §10 Temporary hold               | §7.3                                                       |
| §11 Payment / confirmation       | §10                                                        |
| §12 Confirmation page            | `GET /api/public/reservations/lookup`                     |
| §13 Booking lookup               | `GET /api/public/reservations/lookup`                     |
| §14 Customer cancel              | `POST /api/public/reservations/:id/cancel`                |
| §15 Extend request               | `POST /api/public/reservations/:id/extension-request`     |
| §16 Amenities                    | `GET /api/public/amenities`                               |
| §17 Offers                       | `GET /api/public/offers`, `/offers/:slug`                  |
| §18 Gallery page                 | `GET /api/public/gallery`                                 |
| §19 About                        | `GET /api/public/cms/pages/about`                         |
| §20 Nearby attractions           | `GET /api/public/nearby`                                  |
| §21 Reviews                      | `GET /api/public/reviews`                                 |
| §22 Contact form                 | `POST /api/public/enquiries`                              |
| §24 Empty/error/sold-out states  | All read endpoints return shapes that support them        |
| §27–30 Admin dashboard           | `/api/admin/dashboard`, `/rooms`, ...                     |
| §33 Booking management           | `/api/admin/reservations`                                 |
| §34 Booking detail               | `/api/admin/reservations/:id`                             |
| §35 Extend (admin)               | `POST /api/admin/reservations/:id/extension`              |
| §36 Room assignment              | `POST /api/admin/reservations/:id/assign-room`            |
| §37 Move room                    | `POST /api/admin/reservations/:id/move-room`              |
| §38–40 Walk-in / phone / WA      | `POST /api/admin/reservations` (`source` accordingly)      |
| §41 Enquiry mgmt                 | `/api/admin/enquiries`                                    |
| §42 Guest profiles               | `/api/admin/guests`                                       |
| §43–44 Pricing/offers            | `/api/admin/pricing/*`, `/api/admin/offers`               |
| §45–49 Website CMS               | `/api/admin/cms/*`                                        |
| §49–51 Housekeeping/maintenance  | `/api/admin/housekeeping/*`, `/rooms/:id/maintenance`     |
| §52–54 Staff & RBAC               | `/api/admin/staff`, `/api/admin/roles`                    |
| §55–57 Reports                    | `/api/admin/reports/*`                                    |
| §58 Notifications                 | WebSocket + email + WA + SMS                              |
| §59 Activity log                 | `/api/admin/audit-log`                                    |
| §60–63 Settings                   | `/api/admin/settings`                                     |
| §64–66 Calendar & conflicts      | `/api/admin/reservations/calendar` + §7.4                 |
| §68 Admin responsive             | same API, different UI                                    |
| §69–70 Security                   | §18 + §8                                                  |
| §72 Single source of truth       | All of the above.                                         |

---

## 20. Edge cases & tests (acceptance suite)

The 12 critical tests we explicitly need to pass before any release:

1. **Last room, two simultaneous bookings** — start a hold for the last
   available room, race a second request; exactly one succeeds, the
   other gets `409 INVENTORY_UNAVAILABLE`.
2. **Hold expiry** — start a hold, wait > 10 min, the hold transitions
   to `EXPIRED`, inventory reappears in the next availability query.
3. **Cancellation policy windows** — free cancel up to 7 days, 50%
   charge within 7 days, 100% within 24h; verify refund math + state
   transitions.
4. **Extension same room** — `EXTENDED_SAME_ROOM` when physical room
   remains available.
5. **Extension requires room change** — physical room is occupied after
   current check-out → `EXTENSION_REQUIRES_ROOM_CHANGE` with a
   `suggestedRoomId`.
6. **Extension unavailable** — no inventory after current check-out →
   `EXTENSION_UNAVAILABLE`.
7. **Room move** — admin moves guest 203→201; both rooms' history
   records updated; future availability for 201 is reduced.
8. **Room out-of-order** — admin marks 201 OOO; availability for
   Deluxe is reduced by 1; assignment check rejects 201.
9. **Partial payment** — guest pays 4000 of 12000, reservation is
   `CONFIRMED` with `amountDue = 8000`.
10. **Failed payment** — Razorpay webhook `payment.failed`; reservation
    stays `HELD` until hold expires (no silent reversion).
11. **Check-in / check-out transition** — `CONFIRMED → CHECKED_IN →
    CHECKED_OUT`; housekeeping task auto-created on checkout; room
    status transitions to `CLEANING` then `READY`.
12. **Permission denial** — `RECEPTION` calls `POST /api/admin/staff`;
    response `403` with `missing: ['STAFF_CREATE']` — even if the
    client-side UI hid the button.

Additional coverage: rate-limit triggers, CSRF on missing/invalid
token, webhooks idempotency, hold re-creation on same session, audit
log `before/after` on every mutation, search perf at 100k reservations.

---

## 21. Seed data (initial)

- 1 Resort: `Sun & Water Resort` (Pithoragarh, Uttarakhand, India)
- 1 Owner: `owner@sunandwaterresort.com` (configurable password)
- 5 default roles: `OWNER`, `MANAGER`, `RECEPTION`, `MARKETING`,
  `HOUSEKEEPING` with permission bundles per §8.2
- Room types matching the website mockup: Deluxe, Premium, Family
  Suite, Luxury Cottage
- ~18 physical rooms (10 Deluxe / 4 Premium / 2 Family / 2 Cottage)
- Amenities: `wifi`, `ac`, `tv`, `pool`, `restaurant`, `parking`,
  `room_service`, `balcony`
- One default hero, one about page, one offers page seed
- 6 reviews (3 GOOGLE, 3 DIRECT)
- 4 nearby attractions
- Settings: check-in 14:00, check-out 11:00, hold 10m, GST 12%

---

## 22. Milestones (build order)

1. **Foundation** — Prisma schema + migrations + seed. Env config.
   Auth (login, refresh, logout, password reset). CSRF. Rate limit.
   Health/metrics. Error handler. Request ID. Audit service.
2. **RBAC** — Permission keys, default roles, middleware,
   `withResortScope`, admin endpoints to manage staff + roles.
3. **Inventory** — Room types, physical rooms, amenities, photos,
   maintenance records, room rates, pricing rules, rate plans.
4. **Availability engine** — `availabilityService` with the SQL/CTE
   approach, public `/availability` endpoint, admin room status board.
5. **Reservations v1** — HELD via separate `ReservationHold` table;
   `PENDING → HELD → CONFIRMED` with no payment (admin confirm).
   Conflict detection. BullMQ hold-expiry job.
6. **Payments** — Razorpay integration, webhooks, manual recording,
   partial payment, refunds. Idempotency on `providerPaymentId`.
7. **Admin reservations** — list/filter, detail page, assign room,
   move room, cancel, extend, late checkout. Audit log on every
   mutation. WebSocket fanout.
8. **Housekeeping & maintenance** — board, task CRUD, auto-creation
   on checkout, OOO flow.
9. **Enquiries** — public form, WA intake via webhook, admin
   convert-to-reservation.
10. **Offers & pricing** — base rates, rules, rate plans, offers
    CRUD, public display.
11. **CMS** — sections (hero, footer, contact), pages, gallery,
    reviews, attractions, amenity sections. Cloudinary upload.
12. **Reports + audit + notifications** — dashboard summary,
    revenue/occupancy/source reports, audit log viewer, full
    notification dispatcher (4 channels).
13. **Settings + final polish** — settings editor, realtime polish,
    empty/loading/error states, mobile responsive, OpenAPI docs,
    deployment runbook, performance pass.

---

## 23. Open questions

1. **Multi-tenancy is now built in** — every table has `resortId`,
   every query scoped. If you only want one resort forever, the
   overhead is minimal (one FK per table). OK to keep?
2. **Guest accounts in v1?** — currently guests look up by
   `bookingReference + phone`. Add `Guest.passwordHash` + magic-link
   login in v2.
3. **OTA channels** — Booking.com / MMT / Airbnb not modeled. Add
   `OtaChannel` + `Reservation.externalRef` + a sync job when needed.
4. **Rate plans** — model exists (`RatePlan` table) but not wired into
   the public flow yet. v1 prices are `RoomType.basePrice` (or
   `RoomRate` override for date ranges) with `PricingRule` adjustments.
   Wire rate plans in v2.
5. **PMS-grade features** (group bookings, allotment, overbooking
   rules, city ledger, AR) — out of scope for v1.
6. **Multi-currency** — store paise, display INR. Flip a config to
   support USD/EUR (no schema change).
7. **Housekeeping native mobile** — v1 web is responsive; native
   comes later.
8. **Reporting depth** — v1 = direct SQL aggregates. Star schema +
   materialized views is a v2 problem.

---

*End of v2 spec. The next step when you green-light is implementation
in the milestone order above. The first three milestones give you a
runnable backend with auth, RBAC, and inventory — everything else
builds on top.*
