-- Notifications table + extended platform checkout settings for delivery pricing + COD tax toggle.

-- 1) Notifications (in-app feed)
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "data_json" TEXT,
  "is_read" BOOLEAN NOT NULL DEFAULT FALSE,
  "read_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "notifications_user_read_created_idx"
  ON "notifications" ("user_id", "is_read", "created_at");

-- 2) Extend platform_checkout_settings (singleton row)
ALTER TABLE "platform_checkout_settings"
  ADD COLUMN IF NOT EXISTS "cod_tax_enabled" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "platform_checkout_settings"
  ADD COLUMN IF NOT EXISTS "delivery_base_per_km" DECIMAL(10,2) NOT NULL DEFAULT 45;

ALTER TABLE "platform_checkout_settings"
  ADD COLUMN IF NOT EXISTS "weekend_multiplier" DECIMAL(6,3) NOT NULL DEFAULT 1;

ALTER TABLE "platform_checkout_settings"
  ADD COLUMN IF NOT EXISTS "peak_multiplier" DECIMAL(6,3) NOT NULL DEFAULT 1;

ALTER TABLE "platform_checkout_settings"
  ADD COLUMN IF NOT EXISTS "peak_start_time" TEXT NOT NULL DEFAULT '18:00';

ALTER TABLE "platform_checkout_settings"
  ADD COLUMN IF NOT EXISTS "peak_end_time" TEXT NOT NULL DEFAULT '22:00';

-- Ensure existing rows don't apply heavy COD tax by default (require explicit enable).
UPDATE "platform_checkout_settings"
SET "cod_tax_enabled" = COALESCE("cod_tax_enabled", FALSE);

