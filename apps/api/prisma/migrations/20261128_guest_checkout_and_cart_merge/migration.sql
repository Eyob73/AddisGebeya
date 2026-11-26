-- Guest Cart, Cart Merge, Guest Orders & Guest Payment Receipt Support Migration

-- AlterTable: Add guestSessionId to carts
ALTER TABLE "carts"
  ADD COLUMN IF NOT EXISTS "guestSessionId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "carts_guestSessionId_key"
  ON "carts"("guestSessionId");

CREATE INDEX IF NOT EXISTS "carts_guestSessionId_idx"
  ON "carts"("guestSessionId");

-- AlterTable: Add guestSessionId to orders
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "guestSessionId" TEXT;

CREATE INDEX IF NOT EXISTS "orders_guestSessionId_idx"
  ON "orders"("guestSessionId");

-- AlterTable: Allow guest payment receipts with nullable userId (SET NULL on user delete)
ALTER TABLE "payment_receipts"
  ALTER COLUMN "userId" DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE "payment_receipts" DROP CONSTRAINT IF EXISTS "payment_receipts_userId_fkey";
  ALTER TABLE "payment_receipts"
    ADD CONSTRAINT "payment_receipts_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

