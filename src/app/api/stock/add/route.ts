import { NextRequest, NextResponse } from "next/server";
import { createDoc, getDocById, getAllDocs } from "@/lib/firestore-helpers";
import { calculateCurrentStock } from "@/lib/inventory";
import { syncLowStockReminderForItem } from "@/lib/reminders";
import { getSupplierBalance } from "@/lib/ledger-balance";
import type { FirestoreStockLog, FirestoreItem, FirestoreUnit, FirestoreSupplier, FirestoreLedger } from "@/types/firestore";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { itemId, quantity, description } = body;

        if (!itemId || !quantity) {
            return NextResponse.json(
                { error: "Item ID and Quantity are required" },
                { status: 400 }
            );
        }

        const qty = Number(quantity);
        if (qty <= 0) {
            return NextResponse.json(
                { error: "Quantity must be greater than 0" },
                { status: 400 }
            );
        }

        // Create IN log
        const logData: Omit<FirestoreStockLog, 'id'> = {
            itemId: String(itemId),
            type: "in",
            quantityBaseUnit: qty,
            description: description || null,
            createdAt: new Date(),
        };

        await createDoc<Omit<FirestoreStockLog, 'id'>>('stock_logs', logData);

        // --- Create Pending Ledger Entry ---
        try {
            const item = await getDocById<FirestoreItem>('items', String(itemId));
            if (item) {
                // Determine Unit Label
                let unitLabel = "";
                if (item.baseUnitId) {
                    const unit = await getDocById<FirestoreUnit>('units', item.baseUnitId);
                    unitLabel = unit?.symbol || unit?.name || "";
                }

                // Determine Supplier Name
                let supplierName = "-";
                if (item.supplierId) {
                    const supplier = await getDocById<FirestoreSupplier>('suppliers', item.supplierId);
                    supplierName = supplier?.name || "-";
                }

                const price = item.secondPurchasePrice || 0;
                const totalAmount = qty * price;

                // Calculate Cumulative Balance for this Specific Supplier
                const currentBalance = await getSupplierBalance(supplierName.trim());
                const cumulativeBalance = currentBalance + totalAmount;

                // Determine Next Order Number
                const recentEntries = await getAllDocs<FirestoreLedger>('ledger', {
                    orderBy: 'createdAt',
                    orderDirection: 'desc',
                    limit: 50
                });

                let nextOrderNumber = 1;
                for (const entry of recentEntries) {
                    if (entry.note) {
                        const match = entry.note.match(/Order #(\d+)/);
                        if (match) {
                            nextOrderNumber = parseInt(match[1], 10) + 1;
                            break;
                        }
                    }
                }

                // Format Note for Pending Ledger
                const note = [
                    `Order #${nextOrderNumber}`,
                    `Supplier: ${supplierName}`,
                    `Item: [Stock] ${item.name} (Qty: ${qty} ${unitLabel} @ ${price})`,
                    `Advance: 0`,
                    `Remaining: ${cumulativeBalance}`
                ].join('\n');

                const ledgerData: Omit<FirestoreLedger, 'id'> = {
                    type: 'debit',
                    amount: totalAmount,
                    itemId: String(itemId),
                    quantity: qty,
                    status: 'open',
                    note: note,
                    date: new Date(),
                    createdAt: new Date(),
                };

                await createDoc<Omit<FirestoreLedger, 'id'>>('ledger', ledgerData);
            }
        } catch (ledgerError) {
            console.error("Failed to create ledger entry for stock add:", ledgerError);
            // Non-blocking for stock update
        }
        // ------------------------------------

        // Return updated stock
        const currentStock = await calculateCurrentStock(String(itemId));

        // Sync low-stock reminder immediately (so notifications show without waiting for cron)
        await syncLowStockReminderForItem(String(itemId));

        return NextResponse.json({
            message: "Stock added successfully",
            currentStock,
        });
    } catch (error) {
        console.error("Error adding stock:", error);
        return NextResponse.json(
            { error: "Failed to add stock" },
            { status: 500 }
        );
    }
}
