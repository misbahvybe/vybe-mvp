-- Customer markup: snapshot store catalogue unit price per line (null = legacy orders).
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "store_base_unit_price" DECIMAL(10,2);
