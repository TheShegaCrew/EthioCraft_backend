-- CreateEnum
CREATE TYPE "SampleStatus" AS ENUM ('SUBMITTED', 'REJECTED', 'MORE_INFO_REQUESTED', 'APPROVED');

-- AlterEnum
ALTER TYPE "MediaOwnerType" ADD VALUE 'SAMPLE';

-- AlterTable
ALTER TABLE "media" ADD COLUMN     "sampleId" TEXT;

-- AlterTable
ALTER TABLE "product_drafts" ADD COLUMN     "sampleId" TEXT;

-- CreateTable
CREATE TABLE "samples" (
    "id" TEXT NOT NULL,
    "artisanId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "price" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "stock" INTEGER,
    "materials" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dimensions" JSONB,
    "culturalMetadata" JSONB,
    "extensionData" JSONB,
    "status" "SampleStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submissionNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "samples_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "samples_artisanId_status_idx" ON "samples"("artisanId", "status");

-- CreateIndex
CREATE INDEX "media_sampleId_sortOrder_idx" ON "media"("sampleId", "sortOrder");

-- CreateIndex
CREATE INDEX "product_drafts_sampleId_idx" ON "product_drafts"("sampleId");

-- AddForeignKey
ALTER TABLE "product_drafts" ADD CONSTRAINT "product_drafts_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "samples"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "samples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "samples" ADD CONSTRAINT "samples_artisanId_fkey" FOREIGN KEY ("artisanId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
