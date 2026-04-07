-- CreateEnum
CREATE TYPE "CheckoutServiceFeeMode" AS ENUM ('FIXED', 'PERCENT');

-- CreateTable
CREATE TABLE "platform_checkout_settings" (
    "id" TEXT NOT NULL,
    "service_fee_mode" "CheckoutServiceFeeMode" NOT NULL DEFAULT 'FIXED',
    "service_fee_fixed" DECIMAL(10,2) NOT NULL DEFAULT 19.99,
    "service_fee_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cod_tax_percent" DECIMAL(5,2) NOT NULL DEFAULT 16,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_checkout_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "platform_checkout_settings" ("id", "service_fee_mode", "service_fee_fixed", "service_fee_percent", "cod_tax_percent", "updated_at")
VALUES ('default', 'FIXED', 19.99, 0, 16, CURRENT_TIMESTAMP);
