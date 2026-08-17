# Sun & Water Resort — Backend Specification

> **v1.0** · single-tenant, multi-tenant-ready.
> The backend is the **single source of truth** for both the public website
> and the admin dashboard (frontend spec §72). Every section of the frontend
> spec maps to an endpoint or job here.

---

## 0. Design principles

1. **Server-side authority.** The frontend never decides availability, pricing,
   conflicts, or permissions. It asks, the backend decides.
2. **Single inventory model.** Website bookings, walk-ins, phone bookings,
   WhatsApp conversions, and extensions all read/write the same tables.
3. **State machine, not free-form status.** Bookings and rooms move through
   explicit states. Invalid transitions are rejected with `409 Conflict`.
4. **Permission keys, not role checks.** Code checks `can('booking.cancel')`,
   never `if (role === 'Manager')`.
5. **Holds are time-bounded, not promises.** A hold is a row with `expires_at`
   that the system can revoke.
6. **Money is integer paise.** No floats. `Intl.NumberFormat` for display.
7. **All timestamps UTC in DB; render in Asia/Kolkata.**
8. **Soft-delete by `deleted_at`** for guest-facing content (offers, gallery,
   testimonials) so the admin can recover and audit.

---

## 1. Tech stack

| Layer            | Choice                                    | Why                                                              |
| ---------------- | ----------------------------------------- | ---------------------------------------------------------------- |
| Runtime          | Node.js 20 LTS                            | Already in Feast & Shopure                                       |
| Language         | TypeScript 5.x (`strict: true`)           | Type safety across modules                                       |
| Framework        | Express 4                                 | Battle-tested, easy middleware, plays well with BullMQ           |
| Database         | **PostgreSQL 16**                         | Relational integrity for inventory; JSONB for CMS; transactions  |
| ORM              | Prisma 5                                  | Migrations, type-safe queries, great DX                          |
| Cache + Pub/Sub  | Redis 7                                   | Hold expiry, rate limits, session cache, real-time fanout        |
| Queue            | BullMQ                                    | Hold expiry, email, WhatsApp, exports, webhooks                  |
| Auth             | JWT (access 15 min + refresh 30 days)     | Stateless; refresh rotation                                      |
| Validation       | Zod                                       | Schemas drive types + runtime validation                         |
| Payments         | Razorpay                                  | Already in stack; UPI/cards/netbanking/refunds                   |
| File storage     | Cloudinary                                | Already in Shopure; CDN + on-the-fly transforms                  |
| Email            | Nodemailer + SMTP                         | Templates, attachments                                           |
| WhatsApp         | Meta Cloud API (or Wati)                  | Enquiry intake + outbound notifications                          |
| Real-time        | Socket.IO                                 | Admin dashboard live updates (new booking, room status)          |
| Logging          | Pino → stdout (Loki later)                | Structured JSON                                                  |
| Error tracking   | Sentry (optional)                         | Exception capture                                                |
| Testing          | Vitest + Supertest                        | Unit + integration                                               |

> **Why PostgreSQL over MongoDB here:** Inventory is the heart of this product
> and it's inherently relational (room types ⇄ physical rooms ⇄ bookings ⇄
> payments ⇄ extensions). You need `SELECT ... FOR UPDATE` to prevent two
> guests from booking the last room. JSONB still gives you the schema-less
> flexibility for CMS.

---

## 2. High-level architecture

```
                       ┌──────────────────────────┐
                       │   Public Website (FE)    │
                       │   /api/v1/public/*       │
                       └────────────┬─────────────┘
                                    │
                                    │  HTTPS (JSON)
                                    │
┌───────────────────┐    ┌──────────▼──────────┐    ┌──────────────────────┐
│  Admin Dashboard  │◄──►│   Express API       │◄──►│  PostgreSQL          │
│  /api/v1/admin/*  │    │   (TS)              │    │  (single source)     │
│  Socket.IO        │    │                     │    └──────────┬───────────┘
└───────────────────┘    │   ┌─────────────┐   │               │
        ▲               │   │   BullMQ    │   │               │
        │               │   │   workers   │◄──┼───────────────┘
        │               │   └──────┬──────┘   │
        │               │          │          │
        │               │   ┌──────▼──────┐   │
        └───────────────┼──►│   Redis     │   │
        (real-time)     │   │  (cache +   │   │
                        │   │   pubsub)   │   │
                        │   └─────────────┘   │
                        │                     │
                        │   ┌─────────────┐   │
                        └──►│ Razorpay    │   │
                            │ Cloudinary  │   │
                            │ Meta WA API │   │
                            └─────────────┘   │
                                              │
                            All secrets in    │
                            env / Vault       │
                            └──────────────────┘
```

---

## 3. Project layout

```
backend/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── config/                 # env, db, redis, queues
│   ├── lib/                    # date, money, slug, errors
│   ├── middleware/             # auth, permission, validate, error
│   ├── modules/
│   │   ├── auth/               # login, refresh, logout, password reset
│   │   ├── rbac/               # roles, permissions, seed
│   │   ├── rooms/              # room types, physical rooms, amenities
│   │   ├── inventory/          # availability engine
│   │   ├── bookings/           # lifecycle, holds, extensions
│   │   ├── payments/           # razorpay, refunds
│   │   ├── guests/             # customer profiles
│   │   ├── enquiries/          # WhatsApp + contact form
│   │   ├── pricing/            # base rates, rules, offers
│   │   ├── housekeeping/       # status board, tasks
│   │   ├── maintenance/        # out-of-order
│   │   ├── cms/                # pages, sections
│   │   ├── gallery/            # images, categories
│   │   ├── testimonials/       # reviews
│   │   ├── nearby/             # attractions
│   │   ├── reports/            # analytics queries
│   │   ├── notifications/      # in-app, email, WhatsApp
│   │   ├── activity/           # audit log
│   │   └── settings/           # resort config
│   ├── jobs/                   # bullmq workers
│   ├── realtime/               # socket.io setup
│   ├── routes.ts               # mounts /v1/public + /v1/admin
│   ├── server.ts               # express bootstrap
│   └── worker.ts               # bullmq bootstrap
├── tests/
├── .env.example
├── package.json
└── tsconfig.json
```

---

## 4. Database schema (Prisma)

> Naming: `snake_case` in DB, `camelCase` in TS. Use `@map` + `@@map`.

