-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "terms" TEXT,
ALTER COLUMN "status" SET DEFAULT 'draft';
