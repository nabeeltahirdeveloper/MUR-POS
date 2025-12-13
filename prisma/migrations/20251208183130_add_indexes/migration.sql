-- CreateIndex
CREATE INDEX "debt_payments_debt_id_idx" ON "debt_payments"("debt_id");

-- CreateIndex
CREATE INDEX "items_category_id_idx" ON "items"("category_id");

-- CreateIndex
CREATE INDEX "items_base_unit_id_idx" ON "items"("base_unit_id");

-- CreateIndex
CREATE INDEX "items_sale_unit_id_idx" ON "items"("sale_unit_id");

-- CreateIndex
CREATE INDEX "ledger_category_id_idx" ON "ledger"("category_id");

-- CreateIndex
CREATE INDEX "purchase_order_items_order_id_idx" ON "purchase_order_items"("order_id");

-- CreateIndex
CREATE INDEX "purchase_order_items_item_id_idx" ON "purchase_order_items"("item_id");

-- CreateIndex
CREATE INDEX "purchase_orders_supplier_id_idx" ON "purchase_orders"("supplier_id");

-- CreateIndex
CREATE INDEX "stock_logs_item_id_idx" ON "stock_logs"("item_id");

-- CreateIndex
CREATE INDEX "unit_conversions_from_unit_id_idx" ON "unit_conversions"("from_unit_id");

-- CreateIndex
CREATE INDEX "unit_conversions_to_unit_id_idx" ON "unit_conversions"("to_unit_id");
