-- AlterTable
ALTER TABLE "User" ADD COLUMN "stripe_customer_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_stripe_customer_id_key" ON "User"("stripe_customer_id");
