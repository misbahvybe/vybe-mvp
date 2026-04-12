-- AlterTable
ALTER TABLE "RiderProfile" ADD COLUMN     "current_collected_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "is_blocked" BOOLEAN NOT NULL DEFAULT false;
