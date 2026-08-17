# Sun & Water Resort — Frontend Specification

> **v1.0** — the public marketing/booking site + the private admin
> dashboard. This is the behavior contract; the backend spec
> (`backend-spec.md`) is the implementation contract.
>
> Sections 1–25 are the **public website** (no login).
> Sections 26–73 are the **private admin dashboard** (auth required).

---

## 1. Public Frontend — Customer Website

No login required for normal browsing.

**Main navigation:** Home · Rooms · Amenities · Offers · Gallery · About · Contact

**Primary CTA:** `Book Your Stay`
**Secondary CTA:** `Chat on WhatsApp`

---

## 2. Homepage — Navigation

- **Desktop:** Logo + "RESORT" subtitle on left. Center/right: Home, Rooms, Amenities, Offers, Gallery, About, Contact. Right: `Book Your Stay` CTA.
- **Mobile:** Hamburger menu.
- **Behavior:** transparent/glass over hero → solid/blurred navbar while scrolling → sticky after scroll.
- **Style:** large rounded nav container, Apple-like pill controls.

---

## 3. Hero Section

- Full-width cinematic image (mountains / pool / resort at sunset).
- **Headline:** *Relax. Refresh. Reconnect.*
- **Subtitle:** *Experience the perfect blend of nature, comfort and warm hospitality in Pithoragarh.*
- **CTAs:** `Book Your Stay` (primary green pill) · `Chat on WhatsApp` (ghost).
- **Floating glass card:** "Check Availability" with check-in, check-out, guests, rooms.

---

## 4. Search / Booking Engine

**Inputs:** Check-in · Check-out · Adults · Children · Rooms · Special requests.

**Validation:**
- Checkout must be after check-in.
- Check-in must be today or future.
- At least one guest.

**Behavior:** frontend asks backend `GET /api/public/availability?…`. Backend returns real availability per room type.

---

## 5. Search Results

- Stay summary (dates, guests, rooms) + "Modify Search" button.
- Each room card: photo, name, guests/beds/area, amenities, price/night, total stay price, available count, `Select` button.
- Example: "Deluxe Room — 3 Rooms Left" or "Deluxe Room — Sold Out".

---

## 6. Availability Truth

The frontend **never** calculates the final availability. Backend considers: total room-type inventory, confirmed bookings, temporary holds, cancellations, OOO/maintenance, overlapping date ranges. Half-open `[checkIn, checkOut)`.

---

## 7. Room Details Page

- `/rooms/:slug` — large gallery, room name, price, description, occupancy, bed, area, amenities, cancellation policy, house rules, nearby info.
- Buttons: `Check Availability` · `Book Now` · `Ask on WhatsApp`.

---

## 8. Room Gallery

- Main image + thumbnail strip + full-screen lightbox + swipe on mobile + next/prev + zoom. Large rounded imagery, no slideshow feel.

---

## 9. Booking Details Page

- Your Selection (room type, dates, nights, guests, rooms).
- Pricing: room rate × nights, subtotal, taxes, total.
- Customer info: full name, email, phone, guest count, special request, optional arrival time, optional ID details.

---

## 10. Temporary Hold

When customer begins final booking, backend creates a hold with a countdown (e.g. 09:42). If hold expires: "Your selected room is no longer reserved. Please search again." Never claim "guaranteed" unless backend confirms.

---

## 11. Payment / Confirmation Flow

Configurable by admin:
- **Enquiry** — status `PENDING`; staff approves.
- **Online payment** — Razorpay; status `CONFIRMED`.
- **Partial payment** — advance paid, remainder due at hotel; shows `₹X paid / ₹Y remaining`.

---

## 12. Booking Confirmation

Huge success state: *Booking Confirmed 🎉*. Booking ID (`#BK1048`), guest, room, dates, payment, total, check-in/out times. Buttons: View Booking · Download Confirmation · Chat with Resort. Optional: email + WhatsApp confirmation.

---

## 13. Guest Booking Lookup

Lookup by Booking ID + phone/email. No account required.