```prisma
// ─── Identity & access ──────────────────────────────────────────────

model Staff {
  id              String           @id @default(cuid())
  email           String           @unique
  phone           String?
  passwordHash    String
  name            String
  roleId          String
  role            Role             @relation(fields: [roleId], references: [id])
  status          StaffStatus      @default(ACTIVE)
  lastLoginAt     DateTime?
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
  sessions        StaffSession[]
  activities      ActivityLog[]
  housekeepingTasks HousekeepingTask[] @relation("AssignedTo")
  enquiriesAssigned Enquiry[]      @relation("AssignedStaff")
  bookingsCreated Booking[]        @relation("CreatedBy")
  notes           BookingNote[]

  @@index([roleId, status])
}

enum StaffStatus { ACTIVE SUSPENDED INACTIVE }

model StaffSession {
  id              String   @id @default(cuid())
  staffId         String
  staff           Staff    @relation(fields: [staffId], references: [id], onDelete: Cascade)
  refreshTokenHash String  @unique
  userAgent       String?
  ip              String?
  expiresAt       DateTime
  revokedAt       DateTime?
  createdAt       DateTime @default(now())

  @@index([staffId, expiresAt])
}

model PasswordReset {
  id          String   @id @default(cuid())
  staffId     String
  tokenHash   String   @unique
  expiresAt   DateTime
  usedAt      DateTime?
  createdAt   DateTime @default(now())
}

model Role {
  id          String           @id @default(cuid())
  key         String           @unique   // 'owner', 'manager', 'reception', 'marketing', 'housekeeping'
  name        String
  description String?
  isSystem    Boolean          @default(false)  // system roles cannot be deleted
  permissions RolePermission[]
  staff       Staff[]

  @@index([key])
}

model Permission {
  id    String   @id @default(cuid())
  key   String   @unique   // 'booking.cancel', 'room.edit', ...
  group String                // 'bookings', 'rooms', 'cms', ...
  description String?
  roles RolePermission[]
}

model RolePermission {
  roleId       String
  permissionId String
  role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([roleId, permissionId])
}

// ─── Public customers ───────────────────────────────────────────────

model Guest {
  id          String    @id @default(cuid())
  fullName    String
  email       String?
  phone       String    // primary lookup key
  countryCode String    @default("+91")
  idType      String?   // 'aadhaar', 'passport', etc.
  idNumber    String?
  notes       String?   // staff-only
  preferences Json?     // {roomView, dietary, pillow, ...}
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  bookings    Booking[]

  @@unique([phone, countryCode])
  @@index([email])
  @@index([fullName])
}

// ─── Rooms & inventory ──────────────────────────────────────────────

model RoomType {
  id            String   @id @default(cuid())
  slug          String   @unique   // 'deluxe-room'
  name          String
  description   String?
  shortDesc     String?
  basePrice     Int      // paise
  maxGuests     Int
  maxAdults     Int
  maxChildren   Int      @default(0)
  bedConfig     String?  // '1 King', '2 Double', ...
  sizeSqft      Int?
  view          String?  // 'garden', 'mountain', 'pool'
  amenities     RoomTypeAmenity[]
  photos        RoomTypePhoto[]
  rooms         Room[]
  isPublished   Boolean  @default(true)
  displayOrder  Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  deletedAt     DateTime?
}

model Room {
  id            String        @id @default(cuid())
  roomNumber    String        @unique   // '201', 'Cottage-3'
  roomTypeId    String
  roomType      RoomType      @relation(fields: [roomTypeId], references: [id])
  floor         String?
  building      String?
  status        RoomStatus    @default(READY)
  notes         String?
  photos        RoomPhoto[]
  isActive      Boolean       @default(true)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  @@index([roomTypeId, status])
}

enum RoomStatus {
  READY          // clean and ready
  OCCUPIED       // guest is in the room
  CLEANING       // housekeeper in progress
  MAINTENANCE    // active maintenance, not bookable but not removed
  OUT_OF_ORDER   // cannot be sold; excluded from inventory
}

model RoomMaintenance {
  id              String   @id @default(cuid())
  roomId          String
  reason          String
  description     String?
  expectedReadyAt DateTime?
  openedAt        DateTime @default(now())
  closedAt        DateTime?
  openedById      String

  @@index([roomId, closedAt])
}

model Amenity {
  id      String  @id @default(cuid())
  key     String  @unique   // 'wifi', 'pool', 'ac'
  name    String
  icon    String? // lucide icon name
  category String?
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
  id          String   @id @default(cuid())
  roomTypeId  String
  url         String
  publicId    String   // cloudinary
  alt         String?
  isCover     Boolean  @default(false)
  displayOrder Int     @default(0)
  roomType    RoomType @relation(fields: [roomTypeId], references: [id], onDelete: Cascade)
}

model RoomPhoto {
  id        String  @id @default(cuid())
  roomId    String
  url       String
  publicId  String
  alt       String?
  isCover   Boolean @default(false)
  displayOrder Int  @default(0)
  room      Room    @relation(fields: [roomId], references: [id], onDelete: Cascade)
}

// ─── Bookings ───────────────────────────────────────────────────────

enum BookingStatus {
  DRAFT          // cart started, no hold yet
  HELD           // inventory temporarily reserved, awaiting payment
  PENDING        // enquiry-style; staff approval needed
  CONFIRMED      // payment cleared OR manually confirmed
  CHECKED_IN
  CHECKED_OUT
  CANCELLED
  NO_SHOW
  EXPIRED        // hold lapsed without payment
}

enum BookingSource {
  WEBSITE
  WALK_IN
  PHONE
  WHATSAPP
  OTA
  ADMIN          // direct admin creation
}

model Booking {
  id              String           @id @default(cuid())
  shortCode       String           @unique   // #BK1048 — human-friendly
  guestId         String
  guest           Guest            @relation(fields: [guestId], references: [id])
  roomTypeId      String
  roomType        RoomType         @relation(fields: [roomTypeId], references: [id])
  checkIn         DateTime         // date at 00:00 in resort TZ
  checkOut        DateTime
  nights          Int
  adults          Int
  children        Int              @default(0)
  roomsCount      Int              @default(1)

  status          BookingStatus
  source          BookingSource

  // Money (all paise)
  nightlyRate     Int
  subtotal        Int
  discount        Int              @default(0)
  taxAmount       Int              @default(0)
  totalAmount     Int
  amountPaid      Int              @default(0)
  amountDue       Int              @default(0)

  offerId         String?
  offer           Offer?           @relation(fields: [offerId], references: [id])
  promoCode       String?

  specialRequests String?
  arrivalTime     String?          // '14:30' free-form
  internalNotes   String?

  holdExpiresAt   DateTime?        // set when status=HELD
  confirmedAt     DateTime?
  checkedInAt     DateTime?
  checkedOutAt    DateTime?
  cancelledAt     DateTime?
  cancellationReason String?

  createdById     String?
  createdBy       Staff?           @relation("CreatedBy", fields: [createdById], references: [id])

  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  rooms           BookingRoomAssignment[]
  payments        BookingPayment[]
  extensions      BookingExtension[]
  activities      BookingActivity[]
  notes           BookingNote[]

  @@index([status, checkIn])
  @@index([checkIn, checkOut])
  @@index([guestId])
}

model BookingRoomAssignment {
  id         String   @id @default(cuid())
  bookingId  String
  roomId     String
  booking    Booking  @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  room       Room     @relation(fields: [roomId], references: [id])
  assignedAt DateTime @default(now())
  assignedById String?
  releasedAt DateTime?

  @@index([bookingId])
  @@index([roomId, releasedAt])
}

model BookingActivity {
  id        String   @id @default(cuid())
  bookingId String
  booking   Booking  @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  type      String   // 'created', 'confirmed', 'cancelled', 'room_assigned', 'extended', 'moved', ...
  payload   Json?
  actorType String   // 'guest' | 'staff' | 'system'
  actorId   String?  // staffId for staff, null for guest/system
  createdAt DateTime @default(now())

  @@index([bookingId, createdAt])
}

model BookingNote {
  id        String   @id @default(cuid())
  bookingId String
  booking   Booking  @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  authorId  String
  author    Staff    @relation(fields: [authorId], references: [id])
  body      String
  createdAt DateTime @default(now())
}

// ─── Pricing & offers ───────────────────────────────────────────────

model PricingRule {
  id          String   @id @default(cuid())
  roomTypeId  String?
  kind        PricingRuleKind
  // WEEKEND: weeklyDays=[5,6], SEASONAL: date range, HOLIDAY: date list
  daysOfWeek  Int[]    // for WEEKEND
  startDate   DateTime?
  endDate     DateTime?
  // adjustment
  adjustmentType AdjustmentType  // PERCENT | FLAT
  adjustmentValue Int            // percent * 100 (e.g. 1500 = 15%) or paise
  minNights    Int?
  maxNights    Int?
  priority     Int     @default(0)
  active       Boolean @default(true)

  @@index([roomTypeId, kind, active])
}

enum PricingRuleKind { WEEKEND SEASONAL HOLIDAY LAST_MINUTE }
enum AdjustmentType { PERCENT FLAT }

model RatePlan {
  id          String  @id @default(cuid())
  key         String  @unique   // 'standard', 'non_refundable', 'breakfast'
  name        String
  description String?
  // modifier applied to base price
  adjustmentType AdjustmentType
  adjustmentValue Int
  // restrictions
  minNights      Int?
  nonRefundable  Boolean @default(false)
  includesBreakfast Boolean @default(false)
  active         Boolean @default(true)
  displayOrder   Int @default(0)
}

model Offer {
  id              String   @id @default(cuid())
  slug            String   @unique
  name            String
  description     String
  shortDesc       String?
  imageUrl        String?
  discountType    AdjustmentType
  discountValue   Int
  minNights       Int?
  promoCode       String?  @unique
  startDate       DateTime
  endDate         DateTime
  active          Boolean  @default(true)
  terms           String?
  roomTypes       OfferRoomType[]
  bookings        Booking[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?
}

model OfferRoomType {
  offerId    String
  roomTypeId String
  offer      Offer    @relation(fields: [offerId], references: [id], onDelete: Cascade)
  roomType   RoomType @relation(fields: [roomTypeId], references: [id], onDelete: Cascade)

  @@id([offerId, roomTypeId])
}

// ─── Payments ───────────────────────────────────────────────────────

model BookingPayment {
  id              String   @id @default(cuid())
  bookingId       String
  booking         Booking  @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  amount          Int      // paise
  method          PaymentMethod
  status          PaymentStatus
  // razorpay
  razorpayOrderId   String?
  razorpayPaymentId String?
  razorpaySignature String?
  // manual
  reference         String?  // UPI ref, cheque no
  notes             String?
  recordedById      String?  // staff id for manual
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([bookingId, status])
}

enum PaymentMethod { RAZORPAY UPI CASH BANK_TRANSFER CHEQUE CARD OTHER }
enum PaymentStatus { PENDING CAPTURED FAILED REFUNDED PARTIALLY_REFUNDED }

// ─── Extensions ─────────────────────────────────────────────────────

model BookingExtension {
  id              String   @id @default(cuid())
  bookingId       String
  booking         Booking  @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  requestedCheckOut DateTime
  approved        Boolean?
  decisionById    String?
  decisionAt      DateTime?
  decisionNote    String?
  additionalAmount Int?    // paise, if applicable
  createdAt       DateTime @default(now())

  @@index([bookingId])
}

// ─── Enquiries ──────────────────────────────────────────────────────

enum EnquiryStatus { NEW CONTACTED AWAITING_RESPONSE CONVERTED LOST SPAM }
enum EnquirySource { WEBSITE_FORM WHATSAPP PHONE WALK_IN OTHER }

model Enquiry {
  id            String   @id @default(cuid())
  name          String
  phone         String
  email         String?
  requestedCheckIn DateTime?
  requestedCheckOut DateTime?
  adults        Int?
  children      Int?
  roomTypeId    String?
  message       String?
  source        EnquirySource
  status        EnquiryStatus @default(NEW)
  assignedToId  String?
  assignedTo    Staff?   @relation("AssignedStaff", fields: [assignedToId], references: [id])
  convertedBookingId String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  notes         EnquiryNote[]

  @@index([status, createdAt])
}

model EnquiryNote {
  id         String   @id @default(cuid())
  enquiryId  String
  enquiry    Enquiry  @relation(fields: [enquiryId], references: [id], onDelete: Cascade)
  authorId   String
  body       String
  createdAt  DateTime @default(now())
}

// ─── Housekeeping ───────────────────────────────────────────────────

model HousekeepingTask {
  id           String   @id @default(cuid())
  roomId       String
  type         HkTaskType
  status       HkStatus @default(PENDING)
  priority     HkPriority @default(NORMAL)
  bookingId    String?
  notes        String?
  assignedToId String?
  assignedTo   Staff?   @relation("AssignedTo", fields: [assignedToId], references: [id])
  startedAt    DateTime?
  completedAt  DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([roomId, status])
  @@index([status, priority])
}

enum HkTaskType { CHECKOUT_CLEAN TURN_DOWN DEEP_CLEAN INSPECTION TOUCH_UP }
enum HkStatus { PENDING IN_PROGRESS DONE VERIFIED SKIPPED }
enum HkPriority { LOW NORMAL HIGH URGENT }

// ─── CMS / website content ──────────────────────────────────────────

model CmsPage {
  id        String   @id @default(cuid())
  slug      String   @unique   // 'about', 'contact', 'home'
  title     String
  body      Json     // section-based content (JSONB)
  seoTitle  String?
  seoDesc   String?
  ogImage   String?
  published Boolean  @default(true)
  updatedAt DateTime @updatedAt
  updatedById String?
}

model HeroContent {
  id            String  @id @default(cuid())
  headline      String
  subheadline   String?
  imageUrl      String
  imagePublicId String
  primaryCtaLabel String
  primaryCtaHref  String
  secondaryCtaLabel String?
  secondaryCtaHref  String?
  active        Boolean @default(true)
  updatedAt     DateTime @updatedAt
  updatedById   String?
}

model GalleryCategory {
  id    String  @id @default(cuid())
  slug  String  @unique
  name  String
  order Int     @default(0)
  images GalleryImage[]
}

model GalleryImage {
  id          String  @id @default(cuid())
  categoryId  String
  category    GalleryCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  url         String
  publicId    String
  alt         String?
  caption     String?
  displayOrder Int    @default(0)
  isFeatured  Boolean @default(false)
  hidden      Boolean @default(false)
  createdAt   DateTime @default(now())
}

model Testimonial {
  id         String   @id @default(cuid())
  authorName String
  authorAvatar String?
  rating     Int      // 1..5
  body       String
  source     TestimonialSource
  sourceUrl  String?  // e.g. Google review URL
  stayDate   DateTime?
  published  Boolean  @default(false)
  featured   Boolean  @default(false)
  displayOrder Int    @default(0)
  createdAt  DateTime @default(now())
}

enum TestimonialSource { GOOGLE DIRECT WEBSITE TRIPADVISOR BOOKING_COM OTHER }

model NearbyAttraction {
  id          String  @id @default(cuid())
  name        String
  description String?
  imageUrl    String?
  distanceKm  Float?     // <-- admin configures, never invent
  travelTime  String?    // "2h drive"
  category    String?    // 'scenic', 'trek', 'religious'
  mapUrl      String?
  order       Int     @default(0)
  active      Boolean @default(true)
}

model AmenitySection {        // resort-wide amenities (pool, restaurant, ...)
  id      String  @id @default(cuid())
  key     String  @unique
  title   String
  body    String
  icon    String?
  imageUrl String?
  imagePublicId String?
  order   Int     @default(0)
  active  Boolean @default(true)
}

// ─── Settings & misc ────────────────────────────────────────────────

model Setting {
  key   String @id
  value Json
  updatedAt DateTime @updatedAt
  updatedById String?
}

model ActivityLog {
  id        String   @id @default(cuid())
  actorType String   // 'staff' | 'guest' | 'system'
  actorId   String?
  staff     Staff?   @relation(fields: [actorId], references: [id])
  action    String   // 'booking.confirm', 'room.price.update', ...
  entity    String?  // 'booking', 'room_type', ...
  entityId  String?
  payload   Json?
  ip        String?
  userAgent String?
  createdAt DateTime @default(now())

  @@index([entity, entityId, createdAt])
  @@index([actorId, createdAt])
}

model Notification {
  id        String   @id @default(cuid())
  audience  String   // 'owner' | 'role:reception' | 'staff:<id>'
  type      String   // 'new_booking', 'new_enquiry', ...
  title     String
  body      String?
  link      String?
  readAt    DateTime?
  createdAt DateTime @default(now())

  @@index([audience, readAt, createdAt])
}
```

