-- Line-item delivery: original + discount (first N free delivery)
ALTER TABLE "Order" ADD COLUMN "delivery_fee_original" DECIMAL(10,2);
ALTER TABLE "Order" ADD COLUMN "delivery_discount" DECIMAL(10,2) NOT NULL DEFAULT 0;
UPDATE "Order" SET "delivery_fee_original" = "delivery_fee" WHERE "delivery_fee_original" IS NULL;
