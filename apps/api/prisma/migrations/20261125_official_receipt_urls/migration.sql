ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "officialReceiptUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "cbeReceiptToken" TEXT;

ALTER TABLE "payment_receipts"
  ADD COLUMN IF NOT EXISTS "officialReceiptUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "cbeReceiptToken" TEXT;