> **Indexes** above cover the hot paths: availability, booking filters,
> enquiry dashboards, activity log lookup. Add more after observing slow
> queries in production.

---

## 5. Availability engine

This is the heart of the product. Two questions:

### 5.1 "How many of room type X are available for [checkIn, checkOut)?"

```sql
-- conceptually (Prisma will generate this):
WITH params AS (
  SELECT $1::date AS ci, $2::date AS co
),
held AS (
  SELECT room_type_id, COUNT(*) AS n
  FROM bookings
  WHERE status IN ('HELD','PENDING','CONFIRMED','CHECKED_IN')
    AND check_in  < (SELECT co FROM params)
    AND check_out > (SELECT ci FROM params)
  GROUP BY room_type_id
),
total AS (
  SELECT id AS room_type_id,
         (SELECT COUNT(*) FROM rooms r
            WHERE r.room_type_id = rt.id
              AND r.is_active = true
              AND r.status <> 'OUT_OF_ORDER') AS n
  FROM room_types rt
  WHERE rt.is_published = true
    AND rt.deleted_at IS NULL
),
maint AS (
  -- rooms out of order for any night in range
  SELECT r.room_type_id, COUNT(DISTINCT r.id) AS n
  FROM rooms r
  JOIN room_maintenance m ON m.room_id = r.id AND m.closed_at IS NULL
  WHERE m.opened_at < (SELECT co FROM params)
    AND (m.expected_ready_at IS NULL OR m.expected_ready_at > (SELECT ci FROM params))
  GROUP BY r.room_type_id
)
SELECT t.room_type_id,
       t.n - COALESCE(h.n, 0) - COALESCE(m.n, 0) AS available
FROM total t
LEFT JOIN held  h ON h.room_type_id = t.room_type_id
LEFT JOIN maint m ON m.room_type_id = t.room_type_id;
```

