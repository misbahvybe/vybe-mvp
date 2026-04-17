-- Repair drift: some databases never got Store.image_url (e.g. partial migration history).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_class c ON a.attrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND c.relname = 'Store'
      AND a.attname = 'image_url'
      AND a.attnum > 0
      AND NOT a.attisdropped
  ) THEN
    ALTER TABLE "Store" ADD COLUMN "image_url" TEXT;
  END IF;
END $$;
