-- DropIndex
DROP INDEX "suppliers_userId_legalName_idx";

-- AlterTable
ALTER TABLE "suppliers" ALTER COLUMN "legalName" DROP NOT NULL,
ALTER COLUMN "document" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "suppliers_userId_tradeName_idx" ON "suppliers"("userId", "tradeName");