---

## 14. Customer Cancellation

- Open booking → `Cancel Booking` → backend checks policy window.
- `Free cancellation up to 7 days before check-in` etc. The policy comes from admin settings.

---

## 15. Extend Stay (Customer)

- Customer requests `Extend My Stay`.
- Backend checks: room-type availability, current room assignment, future reservations, hotel rules.
- Result: `Extension Request` → reception approves.

---

## 16. Amenities Page

- Sections: Swimming pool, Restaurant, Wi-Fi, Parking, Room service, Family facilities, Event facilities, etc.
- Each: icon, title, description, photos.

---

## 17. Offers Page

Admin-managed. Each offer: name, description, valid dates, applicable room types, discount/benefit, terms. CTA: `Book Offer`.

---

## 18. Gallery Page

- Categories: Resort, Rooms, Pool, Restaurant, Events, Surroundings, Experiences.
- Filter chips. Large image grid. Lightbox.

---

## 19. About Page

Resort story, location, hospitality philosophy, property highlights, team (optional), nearby attractions.

---

## 20. Pithoragarh / Nearby Attractions

- Local attractions, scenic places, trekking, religious destinations, nearby sightseeing.
- Each: image, distance, travel time, description, map link.
- **Do not invent distances; admin configures them.**

---

## 21. Reviews Section

- 4.6 ⭐ · 814 Google Reviews.
- Admin controls which testimonials are displayed.
- **Source distinction matters:** verified Google reviews vs manually-added testimonials. UI must never pretend a manual testimonial came from Google.

---

## 22. Contact Page

Phone, WhatsApp, email, address, map, check-in/out times, contact form (name, phone, email, message, preferred dates, room type).

---

## 23. Mobile Experience

- Sticky Book + WhatsApp buttons.
- Swipeable room cards, mobile date picker, bottom-sheet booking UI, collapsible nav, large text, large hit targets. No tiny 12px buttons.

---

## 24. Frontend States (every major page must have)

- Loading: skeleton cards / shimmer.
- Empty: e.g. "No rooms available for these dates."
- Error: "We couldn't check availability. Please try again."
- Offline: "Connection lost. Please retry."
- Sold out: "No rooms available for your selected dates."
- Partial availability: "Deluxe Room: 2 available."
- Booking conflict: "This room is no longer available. Please select another room."

---

## 25. SEO / Public Routes

- `/`, `/rooms`, `/rooms/:slug`, `/amenities`, `/offers`, `/offers/:slug`, `/gallery`, `/about`, `/contact`, `/booking`, `/booking/search`, `/booking/details`, `/booking/confirmation`, `/booking/:id`, `/stay-extension-request`
- Each has SEO title, description, Open Graph, structured data, canonical URL, optimized images, clean URLs, fast loading.

---

## 26. Admin Authentication

- `/admin/login` — email/username + password. Optional OTP, 2FA, Google.
- Secure session, logout, session timeout, password reset, device/session management.
- Admin pages must never be exposed just because someone knows the URL.

---

## 27. Admin Dashboard Homepage

- Header: `Dashboard` · `Welcome back, Admin 👋` · date selector · notification icon.
- KPIs: Occupancy, Check-ins, Check-outs, Available Rooms, Today's Revenue (plus pending enquiries, pending bookings, cancelled bookings, monthly revenue, ADR, RevPAR).

---

## 28. Occupancy Dashboard

Daily / weekly / monthly occupancy + by-room-type. Filters: Today / This Week / This Month / Custom. Charts: line, bar, donut.

---

## 29. Room Status Board

Every physical room. Status: 🟢 Ready · 🔴 Occupied · 🟡 Cleaning · 🔴 Out of Order. Filters: room type, status, floor/block.

---

## 30. Rooms & Inventory

- **Room types:** name, base price, total units, etc.
- **Physical rooms:** number, type, floor, status, notes.
- Editable in admin.

---

## 31. Room Type Management

Fields: name, description, base price, max guests, beds, size, amenities, photos, number of units, published/unpublished.