**Rules:**

- Date ranges are **half-open** `[checkIn, checkOut)` — a guest checking
  out Aug 18 does not block a guest checking in Aug 18.
- `HELD` bookings count as occupied inventory. Holds are not optional.
- `OUT_OF_ORDER` rooms are subtracted from the total.
- `MAINTENANCE` rooms are **not** subtracted (they're bookable when work
  finishes) — but a `RoomMaintenance` row with `closedAt IS NULL` covering
  the range excludes the room (see `maint` CTE).
- `CANCELLED`, `EXPIRED`, `NO_SHOW` (after cutoff) do not count.
- All queries run inside a transaction with `SERIALIZABLE` isolation when
  the operation can mutate inventory (create hold, confirm booking).

### 5.2 "Can a specific physical room be assigned for [checkIn, checkOut)?"

```sql
SELECT 1
FROM rooms r
WHERE r.id = $1
  AND r.is_active = true
  AND r.status NOT IN ('OUT_OF_ORDER','MAINTENANCE')
  AND NOT EXISTS (
    SELECT 1 FROM booking_room_assignments a
    JOIN bookings b ON b.id = a.booking_id
    WHERE a.room_id = r.id
      AND a.released_at IS NULL
      AND b.status IN ('CONFIRMED','CHECKED_IN')
      AND b.check_in  < $3::date   -- co
      AND b.check_out > $2::date   -- ci
  )
  AND NOT EXISTS (
    SELECT 1 FROM room_maintenance m
    WHERE m.room_id = r.id
      AND m.closed_at IS NULL
      AND m.opened_at < $3::date
      AND (m.expected_ready_at IS NULL OR m.expected_ready_at > $2::date)
  );
```

### 5.3 Endpoint

```
GET /api/v1/public/availability
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
      "available": 3,                 // ← from engine
      "soldOut": false,
      "nightlyRate": 450000,           // paise
      "totalForStay": 1350000
    },
    {
      "id": "...", "slug": "premium-room", ...,
      "available": 0, "soldOut": true
    }
  ]
}
```

### 5.4 Caching

Availability responses are **not cached long-term** because they change on
every booking. Use a 10–30s in-memory LRU keyed by query string for the
public search; the source of truth is always PostgreSQL.

---

## 6. Booking lifecycle

### 6.1 States

```
                ┌──────┐
                │ DRAFT│   (cart in session; no inventory touched)
                └──┬───┘
                   │  begin checkout
                   ▼
                ┌──────┐
        ┌──────►│ HELD │  (inventory reserved, expires_at = now + 10m)
        │       └──┬───┘
   hold  │          │ payment success / manual confirm
   reset │          ▼
        │       ┌──────────┐
        └───────┤ PENDING  │ (enquiry flow, staff approval needed)
                └────┬─────┘
                     │ approved
                     ▼
                ┌──────────┐
                │ CONFIRMED│
                └────┬─────┘
                     │ check-in
                     ▼
                ┌───────────┐
                │ CHECKED_IN│
                └────┬──────┘
                     │ check-out
                     ▼
                ┌───────────┐
                │CHECKED_OUT│  → housekeeping auto-creates CHECKOUT_CLEAN task
                └───────────┘

  Any state ──cancel──► CANCELLED
  HELD + 10m ─────────► EXPIRED (system)
  CONFIRMED + no show + cutoff ─► NO_SHOW
```

### 6.2 Transitions (server-enforced)

| From        | Event              | To            | Pre-conditions                                                                  |
| ----------- | ------------------ | ------------- | ------------------------------------------------------------------------------- |
| DRAFT       | `beginCheckout`    | HELD          | Inventory check; create hold row                                                 |
| HELD        | `pay` / `confirm`  | CONFIRMED     | Payment captured (or admin override)                                            |
| HELD        | `expire`           | EXPIRED       | BullMQ cron after `holdExpiresAt`                                              |
| HELD/PENDING/CONFIRMED | `cancel`  | CANCELLED     | Permission + cancellation policy (window)                                       |
| PENDING     | `approve`          | CONFIRMED     | Permission                                                                       |
| CONFIRMED   | `checkIn`          | CHECKED_IN    | Assignment exists; permission                                                   |
| CHECKED_IN  | `checkOut`         | CHECKED_OUT   | Permission; balance = 0 (configurable)                                          |
| CONFIRMED/CHECKED_IN | `extend`     | (same)        | Extension row created → if approved, `checkOut` extended                        |

### 6.3 Soft holds

