-- =============================================================================
-- Sun & Water Resort — PostgreSQL CHECK Constraints for Monetary Columns
-- Migration: 20260815_add_check_constraints.sql
-- Author:    Security Audit — Database Reliability
-- Purpose:   Defense-in-depth constraints ensuring all monetary values stored
--            in the database are non-negative integers (paise).
-- =============================================================================
-- USAGE:
--   psql -h <host> -U <user> -d <database> -f 20260815_add_check_constraints.sql
--
-- NOTES:
--   • Prisma uses the exact field name as the column name (no snake_case
--     conversion) unless @map() is specified. The schema uses camelCase
--     column names throughout.
--   • All monetary values are stored as positive integers in paise
--     (e.g. ₹4,500 = 450000).
--   • Each ALTER TABLE uses IF NOT EXISTS (via DO $$ blocks) to be
--     safely re-runnable / idempotent.
-- =============================================================================

-- ─── RoomType ───────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE "RoomType" ADD CONSTRAINT chk_roomtype_baseprice_nonneg
    CHECK ("basePrice" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── RoomRate ───────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE "RoomRate" ADD CONSTRAINT chk_roomrate_rate_nonneg
    CHECK ("rate" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Reservation ────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE "Reservation" ADD CONSTRAINT chk_reservation_nightlyrate_nonneg
    CHECK ("nightlyRate" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Reservation" ADD CONSTRAINT chk_reservation_subtotal_nonneg
    CHECK ("subtotal" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Reservation" ADD CONSTRAINT chk_reservation_discount_nonneg
    CHECK ("discount" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Reservation" ADD CONSTRAINT chk_reservation_taxamount_nonneg
    CHECK ("taxAmount" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Reservation" ADD CONSTRAINT chk_reservation_totalamount_nonneg
    CHECK ("totalAmount" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Reservation" ADD CONSTRAINT chk_reservation_amountpaid_nonneg
    CHECK ("amountPaid" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Reservation" ADD CONSTRAINT chk_reservation_amountdue_nonneg
    CHECK ("amountDue" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── ReservationHold ────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE "ReservationHold" ADD CONSTRAINT chk_hold_nightlyrate_nonneg
    CHECK ("nightlyRate" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ReservationHold" ADD CONSTRAINT chk_hold_totalamount_nonneg
    CHECK ("totalAmount" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Payment ────────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE "Payment" ADD CONSTRAINT chk_payment_amount_nonneg
    CHECK ("amount" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── ExtensionRequest ───────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE "ExtensionRequest" ADD CONSTRAINT chk_extension_additionalamount_nonneg
    CHECK ("additionalAmount" IS NULL OR "additionalAmount" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- Verification query — run after applying to confirm all constraints are active:
--
--   SELECT conrelid::regclass AS table_name, conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conname LIKE 'chk_%_nonneg'
--   ORDER BY conrelid::regclass::text, conname;
--
-- Expected: 13 rows.
-- =============================================================================
