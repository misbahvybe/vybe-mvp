-- OrderItem: persist chosen variant (size) for receipts/history
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "variant_id" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "variant_name_snapshot" TEXT;

