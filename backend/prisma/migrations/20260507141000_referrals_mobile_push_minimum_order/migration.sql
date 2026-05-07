-- NOTE: This database uses TEXT ids for Prisma `String @id` columns.
-- Keep all *_id columns as TEXT so foreign keys can be implemented.

-- Add referral columns to User (safe to re-run)
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "referral_code" TEXT,
ADD COLUMN IF NOT EXISTS "referred_by_user_id" TEXT;

-- If a previous attempt created UUID type, convert to TEXT.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'User'
      AND column_name = 'referred_by_user_id'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE "User"
    ALTER COLUMN "referred_by_user_id" TYPE TEXT USING "referred_by_user_id"::text;
  END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS "User_referral_code_key" ON "User"("referral_code");
CREATE INDEX IF NOT EXISTS "User_referred_by_user_id_idx" ON "User"("referred_by_user_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'User_referred_by_user_id_fkey'
  ) THEN
    ALTER TABLE "User"
    ADD CONSTRAINT "User_referred_by_user_id_fkey"
    FOREIGN KEY ("referred_by_user_id") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- Store: minimum order value
ALTER TABLE "Store"
ADD COLUMN IF NOT EXISTS "minimum_order_value" DECIMAL(10,2) NOT NULL DEFAULT 500;

-- Mobile push tokens (Expo)
CREATE TABLE IF NOT EXISTS "mobile_push_tokens" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "platform" TEXT,
  "device_name" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "mobile_push_tokens_pkey" PRIMARY KEY ("id")
);

-- If a previous attempt created UUID columns, convert them to TEXT.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mobile_push_tokens' AND column_name = 'id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE "mobile_push_tokens" ALTER COLUMN "id" TYPE TEXT USING "id"::text;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mobile_push_tokens' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE "mobile_push_tokens" ALTER COLUMN "user_id" TYPE TEXT USING "user_id"::text;
  END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS "mobile_push_tokens_token_key" ON "mobile_push_tokens"("token");
CREATE INDEX IF NOT EXISTS "mobile_push_tokens_user_id_idx" ON "mobile_push_tokens"("user_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mobile_push_tokens_user_id_fkey'
  ) THEN
    ALTER TABLE "mobile_push_tokens"
    ADD CONSTRAINT "mobile_push_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

-- Referral rewards
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReferralRewardStatus') THEN
    CREATE TYPE "ReferralRewardStatus" AS ENUM ('PENDING', 'ISSUED');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS "referral_rewards" (
  "id" TEXT NOT NULL,
  "referrer_id" TEXT NOT NULL,
  "referred_user_id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "coupon_code" TEXT NOT NULL,
  "status" "ReferralRewardStatus" NOT NULL DEFAULT 'PENDING',
  "eligible_at" TIMESTAMP(3) NOT NULL,
  "issued_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "referral_rewards_pkey" PRIMARY KEY ("id")
);

-- If a previous attempt created UUID columns, convert them to TEXT.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='referral_rewards' AND column_name='id' AND data_type='uuid') THEN
    ALTER TABLE "referral_rewards" ALTER COLUMN "id" TYPE TEXT USING "id"::text;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='referral_rewards' AND column_name='referrer_id' AND data_type='uuid') THEN
    ALTER TABLE "referral_rewards" ALTER COLUMN "referrer_id" TYPE TEXT USING "referrer_id"::text;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='referral_rewards' AND column_name='referred_user_id' AND data_type='uuid') THEN
    ALTER TABLE "referral_rewards" ALTER COLUMN "referred_user_id" TYPE TEXT USING "referred_user_id"::text;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='referral_rewards' AND column_name='order_id' AND data_type='uuid') THEN
    ALTER TABLE "referral_rewards" ALTER COLUMN "order_id" TYPE TEXT USING "order_id"::text;
  END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS "referral_rewards_order_id_key" ON "referral_rewards"("order_id");
CREATE UNIQUE INDEX IF NOT EXISTS "referral_rewards_coupon_code_key" ON "referral_rewards"("coupon_code");
CREATE INDEX IF NOT EXISTS "referral_rewards_referrer_id_status_eligible_at_idx" ON "referral_rewards"("referrer_id", "status", "eligible_at");
CREATE INDEX IF NOT EXISTS "referral_rewards_referred_user_id_idx" ON "referral_rewards"("referred_user_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referral_rewards_referrer_id_fkey') THEN
    ALTER TABLE "referral_rewards"
    ADD CONSTRAINT "referral_rewards_referrer_id_fkey"
    FOREIGN KEY ("referrer_id") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referral_rewards_referred_user_id_fkey') THEN
    ALTER TABLE "referral_rewards"
    ADD CONSTRAINT "referral_rewards_referred_user_id_fkey"
    FOREIGN KEY ("referred_user_id") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referral_rewards_order_id_fkey') THEN
    ALTER TABLE "referral_rewards"
    ADD CONSTRAINT "referral_rewards_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "Order"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

