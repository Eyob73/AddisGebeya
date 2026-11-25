-- Cheki API Payment Verification & Audit Schema Migration
-- Preserves all existing orders and payment records.

ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "userId" TEXT,
  ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'cbe',
  ADD COLUMN IF NOT EXISTS "verifiedReference" TEXT,
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'ETB',
  ADD COLUMN IF NOT EXISTS "senderName" TEXT,
  ADD COLUMN IF NOT EXISTS "senderAccount" TEXT,
  ADD COLUMN IF NOT EXISTS "receiverName" TEXT,
  ADD COLUMN IF NOT EXISTS "receiverAccount" TEXT,
  ADD COLUMN IF NOT EXISTS "transactionDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "sourceUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewedByAdminId" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewReason" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "verificationResponse" JSONB,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "payments" ALTER COLUMN "paymentStatus" SET DEFAULT 'Pending';

CREATE UNIQUE INDEX IF NOT EXISTS "payments_verifiedReference_key" ON "payments"("verifiedReference");
CREATE INDEX IF NOT EXISTS "payments_userId_idx" ON "payments"("userId");
CREATE INDEX IF NOT EXISTS "payments_provider_idx" ON "payments"("provider");
CREATE INDEX IF NOT EXISTS "payments_paymentStatus_idx" ON "payments"("paymentStatus");
CREATE INDEX IF NOT EXISTS "payments_transactionReference_idx" ON "payments"("transactionReference");
CREATE INDEX IF NOT EXISTS "payments_verifiedAt_idx" ON "payments"("verifiedAt");

DO $$ BEGIN
  ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "payment_verification_logs" (
  "id" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "userId" TEXT,
  "provider" TEXT NOT NULL,
  "submittedReference" TEXT,
  "verificationStatus" TEXT NOT NULL,
  "errorMessage" TEXT,
  "chekiHttpStatus" INTEGER,
  "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "responseData" JSONB,
  "actorType" TEXT NOT NULL DEFAULT 'customer',
  "actorId" TEXT,
  "reason" TEXT,
  CONSTRAINT "payment_verification_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "payment_verification_logs_paymentId_idx" ON "payment_verification_logs"("paymentId");
CREATE INDEX IF NOT EXISTS "payment_verification_logs_orderId_idx" ON "payment_verification_logs"("orderId");
CREATE INDEX IF NOT EXISTS "payment_verification_logs_verificationStatus_idx" ON "payment_verification_logs"("verificationStatus");
CREATE INDEX IF NOT EXISTS "payment_verification_logs_attemptedAt_idx" ON "payment_verification_logs"("attemptedAt");

DO $$ BEGIN
  ALTER TABLE "payment_verification_logs" ADD CONSTRAINT "payment_verification_logs_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "payment_provider_configs" (
  "id" TEXT NOT NULL,
  "providerCode" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "receivingAccountName" TEXT NOT NULL,
  "receivingAccountNumber" TEXT NOT NULL,
  "accountSuffixDigits" INTEGER,
  "instructions" TEXT,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "maxPaymentAgeDays" INTEGER NOT NULL DEFAULT 30,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payment_provider_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payment_provider_configs_providerCode_key" ON "payment_provider_configs"("providerCode");
CREATE INDEX IF NOT EXISTS "payment_provider_configs_isEnabled_idx" ON "payment_provider_configs"("isEnabled");

