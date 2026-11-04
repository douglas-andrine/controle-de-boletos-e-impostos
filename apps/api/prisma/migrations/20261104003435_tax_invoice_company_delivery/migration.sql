-- AlterTable
ALTER TABLE "taxes" ADD COLUMN     "goodsDelivered" BOOLEAN,
ADD COLUMN     "invoiceNumber" TEXT,
ADD COLUMN     "supplierId" TEXT;

-- CreateIndex
CREATE INDEX "taxes_supplierId_idx" ON "taxes"("supplierId");

-- AddForeignKey
ALTER TABLE "taxes" ADD CONSTRAINT "taxes_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
