import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDocById, updateDoc, createDoc } from "@/lib/firestore-helpers";
import { calculateCurrentStock } from "@/lib/inventory";
import { syncLowStockReminderForItem } from "@/lib/reminders";
import type { FirestoreLedger, FirestoreItem, FirestoreStockLog } from "@/types/firestore";

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { ledgerId, quantityToRemove, reason, notes } = body;

        if (!ledgerId || !quantityToRemove || !reason) {
            return NextResponse.json(
                { error: "Ledger ID, Quantity, and Reason are required" },
                { status: 400 }
            );
        }

        // Get the original ledger entry
        const originalEntry = await getDocById<FirestoreLedger>('ledger', String(ledgerId));
        if (!originalEntry) {
            return NextResponse.json(
                { error: "Ledger entry not found" },
                { status: 404 }
            );
        }

        const qty = Number(quantityToRemove);
        const originalQty = originalEntry.quantity || 0;

        if (qty <= 0 || qty > originalQty) {
            return NextResponse.json(
                { error: `Invalid quantity. Original quantity: ${originalQty}` },
                { status: 400 }
            );
        }

        // Check stock availability FIRST - before doing anything
        let currentStock = 0;
        if (originalEntry.itemId) {
            try {
                currentStock = await calculateCurrentStock(originalEntry.itemId);
                
                if (currentStock < qty) {
                    return NextResponse.json(
                        { 
                            error: `Insufficient stock to remove. Current stock: ${currentStock}, Requested removal: ${qty}. You cannot remove items that are not in stock.`,
                            availableStock: currentStock,
                            requestedRemoval: qty
                        },
                        { status: 400 }
                    );
                }
            } catch (err) {
                console.error("Failed to check stock:", err);
                return NextResponse.json(
                    { error: "Failed to check stock availability" },
                    { status: 500 }
                );
            }
        }

        // Get the item to find purchase price
        let purchasePrice = 0;
        if (originalEntry.itemId) {
            const item = await getDocById<FirestoreItem>('items', originalEntry.itemId);
            if (item) {
                purchasePrice = item.secondPurchasePrice || 0;
            }
        }

        // Calculate new amount based on purchase price
        const amountToRemove = qty * purchasePrice;
        const newAmount = originalEntry.amount - amountToRemove;
        const newQuantity = originalQty - qty;

        // Update the original ledger entry with new amount and quantity
        const updatedNote = [
            originalEntry.note || '',
            `\n--- Item Reduction ---`,
            `Reason: ${reason}`,
            `Removed: ${qty} units @ ${purchasePrice}`,
            notes ? `Notes: ${notes}` : ''
        ].filter(Boolean).join('\n');

        await updateDoc<Omit<FirestoreLedger, 'id'>>('ledger', String(ledgerId), {
            ...originalEntry,
            amount: newAmount,
            quantity: newQuantity,
            note: updatedNote,
        });

        // Create a debit entry to record the write-off
        const writeOffEntry: Omit<FirestoreLedger, 'id'> = {
            type: 'debit',
            amount: amountToRemove,
            itemId: originalEntry.itemId,
            quantity: qty,
            status: 'open',
            note: [
                `Write-Off: ${originalEntry.note?.split('\n')[0] || 'Item Removal'}`,
                `Reason: ${reason}`,
                `${qty} units removed @ ${purchasePrice} (Purchase Price)`,
                notes ? `Notes: ${notes}` : ''
            ].filter(Boolean).join('\n'),
            date: new Date(),
            createdAt: new Date(),
        };

        const writeOffId = await createDoc<Omit<FirestoreLedger, 'id'>>('ledger', writeOffEntry);

        // Create stock removal log (stock was already verified above)
        if (originalEntry.itemId) {
            try {
                const stockLogData: Omit<FirestoreStockLog, 'id'> = {
                    itemId: originalEntry.itemId,
                    type: "out",
                    quantityBaseUnit: qty,
                    description: `Transaction removal: ${reason}${notes ? ' - ' + notes : ''}`,
                    createdAt: new Date(),
                };

                await createDoc<Omit<FirestoreStockLog, 'id'>>('stock_logs', stockLogData);

                // Update low stock reminders
                await syncLowStockReminderForItem(originalEntry.itemId);
            } catch (err) {
                console.log("Optional stock removal failed:", err);
                // Don't fail the whole request if stock removal fails
            }
        }

        return NextResponse.json({
            success: true,
            message: `${qty} item(s) removed from transaction and stock`,
            originalEntryUpdated: ledgerId,
            writeOffEntryCreated: writeOffId,
            newAmount: newAmount,
            newQuantity: newQuantity,
            removedAmount: amountToRemove,
        });
    } catch (error) {
        console.error("Error removing transaction item:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to remove item from transaction" },
            { status: 500 }
        );
    }
}
