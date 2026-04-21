-- AlterTable
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "accepting_orders" BOOLEAN NOT NULL DEFAULT true;
