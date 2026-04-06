-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "StoreStatus" AS ENUM ('INVITED', 'ACTIVE', 'INACTIVE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Store: status for onboarding / visibility
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "store_status" "StoreStatus" NOT NULL DEFAULT 'ACTIVE';

