-- Referral discount wallet (non-cash rewards) + referral reward amount tracking
-- TEXT ids are used to stay compatible with existing Neon databases in this project.

-- 1) Extend referral_rewards with reward amount
ALTER TABLE "referral_rewards"
ADD COLUMN IF NOT EXISTS "reward_amount" DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- 2) Wallet table (1:1 per user)
CREATE TABLE IF NOT EXISTS "referral_discount_wallets" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "balance" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "referral_discount_wallets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "referral_discount_wallets_user_id_key"
  ON "referral_discount_wallets"("user_id");
CREATE INDEX IF NOT EXISTS "referral_discount_wallets_user_id_idx"
  ON "referral_discount_wallets"("user_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'referral_discount_wallets_user_id_fkey'
  ) THEN
    ALTER TABLE "referral_discount_wallets"
      ADD CONSTRAINT "referral_discount_wallets_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 3) Wallet ledger entries (credits/debits)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'ReferralWalletEntryType'
  ) THEN
    CREATE TYPE "ReferralWalletEntryType" AS ENUM ('CREDIT_REFERRAL', 'DEBIT_ORDER');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "referral_wallet_entries" (
  "id" TEXT NOT NULL,
  "wallet_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "order_id" TEXT,
  "reward_id" TEXT,
  "entry_type" "ReferralWalletEntryType" NOT NULL,
  "amount" DECIMAL(10, 2) NOT NULL,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "referral_wallet_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "referral_wallet_entries_wallet_id_created_at_idx"
  ON "referral_wallet_entries"("wallet_id", "created_at");
CREATE INDEX IF NOT EXISTS "referral_wallet_entries_user_id_created_at_idx"
  ON "referral_wallet_entries"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "referral_wallet_entries_order_id_idx"
  ON "referral_wallet_entries"("order_id");
CREATE INDEX IF NOT EXISTS "referral_wallet_entries_reward_id_idx"
  ON "referral_wallet_entries"("reward_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'referral_wallet_entries_wallet_id_fkey'
  ) THEN
    ALTER TABLE "referral_wallet_entries"
      ADD CONSTRAINT "referral_wallet_entries_wallet_id_fkey"
      FOREIGN KEY ("wallet_id") REFERENCES "referral_discount_wallets"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'referral_wallet_entries_user_id_fkey'
  ) THEN
    ALTER TABLE "referral_wallet_entries"
      ADD CONSTRAINT "referral_wallet_entries_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'referral_wallet_entries_order_id_fkey'
  ) THEN
    ALTER TABLE "referral_wallet_entries"
      ADD CONSTRAINT "referral_wallet_entries_order_id_fkey"
      FOREIGN KEY ("order_id") REFERENCES "Order"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'referral_wallet_entries_reward_id_fkey'
  ) THEN
    ALTER TABLE "referral_wallet_entries"
      ADD CONSTRAINT "referral_wallet_entries_reward_id_fkey"
      FOREIGN KEY ("reward_id") REFERENCES "referral_rewards"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
