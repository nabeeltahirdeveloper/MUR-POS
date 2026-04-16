import { NextRequest, NextResponse } from "next/server";
import { createDoc, getDocById, getAllDocs } from "@/lib/prisma-helpers";
import { calculateCurrentStock } from "@/lib/inventory";
import { syncLowStockReminderForItem } from "@/lib/reminders";
import { isSystemLocked } from "@/lib/lock";
import { invalidateCacheByPrefix } from "@/lib/server-cache";
import { triggerDashboardStatsRefresh } from "@/lib/dashboard-stats";
import type { FirestoreStockLog, FirestoreItem, FirestoreUnit, FirestoreLedger } from "@/types/firestore";

export async function POST(request: NextRequest) {
    try {
        if (await isSystemLocked()) {
            return NextResponse.json({ error: "System is locked. Access denied." }, { status: 423 });
        }

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

                // Determine Customer Name and Balance
                // Stock removal is a sale — track customer balance, not supplier
                let personName = "-";
                let currentBalance = totalAmount; // Default: full amount owed since no advance

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

        // Invalidate caches so balance calculations are fresh
        invalidateCacheByPrefix("ledger-balance:");
        invalidateCacheByPrefix("daily-summary:");
        triggerDashboardStatsRefresh();

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
