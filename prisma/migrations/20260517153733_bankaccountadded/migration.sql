-- CreateTable
CREATE TABLE "artisan_bank_details" (
    "id" TEXT NOT NULL,
    "artisanId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountHolderName" TEXT NOT NULL,
    "branch" TEXT,
    "accountType" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "artisan_bank_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "artisan_bank_details_artisanId_key" ON "artisan_bank_details"("artisanId");

-- AddForeignKey
ALTER TABLE "artisan_bank_details" ADD CONSTRAINT "artisan_bank_details_artisanId_fkey" FOREIGN KEY ("artisanId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