```ts
// POST /api/v1/public/bookings/hold
{
  "roomTypeId": "...",
  "checkIn": "2026-08-15",
  "checkOut": "2026-08-18",
  "rooms": 1
}

// → 201
{
  "holdId": "hld_...",
  "expiresAt": "2026-08-12T12:42:00Z",
  "secondsLeft": 600,
  "pricing": { "nightlyRate": 450000, "subtotal": 1350000, "tax": 0, "total": 1350000 }
}
```

- Hold = a `Booking` row with `status = HELD` and `holdExpiresAt = now + 10m`.
- The public search engine (§5) treats HELD rows as occupied.
- A BullMQ delayed job releases the hold when it expires (delete hold, set
  status=EXPIRED, free inventory).
- Re-hitting `beginCheckout` for the same session resets `holdExpiresAt`
  and reuses the existing row.

### 6.4 Conflict detection (every mutating endpoint)

Before any booking write (confirm, extend, move, assign), call:

```ts
// returns { ok: true } or { ok: false, conflicts: [...] }
async function detectConflicts({
  bookingId, roomTypeId, roomId?, checkIn, checkOut, excludeSelf = true,
}): Promise<ConflictReport>
```

Conflicts returned:
- `inventory_unavailable` — not enough units in room type
- `room_unavailable` — physical room is occupied/OOO in range
- `extension_overlap` — same booking already has a pending extension
- `maintenance_active` — room is under maintenance
- `policy_violation` — min/max stay, children policy, etc.

Frontend renders these with §24's states (Booking conflict, Sold out, etc).

### 6.5 Extension flow

```
guest (or staff) → POST /bookings/:id/extension { newCheckOut }
  ├─ conflict check (room type + physical room availability for extended range)
  ├─ recompute price (add nights × rate)
  ├─ create BookingExtension row (approved=null)
  └─ notify reception

staff → POST /bookings/:id/extension/decision { approved: true|false, note? }
  ├─ if approved: update Booking.checkOut, update assignment, recompute totals,
  │   create new payment intent for additionalAmount
  └─ if rejected: just mark row, notify guest
```

---

## 7. RBAC

### 7.1 Permission keys

```ts
// src/modules/rbac/permissions.ts
export const PERMISSIONS = {
  // bookings
  'booking.view',
  'booking.create',
  'booking.create_walkin',
  'booking.create_phone',
  'booking.modify',
  'booking.cancel',
  'booking.confirm',
  'booking.checkin',
  'booking.checkout',
  'booking.extend',
  'booking.move_room',
  'booking.assign_room',
  'booking.refund',
  'booking.export',

  // guests
  'guest.view',
  'guest.edit',
  'guest.export',

  // enquiries
  'enquiry.view',
  'enquiry.create',
  'enquiry.assign',
  'enquiry.convert',
  'enquiry.delete',

  // rooms
  'room_type.view',
  'room_type.edit',
  'room_type.publish',
  'room.view',
  'room.edit',
  'room.maintenance',

  // pricing
  'pricing.view',
  'pricing.edit',
  'rate_plan.edit',
  'offer.view',
  'offer.edit',
  'offer.publish',

  // housekeeping
  'hk.view',
  'hk.assign',
  'hk.update',
  'hk.create_task',

  // reports
  'report.view',
  'report.export',

  // CMS
  'cms.hero.edit',
  'cms.page.edit',
  'cms.gallery.edit',
  'cms.gallery.upload',
  'cms.testimonial.edit',
  'cms.attraction.edit',
  'cms.amenity.edit',

  // staff
  'staff.view',
  'staff.create',
  'staff.edit',
  'staff.suspend',
  'rbac.edit',

  // system
  'settings.edit',
  'activity_log.view',
  'notification.broadcast',
} as const;
```

### 7.2 Default roles

| Role          | Holds                                                                                  |
| ------------- | -------------------------------------------------------------------------------------- |
| Owner         | ALL                                                                                    |
| Manager       | all bookings, all rooms, all pricing, housekeeping, reports, settings, NO rbac/staff   |
| Reception     | booking.* (no refund), guest.*, enquiry.*, room_type.view, room.view, hk.view         |
| Marketing     | cms.*, offer.*, rate_plan.view, report.view                                            |
| Housekeeping  | hk.*, room.view, room.maintenance                                                      |

### 7.3 Middleware

```ts
router.post('/bookings/:id/cancel',
  auth(),
  require('booking.cancel'),         // 403 if missing
  validate(bookingCancelSchema),
  bookingController.cancel
);
```

`require(key)` reads the request's `staff.role.permissions`, returns 403
with a list of missing keys if absent.

---

## 8. API surface

> All routes are prefixed with `/api/v1`. Public and admin are mounted
> separately so we can apply different rate limits, CORS, and audit
> policies.

### 8.1 Public (no auth)

| Method | Path                                | Notes                                              |
| ------ | ----------------------------------- | -------------------------------------------------- |
| GET    | `/public/content/hero`              | Active hero                                        |
| GET    | `/public/content/pages/:slug`       | CmsPage                                            |
| GET    | `/public/content/amenities`         | Resort-wide amenity sections                       |
| GET    | `/public/content/testimonials`      | Published + featured                               |
| GET    | `/public/content/attractions`       | Active nearby places                               |
| GET    | `/public/rooms`                     | Published room types with cover photo              |
| GET    | `/public/rooms/:slug`               | Room type detail + photos + amenities              |
| GET    | `/public/offers`                    | Active offers in date range                        |
| GET    | `/public/offers/:slug`              | Offer detail                                       |
| GET    | `/public/gallery`                   | Grouped by category                                |
| GET    | `/public/availability`              | §5.3                                               |
| POST   | `/public/enquiries`                 | Contact form / WhatsApp lead                       |
| POST   | `/public/bookings/hold`             | §6.3                                               |
| GET    | `/public/bookings/hold/:holdId`     | Poll hold status                                   |
| POST   | `/public/bookings/hold/:holdId/pay` | Begin Razorpay checkout                            |
| POST   | `/public/bookings/hold/:holdId/cancel` | Release hold early                               |
| GET    | `/public/bookings/lookup`           | `?id=BK1048&phone=...` (idempotent lookup)          |
| POST   | `/public/bookings/:id/cancel`       | Self-service cancel (token in URL)                 |
| POST   | `/public/bookings/:id/extension-request` | Guest asks to extend                            |
| POST   | `/public/webhooks/razorpay`         | HMAC-verified                                      |
| POST   | `/public/webhooks/whatsapp`         | Meta Cloud API (enquiry intake)                    |

### 8.2 Admin (auth required)

| Method | Path                                  | Permission             |
| ------ | ------------------------------------- | ---------------------- |
| POST   | `/admin/auth/login`                   | —                      |
| POST   | `/admin/auth/refresh`                 | —                      |
| POST   | `/admin/auth/logout`                  | —                      |
| POST   | `/admin/auth/password-reset/request`  | —                      |
| POST   | `/admin/auth/password-reset/confirm`  | —                      |
| GET    | `/admin/me`                           | —                      |
| GET    | `/admin/dashboard/summary`            | `report.view`          |
| GET    | `/admin/dashboard/occupancy`          | `report.view`          |
| GET    | `/admin/dashboard/today`              | —                      |

