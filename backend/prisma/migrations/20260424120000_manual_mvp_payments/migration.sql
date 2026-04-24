-- Manual MVP: JazzCash / Easypaisa / bank transfer with screenshot + admin verify
ALTER TYPE "PaymentStatus" ADD VALUE 'PENDING_VERIFICATION';
ALTER TYPE "PendingPaymentProvider" ADD VALUE 'BANK_MANUAL';

ALTER TABLE "User" ADD COLUMN "checkout_otp_verified_until" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "is_ordering_blocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "order_strike_count" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Order" ADD COLUMN "manual_transfer_provider" "PendingPaymentProvider";
ALTER TABLE "Order" ADD COLUMN "payment_screenshot_url" TEXT;
