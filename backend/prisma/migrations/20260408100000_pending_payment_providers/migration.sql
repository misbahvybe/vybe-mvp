-- Add enum for redirect payment providers (XPay/JazzCash/Easypaisa)
CREATE TYPE "PendingPaymentProvider" AS ENUM ('XPAY', 'JAZZCASH', 'EASYPAISA');

-- Extend pending_payment to support multiple redirect providers
ALTER TABLE "PendingPayment"
  ADD COLUMN "provider" "PendingPaymentProvider" NOT NULL DEFAULT 'XPAY',
  ADD COLUMN "provider_ref" TEXT,
  ADD COLUMN "provider_payload_json" TEXT,
  ADD COLUMN "order_id" TEXT;

-- Index for provider lookups (callbacks)
CREATE INDEX "PendingPayment_provider_provider_ref_idx"
  ON "PendingPayment" ("provider", "provider_ref");

