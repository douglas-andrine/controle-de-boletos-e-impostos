-- CreateIndex
CREATE UNIQUE INDEX "taxes_userId_invoiceNumber_key" ON "taxes"("userId", "invoiceNumber");
