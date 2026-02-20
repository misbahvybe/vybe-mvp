-- AlterTable
ALTER TABLE "User" ADD COLUMN     "invitation_expires_at" TIMESTAMP(3),
ADD COLUMN     "invitation_token" TEXT,
ADD COLUMN     "password_set" BOOLEAN NOT NULL DEFAULT false;
