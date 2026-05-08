/*
  Warnings:

  - The values [DRAFT,SUBMITTED,APPROVED] on the enum `DraftStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "DraftStatus_new" AS ENUM ('ADMIN_CREATED', 'AGENT_IN_PROGRESS', 'AGENT_VERIFIED', 'ADMIN_REVIEW', 'REJECTED', 'PUBLISHED');
ALTER TABLE "public"."product_drafts" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "product_drafts" ALTER COLUMN "status" TYPE "DraftStatus_new" USING ("status"::text::"DraftStatus_new");
ALTER TYPE "DraftStatus" RENAME TO "DraftStatus_old";
ALTER TYPE "DraftStatus_new" RENAME TO "DraftStatus";
DROP TYPE "public"."DraftStatus_old";
ALTER TABLE "product_drafts" ALTER COLUMN "status" SET DEFAULT 'ADMIN_CREATED';
COMMIT;

-- AlterTable
ALTER TABLE "product_drafts" ALTER COLUMN "status" SET DEFAULT 'ADMIN_CREATED';

-- AlterTable
ALTER TABLE "samples" ADD COLUMN     "assignedVerifierId" TEXT;

-- CreateTable
CREATE TABLE "email_otps" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'EMAIL_VERIFICATION',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_otps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_otps_expiresAt_idx" ON "email_otps"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "email_otps_userId_purpose_key" ON "email_otps"("userId", "purpose");

-- CreateIndex
CREATE INDEX "samples_assignedVerifierId_idx" ON "samples"("assignedVerifierId");

-- AddForeignKey
ALTER TABLE "email_otps" ADD CONSTRAINT "email_otps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "samples" ADD CONSTRAINT "samples_assignedVerifierId_fkey" FOREIGN KEY ("assignedVerifierId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
