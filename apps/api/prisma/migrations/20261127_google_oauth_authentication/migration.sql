-- Google OAuth 2.0 Authentication & Multi-Provider Account Linking Migration

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AuthProvider" AS ENUM ('GOOGLE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable: Allow passwordless OAuth accounts while preserving existing user passwords
ALTER TABLE "users"
  ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateTable
CREATE TABLE IF NOT EXISTS "oauth_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "providerEmail" TEXT,
    "providerName" TEXT,
    "providerAvatarUrl" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "oauth_accounts_provider_providerAccountId_key"
  ON "oauth_accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "oauth_accounts_userId_provider_key"
  ON "oauth_accounts"("userId", "provider");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "oauth_accounts_userId_idx"
  ON "oauth_accounts"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "oauth_accounts_provider_providerEmail_idx"
  ON "oauth_accounts"("provider", "providerEmail");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "oauth_accounts"
    ADD CONSTRAINT "oauth_accounts_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

