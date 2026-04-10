-- If a previous deploy failed mid-migration, run once on Neon:
--   DROP TABLE IF EXISTS "earning_payouts" CASCADE;
--   npx prisma migrate resolve --rolled-back "20260410150000_earning_payouts"
-- then: npx prisma migrate deploy

-- Some databases never applied 20260310172427; FK below requires this table.
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
    ALTER TABLE "WithdrawRequest" ADD CONSTRAINT "WithdrawRequest_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable
CREATE TABLE "earning_payouts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "store_id" TEXT,
    "amount_pkr" DECIMAL(10,2) NOT NULL,
    "withdraw_request_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "earning_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "earning_payouts_withdraw_request_id_key" ON "earning_payouts"("withdraw_request_id");

-- CreateIndex
CREATE INDEX "earning_payouts_user_id_idx" ON "earning_payouts"("user_id");

-- CreateIndex
CREATE INDEX "earning_payouts_store_id_idx" ON "earning_payouts"("store_id");

-- AddForeignKey
ALTER TABLE "earning_payouts" ADD CONSTRAINT "earning_payouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "earning_payouts" ADD CONSTRAINT "earning_payouts_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "earning_payouts" ADD CONSTRAINT "earning_payouts_withdraw_request_id_fkey" FOREIGN KEY ("withdraw_request_id") REFERENCES "WithdrawRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
