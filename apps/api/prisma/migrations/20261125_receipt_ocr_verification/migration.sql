-- Receipt OCR & Provider Verification Schema Migration

ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "extractedReference" TEXT,
  ADD COLUMN IF NOT EXISTS "extractedAmount" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "verifiedAmount" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "verificationSource" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "failureReason" TEXT;

ALTER TABLE "payment_receipts"
  ADD COLUMN IF NOT EXISTS "normalizedVerifiedReference" TEXT,
  ADD COLUMN IF NOT EXISTS "extractedReference" TEXT,
  ADD COLUMN IF NOT EXISTS "extractedQrData" TEXT,
  ADD COLUMN IF NOT EXISTS "extractedAmount" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "extractedDate" TEXT,
  ADD COLUMN IF NOT EXISTS "extractedSenderName" TEXT,
  ADD COLUMN IF NOT EXISTS "extractedSenderAccount" TEXT,
  ADD COLUMN IF NOT EXISTS "extractedReceiverName" TEXT,
  ADD COLUMN IF NOT EXISTS "extractedReceiverAccount" TEXT,
  ADD COLUMN IF NOT EXISTS "extractedStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "detectedProvider" TEXT,
  ADD COLUMN IF NOT EXISTS "ocrConfidence" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "ocrRawText" TEXT,
  ADD COLUMN IF NOT EXISTS "ocrCompletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "verifiedAmount" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "verifiedCurrency" TEXT,
  ADD COLUMN IF NOT EXISTS "verificationSource" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "failureReason" TEXT,
  ADD COLUMN IF NOT EXISTS "providerResponse" JSONB,
  ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "payment_receipts_normalizedVerifiedReference_key"
  ON "payment_receipts"("normalizedVerifiedReference");