---

## 32. Physical Room Management

Fields: room number, type, floor, status, notes. Status: Ready · Occupied · Cleaning · Maintenance · Out of order.

---

## 33. Booking Management

Main table: Booking ID · Guest · Room type · Assigned room · Check-in · Check-out · Guests · Payment · Status. Filters: date, status, room type, source. Sources: Website · Reception · Phone · WhatsApp · OTA.

---

## 34. Booking Detail Page

Guest info · reservation details · room type · assigned room · dates · guests · payment · status · special requests · internal notes · activity history. Actions: Confirm · Cancel · Check-in · Check-out · Modify · Extend Stay · Move Room.

---

## 35. Extend Stay (Admin)

Admin picks new checkout. Backend checks same-room + room-type availability + existing bookings + future assignments. Outcomes: same room, requires room change, or unavailable.

---

## 36. Room Assignment

Customer books a room type; admin later assigns a physical room. System suggests suitable rooms.

---

## 37. Move Room

Move guest from room A → room B with reason. Activity log entry.

---

## 38. Walk-in Booking

Reception can create a booking without the customer using the website. Uses the **same** inventory system.

---

## 39. Phone Booking

Same as walk-in, `source = PHONE`.

---

## 40. WhatsApp Enquiry

Dashboard receives an enquiry. Staff can `Convert to Booking` — same source-of-truth system.

---

## 41. Enquiry Management

Statuses: New · Contacted · Awaiting response · Converted · Lost · Spam. Fields: name, phone, email, requested dates, room type, guests, message, source, assigned staff, notes.

---

## 42. Customer/Guest Management

Guest profile: name, phone, email, booking history, preferences, notes, last stay, upcoming stay. RBAC-protected.

---

## 43. Pricing Management

Base price · weekend price · seasonal price · holiday price · special offer price. Future: rate plans (Standard, Non-refundable, Breakfast included, Family package).

---

## 44. Offers Management

Name, description, discount, start/end date, room types, terms, promo code, image, publish/unpublish. Auto-syncs to website.

---

## 45. Website Content Management

Sections: Hero, Resort description, Rooms, Amenities, Gallery, Offers, Testimonials, Contact, Nearby places. No code required.

---

## 46. Hero Editor

Headline, subtitle, hero image, primary CTA, secondary CTA.

---

## 47. Gallery Management

Upload · delete · reorder · categorize · featured · caption · hide. Drag-and-drop.

---

## 48. Testimonial Management

Add · edit · remove · publish · featured. Fields: name, text, rating, source (`Google / Direct / Website / …`), date, avatar.

---

## 49. Housekeeping Dashboard

Board with columns Dirty · Cleaning · Ready · Occupied · Maintenance. Staff move rooms between statuses.

---

## 50. Housekeeping Assignments

Assign room to a housekeeper with task (e.g. checkout cleaning) and status.

---

## 51. Maintenance

Rooms marked Out of Order with reason (plumbing, electrical, AC, structural, other) and optional expected ready date. Excluded from bookable inventory.

---

## 52. Staff Management

Add staff. Fields: name, phone, email, role, status (Active / Suspended / Inactive).

---

## 53. Permission System

Permissions: view bookings, create, modify, cancel, check-in, check-out, assign rooms, extend, move rooms, view guests, view pricing, edit pricing, manage rooms, manage content, manage gallery, manage offers, view revenue, manage staff, manage permissions, manage settings, view reports. Owner-customizable.

---

## 54. Role Examples

- **Super Admin / Owner** — everything.
- **Manager** — most operational features.
- **Reception** — bookings, guests, check-in/out.
- **Marketing** — website content, offers, gallery.
- **Housekeeping** — room status, tasks only.

---

## 55. Reports

Revenue · Occupancy · Bookings · Cancellation · Room performance · Booking source · Enquiries · Conversion rate · Average stay · Popular room types. Filters: today/week/month/year/custom. Export: CSV.

---

## 56. Booking Source Analytics

