-- Add a human-friendly incremental order number for UI/POS.
-- Postgres: create sequence + backfill existing rows + enforce uniqueness.

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "order_number" INTEGER;

-- Create sequence used for new orders.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'order_order_number_seq') THEN
    CREATE SEQUENCE order_order_number_seq;
  END IF;
END $$;

-- Backfill existing orders in creation order (oldest = 1).
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "created_at" ASC, id ASC) AS rn
  FROM "Order"
  WHERE "order_number" IS NULL
)
UPDATE "Order" o
SET "order_number" = ranked.rn
FROM ranked
WHERE o.id = ranked.id;

-- Ensure sequence starts after max(order_number)
SELECT setval('order_order_number_seq', GREATEST(1, (SELECT COALESCE(MAX("order_number"), 0) FROM "Order")) + 1, false);

-- Set default for new rows.
ALTER TABLE "Order" ALTER COLUMN "order_number" SET DEFAULT nextval('order_order_number_seq');

-- Enforce constraints.
ALTER TABLE "Order" ALTER COLUMN "order_number" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Order_order_number_key'
  ) THEN
    ALTER TABLE "Order" ADD CONSTRAINT "Order_order_number_key" UNIQUE ("order_number");
  END IF;
END $$;

