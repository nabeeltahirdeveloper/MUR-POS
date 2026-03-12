import { NextRequest, NextResponse } from "next/server";
import { createDoc, getDocById, getAllDocs } from "@/lib/firestore-helpers";
import { calculateCurrentStock } from "@/lib/inventory";
import { syncLowStockReminderForItem } from "@/lib/reminders";
import { getSupplierBalance, getCustomerBalance } from "@/lib/ledger-balance";
import type { FirestoreStockLog, FirestoreItem, FirestoreUnit, FirestoreLedger } from "@/types/firestore";

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

        const id = String(itemId);
        const qtyToRemove = Number(quantity);

        if (qtyToRemove <= 0) {
            return NextResponse.json(
                { error: "Quantity must be greater than 0" },
                { status: 400 }
            );
        }

        // Check available stock
        const currentStock = await calculateCurrentStock(id);

        if (currentStock < qtyToRemove) {
            return NextResponse.json(
                {
                    error: `Insufficient stock. Current stock: ${currentStock}, Requested: ${qtyToRemove}`,
                },
                { status: 400 }
            );
        }

        // Create OUT log
        const logData: Omit<FirestoreStockLog, 'id'> = {
            itemId: id,
            type: "out",
            quantityBaseUnit: qtyToRemove,
            description: description || null,
            createdAt: new Date(),
        };

        await createDoc<Omit<FirestoreStockLog, 'id'>>('stock_logs', logData);

        // --- Create Pending Ledger Entry ---
        try {
            const item = await getDocById<FirestoreItem>('items', id);
            if (item) {
                // Determine Unit Label
                let unitLabel = "";
                if (item.baseUnitId) {
                    const unit = await getDocById<FirestoreUnit>('units', item.baseUnitId);
                    unitLabel = unit?.symbol || unit?.name || "";
                }

                const price = item.firstSalePrice || 0;
                const totalAmount = qtyToRemove * price;

                // Determine Display Name and Cumulative Balance
                let personName = "-";
                let currentBalance = 0;

                // If it's a removal, it might be a Customer Sale or return to Supplier
                // For now we check if there's a supplier linked to item
                if (item.supplierId) {
                    const sup = await getDocById<any>('suppliers', item.supplierId);
                    if (sup) personName = sup.name;
                    currentBalance = await getSupplierBalance(personName.trim());
                }

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
                    `Customer: ${personName}`,
                    `Item: [Stock] ${item.name} (Qty: ${qtyToRemove} ${unitLabel} @ ${price})`,
                    `Advance: 0`,
                    `Remaining: ${currentBalance}`
                ].join('\n');

                const ledgerData: Omit<FirestoreLedger, 'id'> = {
                    type: 'credit',
                    amount: totalAmount,
                    itemId: id,
                    quantity: qtyToRemove,
                    status: 'open',
                    note: note,
                    date: new Date(),
                    createdAt: new Date(),
                };

                await createDoc<Omit<FirestoreLedger, 'id'>>('ledger', ledgerData);
            }
        } catch (ledgerError) {
            console.error("Failed to create ledger entry for stock remove:", ledgerError);
            // Non-blocking for stock update
        }
        // ------------------------------------

        // Return updated stock
        const newStock = currentStock - qtyToRemove;

        // Sync low-stock reminder immediately (so notifications show without waiting for cron)
        await syncLowStockReminderForItem(id);

        return NextResponse.json({
            message: "Stock removed successfully",
            currentStock: newStock,
        });
    } catch (error) {
        console.error("Error removing stock:", error);
        return NextResponse.json(
            { error: "Failed to remove stock" },
            { status: 500 }
        );
    }
}
