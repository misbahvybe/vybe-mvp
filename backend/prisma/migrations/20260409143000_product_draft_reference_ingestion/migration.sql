-- CreateEnum
CREATE TYPE "MedicineFormHint" AS ENUM ('TABLET', 'SYRUP', 'CAPSULE', 'INJECTION', 'OTHER');

-- AlterTable
ALTER TABLE "products" ADD COLUMN "is_draft" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "products" ADD COLUMN "is_verified" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "products" ADD COLUMN "name_normalized" TEXT NOT NULL DEFAULT '';
ALTER TABLE "products" ADD COLUMN "source" TEXT;
ALTER TABLE "products" ADD COLUMN "form_hint" "MedicineFormHint";

UPDATE "products" SET "name_normalized" = LOWER(TRIM(REGEXP_REPLACE("name", '\s+', ' ', 'g')));

ALTER TABLE "products" ALTER COLUMN "name_normalized" DROP DEFAULT;

CREATE INDEX "products_store_id_name_normalized_idx" ON "products"("store_id", "name_normalized");
CREATE INDEX "products_store_id_is_draft_idx" ON "products"("store_id", "is_draft");
