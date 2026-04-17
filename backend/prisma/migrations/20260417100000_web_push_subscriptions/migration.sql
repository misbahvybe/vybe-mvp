-- Web push subscriptions for PWA push notifications

CREATE TABLE IF NOT EXISTS "web_push_subscriptions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "web_push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "web_push_subscriptions_endpoint_key"
  ON "web_push_subscriptions"("endpoint");

CREATE INDEX IF NOT EXISTS "web_push_subscriptions_user_id_idx"
  ON "web_push_subscriptions"("user_id");

-- PG <15 does not support `ADD CONSTRAINT IF NOT EXISTS`; use an idempotent DO block.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'web_push_subscriptions_user_id_fkey'
  ) THEN
    ALTER TABLE "web_push_subscriptions"
      ADD CONSTRAINT "web_push_subscriptions_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
