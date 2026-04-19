-- Repair drift: ProductCategory / Product / ProductVariant may be missing if tables were dropped
-- in Neon while _prisma_migrations still shows all migrations applied.

-- Enum used by Product.form_hint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'MedicineFormHint') THEN
    CREATE TYPE "MedicineFormHint" AS ENUM ('TABLET', 'SYRUP', 'CAPSULE', 'INJECTION', 'OTHER');
  END IF;
END $$;

-- ProductCategory (per-store menu groups)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND c.relname = 'ProductCategory'
      AND c.relkind = 'r'
  ) THEN
    CREATE TABLE "ProductCategory" (
      "id" TEXT NOT NULL,
      "store_id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "sort_order" INTEGER NOT NULL DEFAULT 0,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ProductCategory_store_id_idx" ON "ProductCategory"("store_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductCategory_store_id_fkey') THEN
    ALTER TABLE "ProductCategory"
      ADD CONSTRAINT "ProductCategory_store_id_fkey"
      FOREIGN KEY ("store_id") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Product (full current shape; safe when table was fully dropped)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND c.relname = 'Product'
      AND c.relkind = 'r'
  ) THEN
    CREATE TABLE "Product" (
      "id" TEXT NOT NULL,
      "store_id" TEXT NOT NULL,
      "product_category_id" TEXT,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "price" DECIMAL(10,2) NOT NULL,
      "stock" DECIMAL(10,2) NOT NULL DEFAULT 999,
      "is_out_of_stock" BOOLEAN NOT NULL DEFAULT false,
      "image_url" TEXT,
      "is_available" BOOLEAN NOT NULL DEFAULT true,
      "is_draft" BOOLEAN NOT NULL DEFAULT false,
      "is_verified" BOOLEAN NOT NULL DEFAULT true,
      "name_normalized" TEXT NOT NULL DEFAULT '',
      "source" TEXT,
      "form_hint" "MedicineFormHint",
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
    );
  END IF;
END $$;

-- Partial "Product" tables (old CSV experiments): add any missing columns
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "product_category_id" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "stock" DECIMAL(10,2) NOT NULL DEFAULT 999;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "is_out_of_stock" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "is_draft" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "is_verified" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "name_normalized" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "source" TEXT;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public' AND c.relname = 'Product' AND c.relkind = 'r'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_class c ON a.attrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public' AND c.relname = 'Product' AND a.attname = 'form_hint' AND a.attnum > 0 AND NOT a.attisdropped
  ) THEN
    ALTER TABLE "Product" ADD COLUMN "form_hint" "MedicineFormHint";
  END IF;
END $$;

-- Clear dangling product_category_id values before adding FK (data may reference rows lost when ProductCategory was recreated)
UPDATE "Product" p
SET "product_category_id" = NULL
WHERE p."product_category_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "ProductCategory" pc WHERE pc."id" = p."product_category_id"
  );

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Product_store_id_fkey') THEN
    ALTER TABLE "Product"
      ADD CONSTRAINT "Product_store_id_fkey"
      FOREIGN KEY ("store_id") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Product_product_category_id_fkey') THEN
    ALTER TABLE "Product"
      ADD CONSTRAINT "Product_product_category_id_fkey"
      FOREIGN KEY ("product_category_id") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Product_store_id_name_normalized_idx" ON "Product"("store_id", "name_normalized");
CREATE INDEX IF NOT EXISTS "Product_store_id_is_draft_idx" ON "Product"("store_id", "is_draft");

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "product_name_normalized_trgm_idx"
  ON "Product" USING gin ("name_normalized" gin_trgm_ops);

-- ProductVariant
CREATE TABLE IF NOT EXISTS "ProductVariant" (
  "id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "price" DECIMAL(10,2) NOT NULL,
  "is_available" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProductVariant_product_id_idx" ON "ProductVariant"("product_id");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductVariant_product_id_name_key" ON "ProductVariant"("product_id", "name");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductVariant_product_id_fkey') THEN
    ALTER TABLE "ProductVariant"
      ADD CONSTRAINT "ProductVariant_product_id_fkey"
      FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
