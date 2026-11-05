-- AlterTable
ALTER TABLE "boletos" ADD COLUMN     "invoiceNumber" TEXT,
ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "issueDate" DROP NOT NULL;
