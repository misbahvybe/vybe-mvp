-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CancellationReason" AS ENUM ('CUSTOMER_CANCELLED', 'STORE_REJECTED', 'ADMIN_CANCELLED', 'OUT_OF_STOCK', 'STORE_CLOSED', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Store: opening/closing times
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "opening_time" TEXT;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "closing_time" TEXT;

-- Product: stock
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "stock" DECIMAL(10,2) NOT NULL DEFAULT 999;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "is_out_of_stock" BOOLEAN NOT NULL DEFAULT false;

-- Order: subtotal, service fee, total breakdown; cancellation enum
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "subtotal_amount" DECIMAL(10,2);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "service_fee" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "cancelled_by_role" "Role";

-- Old schema: total_amount was items sum. So subtotal = total for existing orders.
UPDATE "Order" SET "subtotal_amount" = "total_amount" WHERE "subtotal_amount" IS NULL;
ALTER TABLE "Order" ALTER COLUMN "subtotal_amount" SET DEFAULT 0;
ALTER TABLE "Order" ALTER COLUMN "subtotal_amount" SET NOT NULL;

-- Replace text cancellation_reason with enum
ALTER TABLE "Order" DROP COLUMN IF EXISTS "cancellation_reason";
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "cancellation_reason" "CancellationReason";
