-- Run this in Neon SQL Editor on your PRIMARY database (e.g. neondb), NOT prisma_migrate_shadow_db_*.
-- Safe to re-run: uses IF NOT EXISTS / duplicate-safe FK blocks.

CREATE TABLE IF NOT EXISTS "WithdrawRequest" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    CONSTRAINT "WithdrawRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WithdrawRequest_user_id_idx" ON "WithdrawRequest"("user_id");
CREATE INDEX IF NOT EXISTS "WithdrawRequest_status_idx" ON "WithdrawRequest"("status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WithdrawRequest_user_id_fkey'
  ) THEN
    ALTER TABLE "WithdrawRequest" ADD CONSTRAINT "WithdrawRequest_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "earning_payouts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "store_id" TEXT,
    "amount_pkr" DECIMAL(10,2) NOT NULL,
    "withdraw_request_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "earning_payouts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "earning_payouts_withdraw_request_id_key" ON "earning_payouts"("withdraw_request_id");
CREATE INDEX IF NOT EXISTS "earning_payouts_user_id_idx" ON "earning_payouts"("user_id");
CREATE INDEX IF NOT EXISTS "earning_payouts_store_id_idx" ON "earning_payouts"("store_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'earning_payouts_user_id_fkey') THEN
    ALTER TABLE "earning_payouts" ADD CONSTRAINT "earning_payouts_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'earning_payouts_store_id_fkey') THEN
    ALTER TABLE "earning_payouts" ADD CONSTRAINT "earning_payouts_store_id_fkey"
      FOREIGN KEY ("store_id") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'earning_payouts_withdraw_request_id_fkey') THEN
    ALTER TABLE "earning_payouts" ADD CONSTRAINT "earning_payouts_withdraw_request_id_fkey"
      FOREIGN KEY ("withdraw_request_id") REFERENCES "WithdrawRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
