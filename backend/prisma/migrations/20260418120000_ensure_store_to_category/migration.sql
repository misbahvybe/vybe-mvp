-- Repair drift: StoreCategory / StoreToCategory may be missing if tables were dropped manually in SQL
-- while _prisma_migrations still marks historical migrations as applied.

-- Platform store verticals (food, grocery, medicine, …) — required parent for StoreToCategory.category_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND c.relname = 'StoreCategory'
      AND c.relkind = 'r'
  ) THEN
    CREATE TABLE "StoreCategory" (
      "id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      CONSTRAINT "StoreCategory_pkey" PRIMARY KEY ("id")
    );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "StoreCategory_name_key" ON "StoreCategory"("name");

-- Junction: which platform categories each store belongs to
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND c.relname = 'StoreToCategory'
      AND c.relkind = 'r'
  ) THEN
    CREATE TABLE "StoreToCategory" (
      "store_id" TEXT NOT NULL,
      "category_id" TEXT NOT NULL,
      CONSTRAINT "StoreToCategory_pkey" PRIMARY KEY ("store_id", "category_id")
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StoreToCategory_store_id_fkey'
  ) THEN
    ALTER TABLE "StoreToCategory"
      ADD CONSTRAINT "StoreToCategory_store_id_fkey"
      FOREIGN KEY ("store_id") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StoreToCategory_category_id_fkey'
  ) THEN
    ALTER TABLE "StoreToCategory"
      ADD CONSTRAINT "StoreToCategory_category_id_fkey"
      FOREIGN KEY ("category_id") REFERENCES "StoreCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