Bookings
| GET    | `/admin/bookings`                     | `booking.view`         |
| GET    | `/admin/bookings/:id`                 | `booking.view`         |
| POST   | `/admin/bookings`                     | `booking.create`       |
| PATCH  | `/admin/bookings/:id`                 | `booking.modify`       |
| POST   | `/admin/bookings/:id/confirm`         | `booking.confirm`      |
| POST   | `/admin/bookings/:id/cancel`          | `booking.cancel`       |
| POST   | `/admin/bookings/:id/checkin`         | `booking.checkin`      |
| POST   | `/admin/bookings/:id/checkout`        | `booking.checkout`     |
| POST   | `/admin/bookings/:id/assign-room`     | `booking.assign_room`  |
| POST   | `/admin/bookings/:id/move-room`       | `booking.move_room`    |
| POST   | `/admin/bookings/:id/extensions`      | `booking.extend`       |
| POST   | `/admin/bookings/:id/extensions/:extId/decision` | `booking.extend` |
| GET    | `/admin/bookings/calendar`            | `booking.view`         |
| GET    | `/admin/bookings/export`              | `booking.export`       |

Guests
| GET    | `/admin/guests`                       | `guest.view`           |
| GET    | `/admin/guests/:id`                   | `guest.view`           |
| PATCH  | `/admin/guests/:id`                   | `guest.edit`           |
| GET    | `/admin/guests/:id/bookings`          | `guest.view`           |

Enquiries
| GET    | `/admin/enquiries`                    | `enquiry.view`         |
| GET    | `/admin/enquiries/:id`                | `enquiry.view`         |
| PATCH  | `/admin/enquiries/:id`                | `enquiry.create`       |
| POST   | `/admin/enquiries/:id/convert`        | `enquiry.convert`      |
| POST   | `/admin/enquiries/:id/notes`          | `enquiry.view`         |

Rooms
| GET    `/admin/room-types`                  | `room_type.view`       |
| POST   `/admin/room-types`                  | `room_type.edit`       |
| PATCH  `/admin/room-types/:id`              | `room_type.edit`       |
| POST   `/admin/room-types/:id/publish`      | `room_type.publish`    |
| GET    `/admin/rooms`                       | `room.view`            |
| POST   `/admin/rooms`                       | `room.edit`            |
| PATCH  `/admin/rooms/:id`                   | `room.edit`            |
| POST   `/admin/rooms/:id/maintenance`       | `room.maintenance`     |
| POST   `/admin/rooms/:id/maintenance/close` | `room.maintenance`     |

Pricing & offers
| GET    `/admin/pricing/rules`               | `pricing.view`         |
| POST   `/admin/pricing/rules`               | `pricing.edit`         |
| PATCH  `/admin/pricing/rules/:id`           | `pricing.edit`         |
| GET    `/admin/rate-plans`                  | `pricing.view`         |
| POST   `/admin/rate-plans`                  | `rate_plan.edit`       |
| GET    `/admin/offers`                      | `offer.view`           |
| POST   `/admin/offers`                      | `offer.edit`           |
| PATCH  `/admin/offers/:id`                  | `offer.edit`           |
| POST   `/admin/offers/:id/publish`          | `offer.publish`        |

Housekeeping
| GET    `/admin/housekeeping/board`          | `hk.view`              |
| GET    `/admin/housekeeping/tasks`          | `hk.view`              |
| POST   `/admin/housekeeping/tasks`          | `hk.create_task`       |
| PATCH  `/admin/housekeeping/tasks/:id`      | `hk.update`            |
| POST   `/admin/housekeeping/tasks/:id/assign` | `hk.assign`          |

CMS
| GET    `/admin/cms/hero`                    | —                      |
| PUT    `/admin/cms/hero`                    | `cms.hero.edit`        |
| GET    `/admin/cms/pages`                   | `cms.page.edit`        |
| GET    `/admin/cms/pages/:slug`             | `cms.page.edit`        |
| PUT    `/admin/cms/pages/:slug`             | `cms.page.edit`        |
| GET    `/admin/cms/gallery/categories`      | `cms.gallery.edit`     |
| POST   `/admin/cms/gallery/categories`      | `cms.gallery.edit`     |
| GET    `/admin/cms/gallery/images`          | `cms.gallery.edit`     |
| POST   `/admin/cms/gallery/images`          | `cms.gallery.upload`   |
| PATCH  `/admin/cms/gallery/images/:id`      | `cms.gallery.edit`     |
| DELETE `/admin/cms/gallery/images/:id`      | `cms.gallery.edit`     |
| GET    `/admin/cms/testimonials`            | `cms.testimonial.edit` |
| POST   `/admin/cms/testimonials`            | `cms.testimonial.edit` |
| PATCH  `/admin/cms/testimonials/:id`        | `cms.testimonial.edit` |
| GET    `/admin/cms/attractions`             | `cms.attraction.edit`  |
| POST   `/admin/cms/attractions`             | `cms.attraction.edit`  |
| GET    `/admin/cms/amenities`               | `cms.amenity.edit`     |
| POST   `/admin/cms/amenities`               | `cms.amenity.edit`     |

Reports
| GET    `/admin/reports/revenue`             | `report.view`          |
| GET    `/admin/reports/occupancy`           | `report.view`          |
| GET    `/admin/reports/bookings`            | `report.view`          |
| GET    `/admin/reports/sources`             | `report.view`          |
| GET    `/admin/reports/room-performance`    | `report.view`          |
| GET    `/admin/reports/export`              | `report.export`        |

Staff & RBAC
| GET    `/admin/staff`                       | `staff.view`           |
| POST   `/admin/staff`                       | `staff.create`         |
| PATCH  `/admin/staff/:id`                   | `staff.edit`           |
| POST   `/admin/staff/:id/suspend`           | `staff.suspend`        |
| GET    `/admin/roles`                       | `rbac.edit`            |
| PUT    `/admin/roles/:key/permissions`      | `rbac.edit`            |

Settings & logs
| GET    `/admin/settings`                    | —                      |
| PUT    `/admin/settings`                    | `settings.edit`        |
| GET    `/admin/activity-log`                | `activity_log.view`    |
| GET    `/admin/notifications`               | —                      |
| POST   `/admin/notifications/:id/read`      | —                      |
| GET    `/admin/search`                      | —                      |

### 8.3 Conventions

- All requests/responses are JSON.
- Errors: `{ "error": { "code": "BOOKING_CONFLICT", "message": "...", "details": {...} } }`
- IDs are CUIDs in URLs, `shortCode` (`#BK1048`) in copy.
- Dates: ISO 8601 with timezone (server returns UTC, frontend renders Asia/Kolkata).
- Money: integer paise, currency code in `X-Currency` header (default `INR`).
- Pagination: `?cursor=...&limit=20`, response includes `nextCursor`.
- All admin mutations emit to Socket.IO namespace `/admin` and write `ActivityLog`.

---

## 9. Payment flow

### 9.1 Online (Razorpay)

```
client: POST /public/bookings/hold/:id/pay
  → server: create Razorpay order (amount = total)
  → respond: { razorpayOrderId, key, amount, currency }

client: opens Razorpay checkout
  → on success: client calls POST /public/bookings/hold/:id/verify
       { razorpayOrderId, razorpayPaymentId, razorpaySignature }

server:
  - HMAC verify signature
  - in a transaction:
      - find HELD booking
      - mark CONFIRMED
      - create BookingPayment (CAPTURED)
      - update amountPaid, amountDue
  - emit socket event
  - enqueue email + WhatsApp confirmation
```

The webhook (`/public/webhooks/razorpay`) handles async events
(`payment.captured`, `refund.processed`, `payment.failed`) for cases where
the client never returns (network drop, refresh). Idempotent on
`razorpayPaymentId`.

