import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/auth";
import { createDoc, updateDoc, getDocById, getAllDocs } from '@/lib/firestore-helpers';
import type { FirestoreLedger, FirestoreItem } from '@/types/firestore';

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { ledgerId, initialQuantity, ...itemData } = body;

        if (!itemData.name || !itemData.baseUnitId) {
            return NextResponse.json({ error: "Name and Base Unit are required" }, { status: 400 });
        }

        // 0. Auto-assign order number
        const items = await getAllDocs<FirestoreItem>('items');
        let maxOrderNum = 0;
        items.forEach(item => {
            if (item.orderNumber) {
                const num = Number(item.orderNumber);
                if (!isNaN(num) && num > maxOrderNum) {
                    maxOrderNum = num;
                }
            }
        });
        const nextOrderNumber = maxOrderNum + 1;

        // 1. Create the New Set Item
        const newItemPayload = {
            ...itemData,
            orderNumber: nextOrderNumber,
            currentStock: Number(initialQuantity) || 0,
            hasStock: (Number(initialQuantity) || 0) > 0, // Assuming basic inventory logic
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const newItemId = await createDoc('items', newItemPayload);

        // 2. Link Ledger Entry
        if (ledgerId) {
            const ledgerEntry = await getDocById<FirestoreLedger>('ledger', ledgerId);

            if (ledgerEntry) {
                let note = ledgerEntry.note || "";

                // Remove [Customize] tag or replace it
                note = note.replace("[Customize]", "[Custom-Processed]");

                await updateDoc('ledger', ledgerId, {
                    note: note,
                    itemId: newItemId
                });

                // 3. Create Stock Log for the "In" (Purchase/Initial)
                if (initialQuantity && Number(initialQuantity) > 0) {
                    await createDoc('stock_logs', {
                        itemId: newItemId,
                        type: 'in',
                        quantityBaseUnit: Number(initialQuantity),
                        description: `Initial Stock from Custom Receive (Ledger #${ledgerId})`,
                        createdAt: new Date(),
                    });

                    // 4. Create Stock Log for the "Out" (The Sale)
                    // Deduct stock to account for the sale that initiated this
                    await createDoc('stock_logs', {
                        itemId: newItemId,
                        type: 'out',
                        quantityBaseUnit: Number(initialQuantity),
                        description: `Retroactive deduction for Ledger #${ledgerId}`,
                        createdAt: new Date(),
                    });

                    // Update item current stock to 0 (since it came in and went out)
                    await updateDoc('items', newItemId, {
                        currentStock: 0
                    });
                }
            }
        }

        return NextResponse.json({ success: true, id: newItemId });

    } catch (error: any) {
        console.error("Error receiving custom item:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
