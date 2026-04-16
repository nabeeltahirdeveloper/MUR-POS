/*
  Warnings:

  - The primary key for the `reminders` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "debt_payments" ADD COLUMN     "note" TEXT;

-- AlterTable
ALTER TABLE "debts" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "description" TEXT,
ADD COLUMN     "first_sale_price" DECIMAL(65,30),
ADD COLUMN     "image" TEXT,
ADD COLUMN     "order_number" INTEGER,
ADD COLUMN     "second_purchase_price" DECIMAL(65,30),
ADD COLUMN     "supplier_id" INTEGER;

-- AlterTable
ALTER TABLE "ledger" ADD COLUMN     "item_id" INTEGER,
ADD COLUMN     "order_number" INTEGER,
ADD COLUMN     "quantity" DECIMAL(65,30),
ADD COLUMN     "status" TEXT DEFAULT 'open';

-- AlterTable
ALTER TABLE "reminders" DROP CONSTRAINT "reminders_pkey",
ADD COLUMN     "resolved_at" TIMESTAMP(3),
ADD COLUMN     "source" TEXT,
ADD COLUMN     "title" TEXT,
ADD COLUMN     "trigger_at" TIMESTAMP(3),
ADD COLUMN     "updated_at" TIMESTAMP(3),
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "reference_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "reminders_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "reminders_id_seq";

-- AlterTable
ALTER TABLE "utilities" ADD COLUMN     "paid_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "customers" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "other_expenses" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "due_date" DATE NOT NULL,
    "paid_at" TIMESTAMP(3),
    "category" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unpaid',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "other_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cron_runs" (
    "id" SERIAL NOT NULL,
    "type" TEXT,
    "results" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cron_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE INDEX "items_supplier_id_idx" ON "items"("supplier_id");

-- CreateIndex
CREATE INDEX "ledger_order_number_idx" ON "ledger"("order_number");

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
