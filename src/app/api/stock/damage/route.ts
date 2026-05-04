import { NextRequest, NextResponse } from "next/server";
import { createDoc, getDocById, getAllDocs } from "@/lib/prisma-helpers";
import { calculateCurrentStock } from "@/lib/inventory";
import { syncLowStockReminderForItem } from "@/lib/reminders";
import { getSupplierBalance, getCustomerBalance } from "@/lib/ledger-balance";
import { isSystemLocked } from "@/lib/lock";
import type { ApiStockLog, ApiItem, ApiUnit, ApiLedger } from "@/types/models";

export async function POST(request: NextRequest) {
    try {
        if (await isSystemLocked()) {
            return NextResponse.json({ error: "System is locked. Access denied." }, { status: 423 });
        }

        const body = await request.json();
        const { itemId, quantity, reason, notes } = body;

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

        // Create damage/removal log with reason
        const description = `${reason || 'Removal'}${notes ? ': ' + notes : ''}`;
        const logData: Omit<ApiStockLog, 'id'> = {
            itemId: id,
            type: "out",
            quantityBaseUnit: qtyToRemove,
            description: description,
            createdAt: new Date(),
        };

        const logId = await createDoc<Omit<ApiStockLog, 'id'>>('stock_logs', logData);

        // Update stock reminders if needed
        const updatedStock = currentStock - qtyToRemove;
        const item = await getDocById<ApiItem>('items', id);

        if (item) {
            await syncLowStockReminderForItem(id);

            // Create ledger entry to reduce liability if it's a damaged item removal
            // This helps track write-offs
            try {
                const price = item.secondPurchasePrice || 0;
                const totalAmount = qtyToRemove * price;

                if (totalAmount > 0) {
                    let unitLabel = "";
                    if (item.baseUnitId) {
                        const unit = await getDocById<ApiUnit>('units', item.baseUnitId);
                        unitLabel = unit?.symbol || unit?.name || "";
                    }

                    const note = [
                        `Stock Write-Off (${reason || 'Removal'})`,
                        `Item: ${item.name} (Qty: ${qtyToRemove} ${unitLabel} @ ${price})`,
                        notes ? `Notes: ${notes}` : ''
                    ].filter(Boolean).join('\n');

                    const ledgerData: Omit<ApiLedger, 'id'> = {
                        type: 'debit',
                        amount: totalAmount,
                        itemId: id,
                        quantity: qtyToRemove,
                        status: 'open',
                        note: note,
                        date: new Date(),
                        createdAt: new Date(),
                    };

                    await createDoc<Omit<ApiLedger, 'id'>>('ledger', ledgerData);
                }
            } catch (err) {
                console.error("Optional ledger entry creation failed:", err);
                // Don't fail the whole request if ledger entry fails
            }
        }

        return NextResponse.json({
            success: true,
            message: `${qtyToRemove} item(s) removed as ${reason || 'damaged'}`,
            logId: logId,
            newStock: updatedStock,
        });
    } catch (error) {
        console.error("Error removing stock:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to remove stock" },
            { status: 500 }
        );
    }
}
