ALTER TABLE "store_settings"
  ADD COLUMN IF NOT EXISTS "heroImageUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "heroBadgeText" TEXT NOT NULL DEFAULT 'Addis Stock Ready',
  ADD COLUMN IF NOT EXISTS "heroCardSubtitle" TEXT NOT NULL DEFAULT 'New Arrival • Track Spec',
  ADD COLUMN IF NOT EXISTS "heroCardTitle" TEXT NOT NULL DEFAULT 'Addis Velocity Pro Nitro',
  ADD COLUMN IF NOT EXISTS "heroCardPriceText" TEXT NOT NULL DEFAULT '5,850 ETB',
  ADD COLUMN IF NOT EXISTS "heroCardHref" TEXT NOT NULL DEFAULT '/products/addis-velocity-pro-nitro';