Distribution pie: Website 35% · Walk-in 20% · Phone 15% · WhatsApp 18% · OTA 12%.

---

## 57. Revenue Analytics

Today's revenue · weekly · monthly · outstanding balance · advance payments · refunds · discounts.

---

## 58. Notifications

In-app: new booking, new enquiry, cancellation, payment, booking conflict, extension request, room maintenance, housekeeping task, staff approval needed.

---

## 59. Activity Log

For every admin change: who, what, when. Example: "Admin changed Deluxe Room price from ₹4,500 → ₹5,000." Includes actor, action, entity, before/after.

---

## 60. Settings

- Resort profile (name, address, phone, email, logo, social).
- Booking settings (check-in/out times, min/max stay, rules).
- Cancellation policy (configurable).
- Tax / pricing.
- Notifications (email/WhatsApp/SMS options).
- Website (SEO basics).
- Security (session, password).

---

## 61. Booking Rules

Admin configures: check-in/out times, extra bed policy, children policy, cancellation policy, advance payment, late checkout fee, early check-in policy. Not hardcoded in frontend.

---

## 62. Late Checkout

Admin records: normal 11:00 AM checkout; guest requests 2:00 PM. Manager approves. Free / fee / half-day. Decision recorded.

---

## 63. Extension Rules

Admin configures: extension requires approval, payment required, room change allowed, late checkout available. All configurable, not hardcoded.

---

## 64. Booking Calendar (Visual)

Rows: room type / physical room. Columns: dates. Bookings as bars.

```
Room 201  █████ Booking A
Room 202       ███████ Booking B
Room 203  █████████ Booking C
```

---

## 65. Room-Type Calendar

Per room type, with daily available counts and SOLD OUT markers.

---

## 66. Conflict Warnings

Before any change, warn: `⚠ This extension conflicts with Booking #BK1092.` / `⚠ Room 203 is assigned to another guest on Aug 15.` / `⚠ This room is marked Out of Order.`

---

## 67. Admin Search

Global search: guest, booking ID, room number, phone, enquiry.

---

## 68. Admin Responsive Design

Desktop-first. Tablet + mobile supported. Mobile prioritizes: today's arrivals, departures, bookings, room status, enquiries, housekeeping.

---

## 69. Security Architecture

Frontend must never trust "I'm admin." Backend verifies every API call: authenticated + role + permission. 403 even if URL guessed.

---

## 70. Admin UI Visibility Rules (RBAC)

- **Reception:** bookings, guests, check-in/out. No staff, revenue, security, permissions.
- **Marketing:** website content, gallery, offers. No bookings, payments.
- **Housekeeping:** rooms, tasks, maintenance. No customer financial data.

---

## 71. Frontend vs Dashboard Separation

- Public: `/`, `/rooms`, `/rooms/:slug`, `/amenities`, `/offers`, `/gallery`, `/about`, `/contact`, `/booking`, `/booking/confirmation`.
- Admin: `/admin/login`, `/admin`, `/admin/bookings`, `/admin/rooms`, `/admin/room-types`, `/admin/guests`, `/admin/enquiries`, `/admin/pricing`, `/admin/offers`, `/admin/housekeeping`, `/admin/staff`, `/admin/reports`, `/admin/content`, `/admin/gallery`, `/admin/reviews`, `/admin/settings`, `/admin/activity`.

---

## 72. Single Source of Truth (Backend)

Both interfaces use the same database. Website booking → reception sees it instantly. Walk-in booking → website availability updates instantly. Out-of-order → booking widget excludes it. Extend → future availability updates. **The system has one inventory.**

---

## 73. What the Resort Owner Is Buying

- Customer Website
- Booking Engine
- Reservation Management
- Room Inventory
- Staff Operations
- Housekeeping
- Website CMS
- Customer Enquiries
- Analytics
- Role-based Staff Dashboard

The website is the public face. The dashboard is the resort's private operating system. The architecture is reusable across resorts (different branding, rooms, rules, staff, content).
