# Database Migrations — Sun & Water Resort

## Overview

This directory contains **manual SQL migration scripts** for PostgreSQL production deployments. These are applied *after* Prisma's schema push or `prisma migrate deploy` and add database-level constraints that Prisma's schema DSL does not support natively.

---

## Migration: `20260815_add_check_constraints.sql`

### Purpose

Adds `CHECK` constraints to **all 13 monetary columns** across 5 tables, ensuring no negative values can be stored at the database level — even if API-layer Zod validation is bypassed.

All monetary values in the platform are stored as **positive integers in paise** (e.g. ₹4,500 = `450000`).

### Constraints Added

| Table | Column | Constraint |
|-------|--------|------------|
| `RoomType` | `basePrice` | `>= 0` |
| `RoomRate` | `rate` | `>= 0` |
| `Reservation` | `nightlyRate` | `>= 0` |
| `Reservation` | `subtotal` | `>= 0` |
| `Reservation` | `discount` | `>= 0` |
| `Reservation` | `taxAmount` | `>= 0` |
| `Reservation` | `totalAmount` | `>= 0` |
| `Reservation` | `amountPaid` | `>= 0` |
| `Reservation` | `amountDue` | `>= 0` |
| `ReservationHold` | `nightlyRate` | `>= 0` |
| `ReservationHold` | `totalAmount` | `>= 0` |
| `Payment` | `amount` | `>= 0` |
| `ExtensionRequest` | `additionalAmount` | `IS NULL OR >= 0` |

### How to Apply

```bash
# From the backend/ directory, targeting your production PostgreSQL:
psql -h <host> -U <user> -d <database> -f prisma/migrations/20260815_add_check_constraints.sql
```

Or via a connection string:

```bash
psql "postgresql://user:password@host:5432/dbname" \
  -f prisma/migrations/20260815_add_check_constraints.sql
```

The script is **idempotent** — each constraint is wrapped in a `DO $$ ... EXCEPTION WHEN duplicate_object` block, so re-running it is safe and will not error on existing constraints.

### How to Verify

After applying, run this query to confirm all 13 constraints are active:

```sql
SELECT conrelid::regclass AS table_name,
       conname,
       pg_get_constraintdef(oid)
FROM   pg_constraint
WHERE  conname LIKE 'chk_%_nonneg'
ORDER  BY conrelid::regclass::text, conname;
```

**Expected output:** 13 rows, one per monetary column listed above.

### What Happens on Violation

Any `INSERT` or `UPDATE` that attempts to set a monetary column to a negative value will receive a PostgreSQL error:

```
ERROR: new row for relation "Reservation" violates check constraint "chk_reservation_totalamount_nonneg"
DETAIL: Failing row contains (..., -100, ...).
```

The application's error handler will surface this as a `500 Internal Server Error`. This is intentional — negative monetary values indicate a bug in application logic that should be caught and fixed, not silently accepted.

---

## Future Migrations

Place additional migration files in this directory using the naming convention:

```
YYYYMMDD_short_description.sql
```

Document each new migration in this README.
