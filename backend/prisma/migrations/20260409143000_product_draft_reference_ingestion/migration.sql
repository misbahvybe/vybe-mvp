-- CreateEnum
CREATE TYPE "MedicineFormHint" AS ENUM ('TABLET', 'SYRUP', 'CAPSULE', 'INJECTION', 'OTHER');

-- AlterTable (Prisma uses quoted "Product", not "products")
ALTER TABLE "Product" ADD COLUMN "is_draft" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "is_verified" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Product" ADD COLUMN "name_normalized" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Product" ADD COLUMN "source" TEXT;
ALTER TABLE "Product" ADD COLUMN "form_hint" "MedicineFormHint";

UPDATE "Product" SET "name_normalized" = LOWER(TRIM(REGEXP_REPLACE("name", '\s+', ' ', 'g')));

ALTER TABLE "Product" ALTER COLUMN "name_normalized" DROP DEFAULT;

CREATE INDEX "Product_store_id_name_normalized_idx" ON "Product"("store_id", "name_normalized");
CREATE INDEX "Product_store_id_is_draft_idx" ON "Product"("store_id", "is_draft");
