-- Add enum for redirect payment providers (XPay/JazzCash/Easypaisa)
CREATE TYPE "PendingPaymentProvider" AS ENUM ('XPAY', 'JAZZCASH', 'EASYPAISA');

-- Extend pending_payment to support multiple redirect providers
ALTER TABLE "pending_payment"
  ADD COLUMN "provider" "PendingPaymentProvider" NOT NULL DEFAULT 'XPAY',
  ADD COLUMN "provider_ref" TEXT,
  ADD COLUMN "provider_payload_json" TEXT,
  ADD COLUMN "order_id" TEXT;

-- Index for provider lookups (callbacks)
CREATE INDEX "pending_payment_provider_provider_ref_idx"
  ON "pending_payment" ("provider", "provider_ref");

