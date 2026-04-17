-- AlterTable
ALTER TABLE "ledger" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by" TEXT;

-- CreateIndex
CREATE INDEX "ledger_deleted_at_idx" ON "ledger"("deleted_at");
