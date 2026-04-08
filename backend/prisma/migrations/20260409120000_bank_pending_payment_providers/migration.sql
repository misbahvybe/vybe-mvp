-- Bank redirect payment sessions (HBL / Meezan / Allied scaffolding)
ALTER TYPE "PendingPaymentProvider" ADD VALUE 'BANK_HBL';
ALTER TYPE "PendingPaymentProvider" ADD VALUE 'BANK_MEEZAN';
ALTER TYPE "PendingPaymentProvider" ADD VALUE 'BANK_ALLIED';