### 9.2 Manual

Reception can record `BookingPayment` directly (`method = CASH | BANK_TRANSFER | UPI | CHEQUE | CARD`). No Razorpay.

### 9.3 Partial payment

Supported: `amountPaid` < `totalAmount`, `amountDue = total - paid`.
Booking can be in `CONFIRMED` with `amountDue > 0` if admin allows it
(setting `booking.allowPendingBalance = true`).

### 9.4 Refunds

`POST /admin/bookings/:id/refund` → creates a Razorpay refund if payment
was online, or a manual `BookingPayment` with `method=REFUND` and a
negative `amount`. Status = `REFUNDED` or `PARTIALLY_REFUNDED`.

---

## 10. CMS

### 10.1 Hero

`HeroContent` is a **singleton** (one active row). The admin hero editor
maps to `PUT /admin/cms/hero`.

### 10.2 Pages

`CmsPage` is **slug-keyed**. `body` is a JSONB doc with sections:

```json
{
  "sections": [
    { "type": "hero", "headline": "Our Story", "image": "..." },
    { "type": "paragraph", "html": "<p>...</p>" },
    { "type": "stats", "items": [{ "label": "Acres", "value": "12" }] },
    { "type": "image_grid", "columns": 3, "images": ["id1","id2"] }
  ]
}
```

A small set of section types lives in the codebase; admins compose
pages from them. No arbitrary HTML injection.

### 10.3 Gallery

Categories: Resort, Rooms, Pool, Restaurant, Events, Surroundings,
Experiences. Drag-and-drop reorder via `displayOrder` int.

### 10.4 Testimonials

Source enum disambiguates Google vs Direct. **The UI never auto-renders
a "Google review" badge unless `source = GOOGLE` AND `sourceUrl` is set.**
A manually-added review renders as "Verified guest" or stays anonymous
by design.

---

## 11. Housekeeping

```
columns:  DIRTY (checkout_clean pending) | CLEANING | READY | OCCUPIED | MAINTENANCE
rows:     every active Room
```

- On `CHECKED_OUT`, the system creates a `HousekeepingTask` (`CHECKOUT_CLEAN`,
  `PENDING`) for the assigned room.
- Housekeeper scans/clicks the room card → `PATCH /housekeeping/tasks/:id`
  with `status: IN_PROGRESS` → `DONE`.
- When `DONE` and the room's previous status was `OCCUPIED`, the room
  auto-transitions to `READY`.
- `MAINTENANCE` and `OUT_OF_ORDER` exclude the room from bookable
  inventory (§5).

Statuses are derived in the read query from the latest task + the room's
`status` field, so the board is always consistent.

---

## 12. Maintenance / out-of-order

`POST /admin/rooms/:id/maintenance` opens a `RoomMaintenance` row.

- `expectedReadyAt` may be null (indefinite).
- Rooms with an open maintenance row covering the search range are
  excluded from availability (§5.1 `maint` CTE).
- `POST /admin/rooms/:id/maintenance/close` sets `closedAt` and reverts
  the room's `status` to `READY` (or whatever the manager selects).

---

## 13. Enquiries

- Web form / WhatsApp / phone all funnel into the same `Enquiry` table.
- `enquiry.convert` opens the booking flow pre-filled (`?enquiryId=...`)
  and creates a `Booking` with `source = WHATSAPP` (or whatever).
  `Enquiry.convertedBookingId` is set.
- Auto-assignment: round-robin among staff with `enquiry.view` permission,
  or unassigned for a manager to triage.

---

## 14. Reports

All reports are **read queries** over the booking/guest tables with date
filters. No materialized views in v1 — add later if needed.

| Report              | What it returns                                                        |
| ------------------- | ---------------------------------------------------------------------- |
| Revenue             | `sum(total) - sum(refunds)` per day/week/month, by room type & source  |
| Occupancy           | `occupied_nights / available_nights` per range                          |
| Bookings            | count by status, source, room type                                     |
| Cancellations       | count + total lost revenue (potential vs captured)                     |
| Sources             | `count(group by source)` + pie                                          |
| Conversion          | `confirmed / (confirmed + cancelled + expired + no_show)`              |
| Avg stay            | `avg(checkOut - checkIn)`                                              |
| Popular room types  | `count(group by room_type_id)`                                         |

All support `?from=YYYY-MM-DD&to=YYYY-MM-DD&granularity=day|week|month`
and JSON or CSV export (`Accept: text/csv` or `?format=csv`).

---

## 15. Activity log

Every admin mutation writes one `ActivityLog` row:

```json
{
  "actorType": "staff",
  "actorId": "stf_...",
  "action": "booking.confirm",
  "entity": "booking",
  "entityId": "bk_...",
  "payload": { "from": "PENDING", "to": "CONFIRMED" },
  "ip": "...",
  "userAgent": "..."
}
```

Retained **forever** for compliance, but hot data is partitioned / archived
after 12 months. Read endpoint paginates newest-first with filters
(`actor`, `action`, `entity`, `date range`).

---

## 16. Notifications

### 16.1 In-app

`Notification` rows with `audience` scoping. Socket.IO namespace `/admin`
emits `notification:new` to the right rooms.

### 16.2 Email

Nodemailer + HTML templates (Handlebars or React Email).

Triggers:
- Booking confirmed → guest
- Booking cancelled → guest
- Check-in reminder (T-1 day) → guest
- Extension approved/rejected → guest
- New enquiry → reception
- New booking (website) → reception
- Payment received → staff + guest

### 16.3 WhatsApp

Outbound via Meta Cloud API (or Wati). Enquiry intake via webhook
(§8.1). Templates pre-approved on Meta.

---

## 17. Settings

`Setting` table is a typed key-value store. Examples:

```
resort.name = "Sun & Water Resort"
resort.phone = "+91 98765 43210"
resort.email = "info@sunandwaterresort.com"
resort.address = "..."
resort.coords = { lat: 29.5828, lng: 80.2183 }
resort.check_in_time = "14:00"
resort.check_out_time = "11:00"
booking.hold_minutes = 10
booking.min_nights = 1
booking.max_nights = 30
booking.allow_pending_balance = true
cancellation.free_until_hours = 168
cancellation.partial_charge_pct = 50
tax.gst_pct = 12
whatsapp.number = "..."
email.from = "..."
```

`GET /admin/settings` returns the merged object. `PUT /admin/settings`
accepts a partial update; each key validates against a Zod schema in
`src/modules/settings/schema.ts`.

---

## 18. Security

- **JWT auth.** Access 15m, refresh 30d, rotated on every refresh.
  Refresh tokens stored as SHA-256 hash in `StaffSession`; `revokedAt`
  is set on logout. Detect token reuse → revoke entire family.
- **RBAC enforced server-side** on every admin route. Frontend hiding
  is cosmetic only.
- **Permission check in DB queries for cross-tenant scoping** (once you
  add multi-tenancy; not needed in v1 but the structure supports it).
- **Input validation** with Zod on every route. Strip unknown keys.
- **CORS** allowlist: `https://sunandwaterresort.com` (public site) and
  `https://admin.sunandwaterresort.com` (admin). Dev: localhost:3000/5173.
- **Rate limiting** via `rate-limiter-flexible` on Redis:
  - Public availability: 60/min/IP
  - Public hold creation: 10/min/IP
  - Admin login: 5/15min/IP
