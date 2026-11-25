-- Payment Receipt Upload & Verification Schema Migration
-- Stores Cloudinary asset references (URL + publicId) without storing raw binary data in PostgreSQL.

CREATE TABLE IF NOT EXISTS "payment_receipts" (
  "id" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "transactionReference" TEXT,
  "imageUrl" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileSizeBytes" INTEGER NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "captureMethod" TEXT NOT NULL DEFAULT 'upload',
  "status" TEXT NOT NULL DEFAULT 'Pending',
  "rejectionReason" TEXT,
  "resubmissionRequested" BOOLEAN NOT NULL DEFAULT false,
  "reviewedByAdminId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_receipts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "payment_receipts_paymentId_idx" ON "payment_receipts"("paymentId");
CREATE INDEX IF NOT EXISTS "payment_receipts_orderId_idx" ON "payment_receipts"("orderId");
CREATE INDEX IF NOT EXISTS "payment_receipts_userId_idx" ON "payment_receipts"("userId");
CREATE INDEX IF NOT EXISTS "payment_receipts_status_idx" ON "payment_receipts"("status");
CREATE INDEX IF NOT EXISTS "payment_receipts_submittedAt_idx" ON "payment_receipts"("submittedAt");

DO $$ BEGIN
  ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

