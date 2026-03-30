-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "commission_percent_override" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "PlatformCategoryCommission" (
    "id" TEXT NOT NULL,
    "category_slug" TEXT NOT NULL,
    "commission_percent" DECIMAL(5,2) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformCategoryCommission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformCategoryCommission_category_slug_key" ON "PlatformCategoryCommission"("category_slug");

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "gst_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "card_processing_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "commission_percent_snapshot" DECIMAL(5,2),
ADD COLUMN     "delivery_distance_km" DECIMAL(10,4),
ADD COLUMN     "sla_deadline_at" TIMESTAMP(3);

-- Seed default platform commissions (idempotent)
INSERT INTO "PlatformCategoryCommission" ("id", "category_slug", "commission_percent", "updated_at")
VALUES
  (gen_random_uuid()::text, 'food', 13.50, NOW()),
  (gen_random_uuid()::text, 'grocery', 9.00, NOW()),
  (gen_random_uuid()::text, 'medicine', 3.75, NOW())
ON CONFLICT ("category_slug") DO NOTHING;