- **Webhook verification.** Razorpay HMAC SHA256. WhatsApp HMAC
  `X-Hub-Signature-256`. Reject anything else with 401.
- **No secrets in code.** All env, never logged. `pino` redacts
  `req.headers.authorization`, `*.password*`, `*.token*`.
- **SQL injection.** Prisma parameterizes; never string-concat raw SQL.
- **XSS.** No HTML in user content except `CmsPage` sections authored
  by admin. The frontend renders via a small allowlist of section
  types — no `dangerouslySetInnerHTML` on user content.
- **CSRF.** Admin uses bearer tokens, no cookies → no CSRF surface.
  Public uses bearer tokens in headers.
- **Audit.** Every staff mutation logs to `ActivityLog` with actor,
  IP, and UA. Reviewer can replay any change.
- **Backups.** Nightly `pg_dump` + WAL archiving; Cloudinary handles
  its own replication.

---

## 19. Frontend ↔ backend data flow

A mapping of the frontend spec's behaviors to backend endpoints, so nothing
is invented on the frontend that the backend can't answer.

| Frontend spec section            | Touches                                                  |
| -------------------------------- | -------------------------------------------------------- |
| §3 Hero availability card        | `GET /public/availability`                               |
| §4 Booking widget                | `GET /public/availability`                              |
| §5 Search results                | `GET /public/availability`                               |
| §6 Availability truth            | Availability engine §5                                  |
| §7 Room details                  | `GET /public/rooms/:slug`                                |
| §8 Gallery                       | `GET /public/gallery`                                   |
| §9 Booking details               | `POST /public/bookings/hold` then `GET`                  |
| §10 Temporary hold               | §6.3 + `holdExpiresAt`                                   |
| §11 Payment / confirmation       | §9                                                      |
| §12 Confirmation page            | `GET /public/bookings/lookup?id=&phone=`                 |
| §13 Booking lookup               | `GET /public/bookings/lookup`                            |
| §14 Customer cancel              | `POST /public/bookings/:id/cancel`                       |
| §15 Extend request               | `POST /public/bookings/:id/extension-request`            |
| §16 Amenities                    | `GET /public/content/amenities`                          |
| §17 Offers                       | `GET /public/offers`, `GET /public/offers/:slug`         |
| §18 Gallery page                 | `GET /public/gallery`                                   |
| §19 About                        | `GET /public/content/pages/about`                        |
| §20 Nearby attractions           | `GET /public/content/attractions`                        |
| §21 Reviews                      | `GET /public/content/testimonials`                       |
| §22 Contact form                 | `POST /public/enquiries`                                 |
| §24 Empty/error/sold-out states  | All read endpoints must return shape that supports them  |
| §27–30 Admin dashboard           | `/admin/dashboard/summary`, `/admin/rooms`, ...          |
| §33 Booking management           | `/admin/bookings`                                        |
| §34 Booking detail               | `/admin/bookings/:id`                                    |
| §35 Extend (admin)               | `POST /admin/bookings/:id/extensions`                    |
| §36 Room assignment              | `POST /admin/bookings/:id/assign-room`                   |
| §37 Move room                    | `POST /admin/bookings/:id/move-room`                     |
| §38–40 Walk-in / phone / WA       | `POST /admin/bookings` (source = WALK_IN/PHONE/WHATSAPP) |
| §41 Enquiry mgmt                 | `/admin/enquiries`                                       |
| §42 Guest profiles               | `/admin/guests`                                          |
| §43–44 Pricing/offers            | `/admin/pricing/*`, `/admin/offers`                      |
| §45–49 Website CMS               | `/admin/cms/*`                                           |
| §49–51 Housekeeping/maintenance  | `/admin/housekeeping/*`, `/admin/rooms/:id/maintenance`  |
| §52–54 Staff & RBAC               | `/admin/staff`, `/admin/roles`                           |
| §55–57 Reports                    | `/admin/reports/*`                                       |
| §58 Notifications                 | Socket.IO `/admin` + email + WhatsApp                   |
| §59 Activity log                 | `/admin/activity-log`                                    |
| §60–63 Settings                   | `/admin/settings`                                        |
| §64–66 Calendar & conflicts      | `/admin/bookings/calendar` + §6.4                        |
| §68 Admin responsive             | same API, different UI                                   |
| §69–70 Security                   | §18 + §7                                                |
| §72 Single source of truth       | All of the above.                                        |

---

## 20. Open questions / things you may want to override

1. **Multi-tenancy.** Currently v1 is single-tenant. Adding `tenantId` to
   every table is straightforward (5-line Prisma migration + middleware)
   but not done yet. Push back if you want it from day 1.
2. **Guest accounts.** v1 guests don't have accounts — they look up by
   `shortCode + phone`. v2 could add `Guest.passwordHash` + magic link.
3. **OTA channels (Booking.com, Airbnb, MakeMyTrip).** Not modeled yet.
   Would add `OtaChannel` and `Booking.externalRef` + a sync job.
4. **Channel manager integration.** Same.
5. **Rate plans.** Modeled but unused in the public flow. v1 prices are
   just `RoomType.basePrice` × nights (with rules on top). Wire rate
   plans in when you have multiple package types to sell.
6. **PMS-grade features** (group bookings, allotment, overbooking rules,
   city ledger, AR) — out of scope for v1.
7. **Multi-currency.** Storage is paise, display is INR. Flip a config
   to support USD/EUR.
8. **Housekeeping mobile.** v1 web is responsive. Native comes later.
9. **Reporting depth.** v1 = direct SQL aggregates. Star schema +
   materialized views is a v2 problem.
10. **Real-time fanout.** Socket.IO namespace `/admin` for staff today.
    Public site doesn't need realtime.

---

## 21. Seed data (initial)

- 1 Owner (`owner@sunandwaterresort.com` / configurable password)
- 5 default roles (Owner/Manager/Reception/Marketing/Housekeeping) with
  permission sets per §7.2
- Room types matching the website mockup: Deluxe, Premium, Family Suite,
  Luxury Cottage
- ~18 physical rooms (10 Deluxe / 4 Premium / 2 Family / 2 Cottage)
- A handful of amenities (`wifi`, `ac`, `tv`, `pool`, `restaurant`,
  `parking`, `room_service`, `balcony`)
- One default hero, one about page, one offers page seed
- 6 testimonials (3 Google, 3 direct)
- 4 nearby attractions
- Settings: check-in 14:00, check-out 11:00, hold 10m, GST 12%

---

## 22. Milestones (suggested order of build)

1. **Foundation** — Prisma schema + migrations + seed. Auth + RBAC.
2. **Inventory** — Room types, physical rooms, amenities, photos.
3. **Availability engine** — read-only `/public/availability` + admin
   room status board.
4. **Bookings v1** — HELD → CONFIRMED with no payment (manual).
5. **Payments** — Razorpay integration, webhooks, manual recording.
6. **Admin bookings** — list, detail, assign, move, cancel, extend.
7. **Housekeeping + maintenance** — board, tasks, OOO.
8. **Enquiries** — public form, WA intake, admin convert.
9. **Pricing + offers** — base prices, rules, offers, public display.
10. **CMS** — hero, pages, gallery, testimonials, attractions.
11. **Reports + activity log + notifications.**
12. **Settings + final polish (realtime, mobile, empty/loading states).**

---

*End of v1 spec. Review and push back on anything — I'd rather catch a
wrong assumption now than after 2 weeks of building.*
