-- Real-Time Persistent Notification System & Transactional Outbox Migration

-- AlterTable
ALTER TABLE "notifications"
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
  ADD COLUMN IF NOT EXISTS "metadata" JSONB,
  ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "relatedEntityId" TEXT,
  ADD COLUMN IF NOT EXISTS "relatedEntityType" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE IF NOT EXISTS "notification_outbox" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL DEFAULT 'notification:new',
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextRetryAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notification_outbox_status_nextRetryAt_idx" ON "notification_outbox"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notification_outbox_notificationId_idx" ON "notification_outbox"("notificationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notification_outbox_userId_idx" ON "notification_outbox"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_userId_isRead_createdAt_idx" ON "notifications"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_relatedEntityType_relatedEntityId_idx" ON "notifications"("relatedEntityType", "relatedEntityId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_userId_idempotencyKey_key" ON "notifications"("userId", "idempotencyKey");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "notification_outbox"
    ADD CONSTRAINT "notification_outbox_notificationId_fkey"
    FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

