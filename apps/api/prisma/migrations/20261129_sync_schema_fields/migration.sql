-- Sync schema.prisma fields missing from earlier migration history

-- AlterTable: addresses
ALTER TABLE "addresses"
  ADD COLUMN IF NOT EXISTS "label" TEXT DEFAULT 'Home';

-- AlterTable: oauth_accounts & payment_receipts updatedAt defaults
ALTER TABLE "oauth_accounts" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "payment_receipts" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable: product_images
ALTER TABLE "product_images"
  ADD COLUMN IF NOT EXISTS "colorwayId" TEXT,
  ADD COLUMN IF NOT EXISTS "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "publicId" TEXT DEFAULT '';

-- AlterTable: products
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "material" TEXT,
  ADD COLUMN IF NOT EXISTS "shoeType" TEXT NOT NULL DEFAULT 'Sneakers';

-- AlterTable: store_settings
ALTER TABLE "store_settings"
  ALTER COLUMN "showroomAddress" SET DEFAULT 'Bole, Addis Ababa, Ethiopia',
  ALTER COLUMN "freeDeliveryThresholdETB" SET DEFAULT 0,
  ALTER COLUMN "standardAddisDeliveryFeeETB" SET DEFAULT 0;

-- AlterTable: users
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "dateOfBirth" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "product_images_colorwayId_idx" ON "product_images"("colorwayId");
CREATE INDEX IF NOT EXISTS "product_images_isPrimary_idx" ON "product_images"("isPrimary");
CREATE INDEX IF NOT EXISTS "products_shoeType_idx" ON "products"("shoeType");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "product_images"
    ADD CONSTRAINT "product_images_colorwayId_fkey"
    FOREIGN KEY ("colorwayId") REFERENCES "product_colorways"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

